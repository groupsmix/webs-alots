import { describe, expect, it } from "vitest";
import { idempotencyKey, idempotencyKeySync } from "@/lib/idempotency";

/**
 * Tests for idempotency key generation (A74-3).
 *
 * These keys prevent double-charges (Stripe) and double-sends (notifications)
 * on retry, so determinism and collision-resistance are the critical
 * properties to guard.
 */
describe("idempotencyKey (SHA-256)", () => {
  it("is deterministic — same inputs produce the same key", async () => {
    const a = await idempotencyKey("stripe-charge", "clinic-1", "appt-9");
    const b = await idempotencyKey("stripe-charge", "clinic-1", "appt-9");
    expect(a).toBe(b);
  });

  it("produces a 64-char lowercase hex digest", async () => {
    const key = await idempotencyKey("whatsapp-send", "clinic-1", "queue-5");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the known SHA-256 vector for a single part", async () => {
    // SHA-256("abc") — a single part joins to itself with no separator.
    const key = await idempotencyKey("abc");
    expect(key).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("produces different keys for different inputs", async () => {
    const a = await idempotencyKey("stripe-charge", "clinic-1", "appt-9");
    const b = await idempotencyKey("stripe-charge", "clinic-1", "appt-10");
    expect(a).not.toBe(b);
  });

  it("uses a separator so part boundaries cannot collide", async () => {
    // Without the "|" separator, ["a","b"] and ["ab"] would hash identically.
    const twoParts = await idempotencyKey("a", "b");
    const onePart = await idempotencyKey("ab");
    expect(twoParts).not.toBe(onePart);
  });
});

describe("idempotencyKeySync (FNV-1a)", () => {
  it("is deterministic — same inputs produce the same key", () => {
    const a = idempotencyKeySync("whatsapp-send", "clinic-1", "queue-5");
    const b = idempotencyKeySync("whatsapp-send", "clinic-1", "queue-5");
    expect(a).toBe(b);
  });

  it("produces an 8-char lowercase hex string", () => {
    const key = idempotencyKeySync("stripe-charge", "clinic-1", "appt-9");
    expect(key).toMatch(/^[0-9a-f]{8}$/);
  });

  it("produces different keys for different inputs", () => {
    const a = idempotencyKeySync("stripe-charge", "clinic-1", "appt-9");
    const b = idempotencyKeySync("stripe-charge", "clinic-1", "appt-10");
    expect(a).not.toBe(b);
  });

  it("uses a separator so part boundaries cannot collide", () => {
    expect(idempotencyKeySync("a", "b")).not.toBe(idempotencyKeySync("ab"));
  });
});
