import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildUploadKey, isR2Configured } from "../r2";

describe("isR2Configured", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false when no R2 env vars set", () => {
    expect(isR2Configured()).toBe(false);
  });

  it("returns false when only some R2 env vars set", () => {
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    // Missing R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME
    expect(isR2Configured()).toBe(false);
  });

  it("returns true when all required R2 env vars set", () => {
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_BUCKET_NAME = "test-bucket";
    expect(isR2Configured()).toBe(true);
  });
});

describe("buildUploadKey", () => {
  it("builds a key with the correct format (filename hashed by default per R-16)", () => {
    const key = buildUploadKey("clinic-123", "logos", "photo.png");
    // R-16: filename portion is replaced by a 16-char hash, extension preserved
    expect(key).toMatch(/^clinics\/clinic-123\/logos\/\d+-[a-f0-9]{8}-[a-f0-9]{16}\.png$/);
  });

  it("preserves the original filename when hashFilename=false", () => {
    const key = buildUploadKey("clinic-123", "logos", "photo.png", false);
    expect(key).toMatch(/^clinics\/clinic-123\/logos\/\d+-[a-f0-9]{8}-photo\.png$/);
  });

  it("sanitizes clinic ID to prevent path traversal", () => {
    const key = buildUploadKey("../../../etc", "logos", "photo.png");
    expect(key).not.toContain("../");
    expect(key).toMatch(/^clinics\/_+etc/);
  });

  it("sanitizes category to prevent path traversal", () => {
    const key = buildUploadKey("clinic-1", "../../evil", "photo.png");
    expect(key).not.toContain("../");
  });

  it("sanitizes filename to prevent path traversal", () => {
    const key = buildUploadKey("clinic-1", "photos", "../../evil.js", false);
    expect(key).not.toContain("../");
    expect(key).toContain("evil.js");
  });

  it("strips path-traversal segments even when filename is hashed", () => {
    const key = buildUploadKey("clinic-1", "photos", "../../evil.js");
    expect(key).not.toContain("../");
    // Extension is preserved through the hash, but the original basename is gone.
    expect(key).toMatch(/\.js$/);
  });

  it("preserves valid characters in clinic ID", () => {
    const key = buildUploadKey("clinic-abc_123", "photos", "test.jpg");
    expect(key).toContain("clinic-abc_123");
  });

  it("preserves dots and hyphens in filename when hashFilename=false", () => {
    const key = buildUploadKey("clinic-1", "docs", "my-file.v2.pdf", false);
    expect(key).toContain("my-file.v2.pdf");
  });

  it("replaces spaces in filename with underscores when hashFilename=false", () => {
    const key = buildUploadKey("clinic-1", "photos", "my photo file.png", false);
    expect(key).toContain("my_photo_file.png");
  });

  it("generates unique keys for same inputs (timestamp + random)", () => {
    const key1 = buildUploadKey("clinic-1", "photos", "test.png");
    const key2 = buildUploadKey("clinic-1", "photos", "test.png");
    // Keys should differ due to random UUID suffix
    expect(key1).not.toBe(key2);
  });

  it("starts with 'clinics/' prefix", () => {
    const key = buildUploadKey("any-clinic", "any-category", "any-file.txt");
    expect(key.startsWith("clinics/")).toBe(true);
  });
});

// Audit finding #8 — the HMAC secret used for upload-key filename hashing
// must not fall back to a hardcoded "default-salt" in production. If the
// secret is missing at runtime, buildUploadKey() must throw rather than
// silently derive guessable PHI file paths.
describe("buildUploadKey secret enforcement (audit finding #8)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("throws in production when R2_SIGNED_URL_SECRET is missing", () => {
    delete process.env.R2_SIGNED_URL_SECRET;
    delete process.env.R2_SECRET_ACCESS_KEY;
    vi.stubEnv("NODE_ENV", "production");

    expect(() =>
      buildUploadKey("clinic-1", "documents", "file.pdf"),
    ).toThrow(/R2_SIGNED_URL_SECRET is required in production/);
  });

  it("does not silently derive a key from a hardcoded salt in production", () => {
    delete process.env.R2_SIGNED_URL_SECRET;
    delete process.env.R2_SECRET_ACCESS_KEY;
    vi.stubEnv("NODE_ENV", "production");

    // Regression guard: if a future refactor reintroduces a `|| "default-salt"`
    // fallback, this assertion will start returning a string and fail.
    expect(() => buildUploadKey("clinic-1", "documents", "file.pdf")).toThrow();
  });

  it("uses R2_SIGNED_URL_SECRET when set (production)", () => {
    process.env.R2_SIGNED_URL_SECRET = "a-real-production-secret-abcdef0123456789";
    delete process.env.R2_SECRET_ACCESS_KEY;
    vi.stubEnv("NODE_ENV", "production");

    const key = buildUploadKey("clinic-1", "documents", "file.pdf");
    expect(key).toMatch(/^clinics\/clinic-1\/documents\/\d+-[a-f0-9]{8}-[a-f0-9]{16}\.pdf$/);
  });
});
