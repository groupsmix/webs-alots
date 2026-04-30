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
 * Maximum accepted input length for {@link timingSafeEqual}.
 *
 * All current callers compare fixed-length tokens, hex-encoded SHA-256 /
 * HMAC-SHA256 outputs, or short bearer secrets — none exceed a few hundred
 * bytes. Capping inputs at 1 KiB prevents an attacker who controls one side
 * of the comparison (e.g. the `signature` header on a webhook) from
 * triggering CPU exhaustion by submitting an arbitrarily large value.
 */
export const TIMING_SAFE_EQUAL_MAX_LENGTH = 1024;

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Both inputs are capped at {@link TIMING_SAFE_EQUAL_MAX_LENGTH}; oversized
 * values short-circuit to `false` so neither side can be used to amplify
 * CPU work. Differing lengths also short-circuit because every caller in
 * this codebase compares values whose length is a public constant (hex
 * hash widths, fixed token sizes), so length mismatch leaks no secret.
 * When the lengths match, the comparison runs in time proportional to the
 * shared length without padding allocations.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (
    a.length > TIMING_SAFE_EQUAL_MAX_LENGTH ||
    b.length > TIMING_SAFE_EQUAL_MAX_LENGTH
  ) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
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
