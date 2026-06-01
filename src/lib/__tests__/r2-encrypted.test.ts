/**
 * Tests for src/lib/r2-encrypted.ts
 *
 * Covers:
 *   - encryptAndUpload: encryption path, plaintext fallback in dev, production block
 *   - downloadAndDecrypt: decryption path, missing config, missing R2 env vars
 *   - Key suffix handling (.enc appended/detected)
 *   - Error paths for failed encryption/decryption
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockUploadToR2 = vi.fn();
const mockDeleteFromR2 = vi.fn();
const mockGetR2Bucket = vi.fn();

vi.mock("@/lib/r2", () => ({
  uploadToR2: (...args: unknown[]) => mockUploadToR2(...args),
  deleteFromR2: (...args: unknown[]) => mockDeleteFromR2(...args),
  getR2Bucket: () => mockGetR2Bucket(),
}));

const mockEncryptBuffer = vi.fn();
const mockDecryptBuffer = vi.fn();
const mockIsEncryptionConfigured = vi.fn();

vi.mock("@/lib/encryption", () => ({
  encryptBuffer: (...args: unknown[]) => mockEncryptBuffer(...args),
  decryptBuffer: (...args: unknown[]) => mockDecryptBuffer(...args),
  isEncryptionConfigured: () => mockIsEncryptionConfigured(),
}));

// Native R2 binding: downloadAndDecrypt() calls getR2Bucket().get(key).
// We model the bucket as an object exposing a `get` mock whose resolved
// value mimics an R2ObjectBody (arrayBuffer()).
const mockBucketGet = vi.fn();
function fakeR2Object(buf: Buffer) {
  return {
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

const originalEnv = { ...process.env };

// ── Tests ────────────────────────────────────────────────────────────

describe("encryptAndUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("encrypts and uploads with .enc suffix when encryption is configured", async () => {
    mockIsEncryptionConfigured.mockReturnValue(true);
    const encryptedData = Buffer.from("encrypted-content");
    mockEncryptBuffer.mockResolvedValueOnce(encryptedData);
    mockUploadToR2.mockResolvedValueOnce("https://r2.example.com/files/test.pdf.enc");

    const { encryptAndUpload } = await import("@/lib/r2-encrypted");
    const result = await encryptAndUpload(
      "files/test.pdf",
      Buffer.from("plain content"),
      "application/pdf",
      { clinicId: "clinic-1", category: "prescriptions" },
    );

    expect(result).toBe("https://r2.example.com/files/test.pdf.enc");
    expect(mockEncryptBuffer).toHaveBeenCalledOnce();
    expect(mockUploadToR2).toHaveBeenCalledWith(
      "files/test.pdf.enc",
      encryptedData,
      "application/octet-stream",
    );
  });

  it("returns null and logs error when encryption fails", async () => {
    mockIsEncryptionConfigured.mockReturnValue(true);
    mockEncryptBuffer.mockRejectedValueOnce(new Error("encryption failed"));

    const { encryptAndUpload } = await import("@/lib/r2-encrypted");
    const result = await encryptAndUpload(
      "files/test.pdf",
      Buffer.from("plain content"),
      "application/pdf",
    );

    expect(result).toBeNull();
    expect(mockUploadToR2).not.toHaveBeenCalled();
  });

  it("falls back to plaintext upload in non-production when encryption is not configured", async () => {
    mockIsEncryptionConfigured.mockReturnValue(false);
    (process.env as Record<string, string>).NODE_ENV = "test";
    mockUploadToR2.mockResolvedValueOnce("https://r2.example.com/files/test.pdf");

    const { encryptAndUpload } = await import("@/lib/r2-encrypted");
    const result = await encryptAndUpload(
      "files/test.pdf",
      Buffer.from("plain content"),
      "application/pdf",
    );

    expect(result).toBe("https://r2.example.com/files/test.pdf");
    // Should upload without .enc suffix and with original content type
    expect(mockUploadToR2).toHaveBeenCalledWith(
      "files/test.pdf",
      expect.any(Buffer),
      "application/pdf",
    );
    expect(mockEncryptBuffer).not.toHaveBeenCalled();
  });

  it("returns null in production when encryption is not configured", async () => {
    mockIsEncryptionConfigured.mockReturnValue(false);
    (process.env as Record<string, string>).NODE_ENV = "production";

    const { encryptAndUpload } = await import("@/lib/r2-encrypted");
    const result = await encryptAndUpload(
      "files/test.pdf",
      Buffer.from("plain content"),
      "application/pdf",
    );

    expect(result).toBeNull();
    expect(mockUploadToR2).not.toHaveBeenCalled();
    expect(mockEncryptBuffer).not.toHaveBeenCalled();
  });

  it("passes metadata for audit logging only", async () => {
    mockIsEncryptionConfigured.mockReturnValue(true);
    mockEncryptBuffer.mockResolvedValueOnce(Buffer.from("encrypted"));
    mockUploadToR2.mockResolvedValueOnce("https://r2.example.com/file.enc");

    const { encryptAndUpload } = await import("@/lib/r2-encrypted");
    const metadata = { clinicId: "clinic-1", category: "lab_results", patientId: "patient-1" };

    await encryptAndUpload("file.pdf", Buffer.from("data"), "application/pdf", metadata);

    // Metadata should NOT be passed to uploadToR2 (not stored in encrypted blob)
    const uploadArgs = mockUploadToR2.mock.calls[0];
    expect(uploadArgs).toHaveLength(3);
  });
});

describe("downloadAndDecrypt", () => {
  beforeEach(() => {
    mockBucketGet.mockReset();
    mockGetR2Bucket.mockReset();
    mockIsEncryptionConfigured.mockReset();
    mockDecryptBuffer.mockReset();
    process.env = { ...originalEnv };
    process.env.R2_BUCKET_NAME = "test-bucket";
    // Default: a working bucket binding whose get() is driven per-test.
    mockGetR2Bucket.mockReturnValue({ get: (...a: unknown[]) => mockBucketGet(...a) });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns null when encryption is not configured", async () => {
    mockIsEncryptionConfigured.mockReturnValue(false);

    const { downloadAndDecrypt } = await import("@/lib/r2-encrypted");
    const result = await downloadAndDecrypt("files/test.pdf");

    expect(result).toBeNull();
  });

  it("returns null when the R2 binding is unavailable", async () => {
    mockIsEncryptionConfigured.mockReturnValue(true);
    mockGetR2Bucket.mockReturnValue(null);

    const { downloadAndDecrypt } = await import("@/lib/r2-encrypted");
    const result = await downloadAndDecrypt("files/test.pdf");

    expect(result).toBeNull();
  });

  it("downloads and decrypts successfully", async () => {
    mockIsEncryptionConfigured.mockReturnValue(true);
    const encryptedContent = Buffer.from("encrypted-data");
    const decryptedContent = Buffer.from("decrypted-data");

    mockBucketGet.mockResolvedValueOnce(fakeR2Object(encryptedContent));
    mockDecryptBuffer.mockResolvedValueOnce(decryptedContent);

    const { downloadAndDecrypt } = await import("@/lib/r2-encrypted");
    const result = await downloadAndDecrypt("files/test.pdf");

    expect(result).toEqual(decryptedContent);
    expect(mockDecryptBuffer).toHaveBeenCalledOnce();
  });

  it("appends .enc suffix if not present", async () => {
    mockIsEncryptionConfigured.mockReturnValue(true);
    mockBucketGet.mockResolvedValueOnce(fakeR2Object(Buffer.from("data")));
    mockDecryptBuffer.mockResolvedValueOnce(Buffer.from("decrypted"));

    const { downloadAndDecrypt } = await import("@/lib/r2-encrypted");
    await downloadAndDecrypt("files/test.pdf");

    expect(mockBucketGet).toHaveBeenCalledOnce();
    expect(mockBucketGet.mock.calls[0][0]).toBe("files/test.pdf.enc");
  });

  it("does not double-append .enc suffix", async () => {
    mockIsEncryptionConfigured.mockReturnValue(true);
    mockBucketGet.mockResolvedValueOnce(fakeR2Object(Buffer.from("data")));
    mockDecryptBuffer.mockResolvedValueOnce(Buffer.from("decrypted"));

    const { downloadAndDecrypt } = await import("@/lib/r2-encrypted");
    await downloadAndDecrypt("files/test.pdf.enc");

    expect(mockBucketGet.mock.calls[0][0]).toBe("files/test.pdf.enc");
  });

  it("returns null when the object does not exist", async () => {
    mockIsEncryptionConfigured.mockReturnValue(true);
    mockBucketGet.mockResolvedValueOnce(null);

    const { downloadAndDecrypt } = await import("@/lib/r2-encrypted");
    const result = await downloadAndDecrypt("files/test.pdf");

    expect(result).toBeNull();
  });

  it("returns null and logs error when the bucket get throws", async () => {
    mockIsEncryptionConfigured.mockReturnValue(true);
    mockBucketGet.mockRejectedValueOnce(new Error("Network error"));

    const { downloadAndDecrypt } = await import("@/lib/r2-encrypted");
    const result = await downloadAndDecrypt("files/test.pdf");

    expect(result).toBeNull();
  });
});
