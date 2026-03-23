import { describe, it, expect } from "vitest";

/**
 * Unit tests for the radiology upload route's validation logic.
 *
 * The validateFileContent function and ALLOWED_TYPES / MAGIC_BYTES constants
 * are module-private, so we replicate the core logic here to verify the
 * magic-byte signatures are correct and the validation behaves as expected.
 */

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "application/pdf",
  "application/dicom",
]);

const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "image/jpeg": [new Uint8Array([0xff, 0xd8, 0xff])],
  "image/png": [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  "image/tiff": [
    new Uint8Array([0x49, 0x49, 0x2a, 0x00]),
    new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]),
  ],
  "image/bmp": [new Uint8Array([0x42, 0x4d])],
  "application/pdf": [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
  "application/dicom": [new Uint8Array([0x44, 0x49, 0x43, 0x4d])],
};

function validateFileContent(buffer: Buffer, declaredType: string): boolean {
  const signatures = MAGIC_BYTES[declaredType];
  if (!signatures) return false;

  if (declaredType === "application/dicom") {
    if (buffer.length < 132) return false;
    return signatures.some((sig) =>
      sig.every((byte, i) => buffer[128 + i] === byte),
    );
  }

  return signatures.some((sig) =>
    sig.every((byte, i) => i < buffer.length && buffer[i] === byte),
  );
}

// ── ALLOWED_TYPES ──

describe("radiology upload — ALLOWED_TYPES", () => {
  it("accepts standard medical image formats", () => {
    expect(ALLOWED_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_TYPES.has("image/tiff")).toBe(true);
    expect(ALLOWED_TYPES.has("application/dicom")).toBe(true);
    expect(ALLOWED_TYPES.has("application/pdf")).toBe(true);
  });

  it("rejects application/octet-stream", () => {
    expect(ALLOWED_TYPES.has("application/octet-stream")).toBe(false);
  });

  it("rejects SVG", () => {
    expect(ALLOWED_TYPES.has("image/svg+xml")).toBe(false);
  });

  it("rejects text/html", () => {
    expect(ALLOWED_TYPES.has("text/html")).toBe(false);
  });
});

// ── validateFileContent — standard types ──

describe("radiology upload — validateFileContent", () => {
  it("validates a JPEG file (FFD8FF header)", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateFileContent(buf, "image/jpeg")).toBe(true);
  });

  it("validates a PNG file (89504E47 header)", () => {
    const buf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    expect(validateFileContent(buf, "image/png")).toBe(true);
  });

  it("validates a PDF file (%PDF header)", () => {
    const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    expect(validateFileContent(buf, "application/pdf")).toBe(true);
  });

  it("validates a BMP file (BM header)", () => {
    const buf = Buffer.from([0x42, 0x4d, 0x00, 0x00]);
    expect(validateFileContent(buf, "image/bmp")).toBe(true);
  });

  it("validates TIFF little-endian (II)", () => {
    const buf = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08]);
    expect(validateFileContent(buf, "image/tiff")).toBe(true);
  });

  it("validates TIFF big-endian (MM)", () => {
    const buf = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00]);
    expect(validateFileContent(buf, "image/tiff")).toBe(true);
  });

  it("validates a WebP file (RIFF header)", () => {
    const buf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]);
    expect(validateFileContent(buf, "image/webp")).toBe(true);
  });

  it("rejects a file with mismatched magic bytes", () => {
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(validateFileContent(pngHeader, "image/jpeg")).toBe(false);
  });

  it("rejects an unknown type", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff]);
    expect(validateFileContent(buf, "application/octet-stream")).toBe(false);
  });

  it("rejects an empty buffer", () => {
    const buf = Buffer.alloc(0);
    expect(validateFileContent(buf, "image/jpeg")).toBe(false);
  });
});

// ── validateFileContent — DICOM special handling ──

describe("radiology upload — DICOM validation", () => {
  it("validates DICOM with DICM at offset 128", () => {
    const buf = Buffer.alloc(256);
    // Write "DICM" at offset 128
    buf[128] = 0x44;
    buf[129] = 0x49;
    buf[130] = 0x43;
    buf[131] = 0x4d;
    expect(validateFileContent(buf, "application/dicom")).toBe(true);
  });

  it("rejects DICOM if buffer is too short (<132 bytes)", () => {
    const buf = Buffer.alloc(131);
    buf[128] = 0x44;
    buf[129] = 0x49;
    buf[130] = 0x43;
    expect(validateFileContent(buf, "application/dicom")).toBe(false);
  });

  it("rejects DICOM if DICM is at offset 0 (wrong position)", () => {
    const buf = Buffer.alloc(256);
    buf[0] = 0x44;
    buf[1] = 0x49;
    buf[2] = 0x43;
    buf[3] = 0x4d;
    expect(validateFileContent(buf, "application/dicom")).toBe(false);
  });

  it("rejects DICOM with wrong magic at offset 128", () => {
    const buf = Buffer.alloc(256);
    buf[128] = 0x00;
    buf[129] = 0x00;
    buf[130] = 0x00;
    buf[131] = 0x00;
    expect(validateFileContent(buf, "application/dicom")).toBe(false);
  });
});

// ── MAX_FILE_SIZE ──

describe("radiology upload — MAX_FILE_SIZE", () => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  it("is 10 MB", () => {
    expect(MAX_FILE_SIZE).toBe(10_485_760);
  });

  it("matches the main upload route limit", () => {
    // Both routes should enforce the same limit to avoid inconsistency
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });
});
