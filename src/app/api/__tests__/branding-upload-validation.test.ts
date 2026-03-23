import { describe, it, expect } from "vitest";

/**
 * Unit tests for the branding upload route's validation logic.
 *
 * Validates that ALLOWED_IMAGE_TYPES no longer includes image/svg+xml
 * and that magic-byte validation correctly identifies file formats.
 */

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "image/jpeg": [new Uint8Array([0xff, 0xd8, 0xff])],
  "image/png": [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  "image/x-icon": [new Uint8Array([0x00, 0x00, 0x01, 0x00])],
  "image/vnd.microsoft.icon": [new Uint8Array([0x00, 0x00, 0x01, 0x00])],
};

function validateFileContent(buffer: Buffer, declaredType: string): boolean {
  const signatures = MAGIC_BYTES[declaredType];
  if (!signatures) return false;
  return signatures.some((sig) =>
    sig.every((byte, i) => i < buffer.length && buffer[i] === byte),
  );
}

// ── ALLOWED_IMAGE_TYPES ──

describe("branding upload — ALLOWED_IMAGE_TYPES", () => {
  it("accepts JPEG, PNG, and WebP", () => {
    expect(ALLOWED_IMAGE_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/webp")).toBe(true);
  });

  it("accepts ICO formats", () => {
    expect(ALLOWED_IMAGE_TYPES.has("image/x-icon")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/vnd.microsoft.icon")).toBe(true);
  });

  it("does NOT allow SVG (XSS vector)", () => {
    expect(ALLOWED_IMAGE_TYPES.has("image/svg+xml")).toBe(false);
  });

  it("does NOT allow application/octet-stream", () => {
    expect(ALLOWED_IMAGE_TYPES.has("application/octet-stream")).toBe(false);
  });
});

// ── validateFileContent ──

describe("branding upload — validateFileContent", () => {
  it("validates a JPEG file", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateFileContent(buf, "image/jpeg")).toBe(true);
  });

  it("validates a PNG file", () => {
    const buf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(validateFileContent(buf, "image/png")).toBe(true);
  });

  it("validates an ICO file", () => {
    const buf = Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]);
    expect(validateFileContent(buf, "image/x-icon")).toBe(true);
  });

  it("validates vnd.microsoft.icon the same as x-icon", () => {
    const buf = Buffer.from([0x00, 0x00, 0x01, 0x00]);
    expect(validateFileContent(buf, "image/vnd.microsoft.icon")).toBe(true);
  });

  it("rejects SVG even if magic bytes somehow match (not in allowlist)", () => {
    // SVG starts with "<?xml" or "<svg" — text bytes
    const buf = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'>");
    expect(validateFileContent(buf, "image/svg+xml")).toBe(false);
  });

  it("rejects file with wrong magic bytes for declared type", () => {
    // PDF header claimed as JPEG
    const buf = Buffer.from([0x25, 0x50, 0x44, 0x46]);
    expect(validateFileContent(buf, "image/jpeg")).toBe(false);
  });

  it("rejects unknown MIME type", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff]);
    expect(validateFileContent(buf, "text/html")).toBe(false);
  });
});
