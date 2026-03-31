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
 * Constant-time string comparison to prevent timing attacks.
 * Pads the shorter string to avoid leaking length information via early return.
 */
export function timingSafeEqual(a: string, b: string): boolean {
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
