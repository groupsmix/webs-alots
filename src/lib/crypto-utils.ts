/**
 * Shared cryptographic utilities for signature verification and hashing.
 *
 * Uses the Web Crypto API available in edge runtimes (Cloudflare Workers,
 * Vercel Edge, Next.js middleware, etc.).
 */

/**
 * Convert a byte array to a hex-encoded string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a hex-encoded string to a Uint8Array backed by a plain ArrayBuffer.
 */
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  ) as Uint8Array<ArrayBuffer>;
}

/**
 * Maximum length, in characters, accepted by {@link timingSafeEqual} on
 * either side of the comparison.
 *
 * A6-06: When `b` is attacker-controlled (e.g. a signature received in
 * a token / header), an unbounded input would force `padEnd(maxLen, "\0")`
 * to allocate a string of length `maxLen` per side. That turns a
 * comparison into a memory-amplification primitive. We cap the inputs
 * well above any legitimate use:
 *
 *   - hex SHA-256 / HMAC-SHA256 digests:                64 chars
 *   - Stripe signatures (`v1=`):                        64 chars
 *   - WhatsApp `X-Hub-Signature-256` (`sha256=`):       71 chars
 *   - API keys (`k_<32-byte hex>`):                    ≤ 96 chars
 *   - CMI HASH parameter:                              ≤ 88 chars
 *
 * A 1 KiB cap is two orders of magnitude above any of those and well
 * below anything that would meaningfully consume memory.
 */
const TIMING_SAFE_EQUAL_MAX_LEN = 1024;

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Pads the shorter string to avoid leaking length information via early
 * return. Inputs longer than {@link TIMING_SAFE_EQUAL_MAX_LEN} are
 * rejected up-front so an attacker cannot force an unbounded allocation
 * by submitting a multi-megabyte signature (A6-06).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (
    a.length > TIMING_SAFE_EQUAL_MAX_LEN ||
    b.length > TIMING_SAFE_EQUAL_MAX_LEN
  ) {
    return false;
  }
  const maxLen = Math.max(a.length, b.length);
  const paddedA = a.padEnd(maxLen, "\0");
  const paddedB = b.padEnd(maxLen, "\0");
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < maxLen; i++) {
    mismatch |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Compute hex-encoded SHA-256 hash using Web Crypto API.
 */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Compute hex-encoded HMAC-SHA256 using Web Crypto API.
 */
export async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}
