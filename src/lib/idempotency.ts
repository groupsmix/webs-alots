/**
 * A74-3: Idempotency key generation for outbound calls.
 *
 * Prevents double-charges (Stripe) and double-sends (notifications)
 * when retries are triggered by transient failures. Each outbound
 * operation should pass a stable idempotency key so the provider
 * deduplicates on its side.
 *
 * Usage:
 *   const key = idempotencyKey("stripe-charge", clinicId, appointmentId);
 *   await stripe.paymentIntents.create({ ... }, { idempotencyKey: key });
 *
 *   const key = idempotencyKey("whatsapp-send", clinicId, queueEntryId);
 *   // pass key in metadata or X-Idempotency-Key header
 */

/**
 * Generate a deterministic idempotency key from a set of stable identifiers.
 *
 * The key is a SHA-256 hex digest of the concatenated parts, ensuring it is:
 *   - deterministic (same inputs → same key)
 *   - bounded length (64 hex chars)
 *   - collision-resistant
 */
export async function idempotencyKey(...parts: string[]): Promise<string> {
  const input = parts.join("|");
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Synchronous variant using a simple FNV-1a hash for contexts where
 * `crypto.subtle` is not available (e.g. synchronous init paths).
 * Less collision-resistant than SHA-256 but sufficient for dedup keys
 * with high-entropy inputs (UUIDs).
 */
