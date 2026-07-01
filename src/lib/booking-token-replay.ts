/**
 * Durable single-use enforcement for booking verification tokens (FP-08).
 *
 * Booking tokens are issued after OTP verification and may be redeemed exactly
 * once within their TTL. The original implementation tracked consumed token
 * signatures in a module-scope `Map`, which only deduplicates within a single
 * Cloudflare Worker isolate. Because the production runtime fans requests across
 * many isolates, a token consumed on isolate A was still "unused" on isolate B —
 * so the once-only guarantee did not actually hold in production (audit B-1).
 *
 * This module persists consumed signatures in Cloudflare KV (the already
 * provisioned `RATE_LIMIT_KV` namespace) keyed by the HMAC signature, with a TTL
 * derived from the token's own expiry so entries self-evict. When KV is
 * unavailable (local dev, unit tests, non-OpenNext runtimes) it degrades to an
 * in-memory `Map` — mirroring the rate limiter's degrade-to-memory behaviour in
 * `src/lib/rate-limit.ts`.
 *
 * Note on atomicity: KV does not offer compare-and-set, so two genuinely
 * concurrent first-uses of the same token could both observe "not present"
 * within KV's propagation window. This layer is defence-in-depth — the booking
 * write path has its own slot-level race protection — and KV is a substantial
 * improvement over per-isolate memory. For strict atomicity, back this with a DB
 * row carrying a UNIQUE constraint on the signature.
 */
import { getWorkerBinding } from "@/lib/cf-bindings";
import { logger } from "@/lib/logger";

/** Minimal KV surface used here (matches the shape in rate-limit.ts). */
interface CloudflareKV {
  get(key: string, options?: { type: "text" | "json" }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const KV_PREFIX = "booking_token_used:";

/**
 * In-memory fallback store. Used only when KV is unavailable. Keys are token
 * signatures; values are the token expiry timestamp (ms) for lazy eviction.
 */
const memoryStore = new Map<string, number>();

function evictExpiredMemoryEntries(now: number): void {
  for (const [sig, expiry] of memoryStore) {
    if (now > expiry) memoryStore.delete(sig);
  }
}

function consumeFromMemory(signature: string, expiry: number): boolean {
  const now = Date.now();
  evictExpiredMemoryEntries(now);
  if (memoryStore.has(signature)) return false;
  memoryStore.set(signature, expiry);
  return true;
}

/**
 * Atomically (best-effort) mark a booking token signature as used.
 *
 * @param signature - The HMAC signature portion of the booking token.
 * @param expiry - The token's expiry timestamp in ms (used to set the TTL).
 * @returns `true` if this is the first use, `false` if the token was already
 *          consumed (replay detected).
 */
export async function consumeBookingTokenSignature(
  signature: string,
  expiry: number,
): Promise<boolean> {
  const now = Date.now();

  // A token that is already expired can never be a valid first use; treat it as
  // consumed so callers reject it consistently. (verifyBookingToken should have
  // already rejected it, but this keeps the contract self-consistent.)
  if (now > expiry) return false;

  let kv: CloudflareKV | undefined;
  try {
    kv = await getWorkerBinding<CloudflareKV>("RATE_LIMIT_KV");
  } catch {
    kv = undefined;
  }

  if (!kv) {
    // KV binding not available — degrade to in-memory dedup (dev/tests).
    return consumeFromMemory(signature, expiry);
  }

  const key = `${KV_PREFIX}${signature}`;
  try {
    const existing = await kv.get(key);
    if (existing !== null) {
      // Already recorded — replay.
      return false;
    }

    // TTL must outlive the token so a replay cannot succeed after KV eviction
    // but before the token itself expires. +60s buffer mirrors rate-limit.ts.
    const ttlSeconds = Math.max(60, Math.ceil((expiry - now) / 1000) + 60);
    await kv.put(key, String(expiry), { expirationTtl: ttlSeconds });
    return true;
  } catch (err) {
    // On KV failure, fail safe: degrade to the in-memory store rather than
    // letting a token be replayed freely. This keeps single-use enforcement at
    // least at per-isolate strength (the prior behaviour) instead of disabling
    // it entirely.
    logger.warn("Booking token replay store KV failure, degrading to in-memory", {
      context: "booking-token-replay",
      error: err,
    });
    return consumeFromMemory(signature, expiry);
  }
}
