import { describe, it, expect } from "vitest";
import {
  bytesToHex,
  hexToBytes,
  hmacSha256Hex,
  sha256Hex,
  timingSafeEqual,
} from "../crypto-utils";

describe("hexToBytes", () => {
  it("decodes a valid even-length hex string", () => {
    const bytes = hexToBytes("deadbeef");
    expect(Array.from(bytes)).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it("accepts uppercase hex", () => {
    const bytes = hexToBytes("DEADBEEF");
    expect(Array.from(bytes)).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it("round-trips with bytesToHex", () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    expect(Array.from(hexToBytes(bytesToHex(original)))).toEqual(
      Array.from(original),
    );
  });

  it("throws on empty input rather than producing a 500 (A10-07)", () => {
    expect(() => hexToBytes("")).toThrow(/must not be empty/);
  });

  it("throws on odd-length input rather than producing a 500 (A10-07)", () => {
    expect(() => hexToBytes("abc")).toThrow(/even number/);
  });

  it("throws on non-hex characters (A10-07)", () => {
    expect(() => hexToBytes("zz")).toThrow(/hex characters/);
    expect(() => hexToBytes("dead!!")).toThrow(/hex characters/);
  });
});

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });

  it("returns true for empty strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });

  it("returns false when first string is longer", () => {
    expect(timingSafeEqual("abcd", "abc")).toBe(false);
  });

  it("returns false for completely different strings", () => {
    expect(timingSafeEqual("hello", "world")).toBe(false);
  });

  it("handles special characters", () => {
    expect(timingSafeEqual("p@$$w0rd!", "p@$$w0rd!")).toBe(true);
    expect(timingSafeEqual("p@$$w0rd!", "p@$$w0rd?")).toBe(false);
  });

  it("handles unicode characters", () => {
    expect(timingSafeEqual("héllo", "héllo")).toBe(true);
    expect(timingSafeEqual("héllo", "hello")).toBe(false);
  });

  // A6-06: defence against memory-amplification via attacker-controlled
  // length on the `b` (or `a`) side. Inputs longer than 1 KiB must be
  // rejected up-front so `padEnd` never allocates a multi-megabyte
  // string under attacker control.
  it("rejects oversized inputs up-front (A6-06)", () => {
    const expected = "a".repeat(64);
    const oversize = "x".repeat(1025);
    expect(timingSafeEqual(expected, oversize)).toBe(false);
    expect(timingSafeEqual(oversize, expected)).toBe(false);
    // Both sides oversized: still false, never allocated.
    expect(timingSafeEqual(oversize, oversize)).toBe(false);
  });

  it("accepts inputs at the 1024-char boundary (A6-06)", () => {
    const a = "a".repeat(1024);
    expect(timingSafeEqual(a, a)).toBe(true);
  });
});

describe("sha256Hex", () => {
  it("hashes an empty string correctly", async () => {
    const hash = await sha256Hex("");
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("hashes 'hello' correctly", async () => {
    const hash = await sha256Hex("hello");
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await sha256Hex("test1");
    const hash2 = await sha256Hex("test2");
    expect(hash1).not.toBe(hash2);
  });

  it("produces consistent output for same input", async () => {
    const hash1 = await sha256Hex("consistency-check");
    const hash2 = await sha256Hex("consistency-check");
    expect(hash1).toBe(hash2);
  });

  it("returns a 64-character hex string", async () => {
    const hash = await sha256Hex("any input");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hmacSha256Hex", () => {
  it("produces a 64-character hex string", async () => {
    const hmac = await hmacSha256Hex("secret", "message");
    expect(hmac).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different outputs for different secrets", async () => {
    const hmac1 = await hmacSha256Hex("secret1", "message");
    const hmac2 = await hmacSha256Hex("secret2", "message");
    expect(hmac1).not.toBe(hmac2);
  });

  it("produces different outputs for different messages", async () => {
    const hmac1 = await hmacSha256Hex("secret", "message1");
    const hmac2 = await hmacSha256Hex("secret", "message2");
    expect(hmac1).not.toBe(hmac2);
  });

  it("produces consistent output for same inputs", async () => {
    const hmac1 = await hmacSha256Hex("key", "data");
    const hmac2 = await hmacSha256Hex("key", "data");
    expect(hmac1).toBe(hmac2);
  });

  it("produces a known HMAC-SHA256 value", async () => {
    // Known test vector
    const hmac = await hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog");
    expect(hmac).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });
});
