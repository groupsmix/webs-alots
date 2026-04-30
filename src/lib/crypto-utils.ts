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
 *
 * AUDIT A10-07: Validates input is non-empty, even-length, and contains only
 * hex characters. The previous implementation used a non-null assertion on the
 * regex match result, so an attacker-controlled odd-length or empty hex value
 * (anywhere a secret flowed) would surface as an unhelpful TypeError that
 * bubbled to a 500 response.
 */
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (typeof hex !== "string") {
    throw new TypeError("hexToBytes: input must be a string");
  }
  if (hex.length === 0) {
    throw new Error("hexToBytes: input must not be empty");
  }
  if (hex.length % 2 !== 0) {
    throw new Error("hexToBytes: input must have an even number of characters");
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("hexToBytes: input must contain only hex characters");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

/**
 * Maximum accepted input length for {@link timingSafeEqual}.
 *
 * All current callers compare fixed-length tokens, hex-encoded SHA-256 /
 * HMAC-SHA256 outputs, or short bearer secrets — none exceed a few hundred
 * bytes. Capping inputs at 1 KiB prevents an attacker who controls one side
 * of the comparison (e.g. the `signature` header on a webhook) from
 * triggering CPU exhaustion by submitting an arbitrarily large value.
 *
 * A2-02 / A6-06: Both inputs are capped; oversized values short-circuit to
 * `false` so neither side can be used to amplify CPU work.
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
 *
 * A2-02 / A6-06: No padding allocations — the implementation checks lengths
 * first and directly compares equal-length strings.
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