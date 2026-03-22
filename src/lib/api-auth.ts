/**
 * Shared API key authentication for public V1 REST endpoints.
 *
 * API keys are stored as SHA-256 hashes in the `clinic_api_keys` table.
 * A short prefix of the raw key is stored alongside the hash so we can
 * narrow the lookup to a single row before doing the constant-time
 * hash comparison.
 *
 * Migration path (backward-compatible):
 *   1. If the row has a `key_hash` column populated, compare hashes.
 *   2. Otherwise fall back to the legacy plaintext `key` column so
 *      existing keys keep working until they are rotated.
 */

import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * Compute a hex-encoded SHA-256 hash of the given value.
 * Uses the Web Crypto API available in edge runtimes.
 */
async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function authenticateApiKey(
  request: NextRequest,
): Promise<{ clinicId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  if (!apiKey) return null;

  const supabase = await createClient();

  // Compute hash of the provided key for comparison
  const keyHash = await sha256(apiKey);
  const keyPrefix = apiKey.slice(0, 8);

  // Try hash-based lookup first (new keys)
  const { data: hashedRow } = await supabase
    .from("clinic_api_keys")
    .select("clinic_id, active, key_hash")
    .eq("key_prefix", keyPrefix)
    .single();

  if (hashedRow?.key_hash && hashedRow.active) {
    if (!timingSafeEqual(hashedRow.key_hash, keyHash)) return null;

    // Update last-used timestamp (fire-and-forget)
    await supabase
      .from("clinic_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_prefix", keyPrefix)
      .eq("key_hash", keyHash);

    return { clinicId: hashedRow.clinic_id };
  }

  // Fallback: legacy plaintext lookup (to be removed after key rotation)
  const { data: legacyRow } = await supabase
    .from("clinic_api_keys")
    .select("clinic_id, active")
    .eq("key", apiKey)
    .single();

  if (!legacyRow?.active) return null;

  await supabase
    .from("clinic_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key", apiKey);

  return { clinicId: legacyRow.clinic_id };
}
