/**
 * Tests for getPresignedUploadPost after the native-R2 migration.
 *
 * Native R2 has no presigned-POST primitive, so direct uploads now use a
 * presigned PUT URL signed with aws4fetch. A PUT URL cannot enforce a
 * `content-length-range` at write time, so the authoritative size + magic-byte
 * guard is the PUT /api/upload confirm step (HeadObject + per-category cap);
 * see src/app/api/upload/route.ts. These tests assert the new contract:
 *   - returns null when R2 S3 credentials are not configured,
 *   - signs a PUT request carrying the locked Content-Type / Content-Disposition,
 *   - returns the signed URL, an empty `fields` map, and the key.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("getPresignedUploadPost", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_BUCKET_NAME = "test-bucket";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns null when R2 credentials are not configured", async () => {
    delete process.env.R2_ACCOUNT_ID;
    const { getPresignedUploadPost } = await import("../r2");
    const result = await getPresignedUploadPost("clinics/abc/logos/file.png", "image/png");
    expect(result).toBeNull();
  });

  it("keeps DEFAULT_PRESIGNED_POST_MAX_SIZE at 2 MB for backward compatibility", async () => {
    const { DEFAULT_PRESIGNED_POST_MAX_SIZE } = await import("../r2");
    expect(DEFAULT_PRESIGNED_POST_MAX_SIZE).toBe(2 * 1024 * 1024);
  });

  it("signs a presigned PUT URL against the R2 S3 endpoint", async () => {
    const { getPresignedUploadPost } = await import("../r2");

    const result = await getPresignedUploadPost("clinics/abc/photos/file.jpg", "image/jpeg");

    expect(result).not.toBeNull();
    const u = new URL(result!.url);
    expect(u.host).toBe("test-account.r2.cloudflarestorage.com");
    expect(u.pathname).toBe("/test-bucket/clinics/abc/photos/file.jpg");
    // SigV4 query parameters must all be present.
    expect(u.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(u.searchParams.get("X-Amz-Credential")).toContain("test-key/");
    expect(u.searchParams.get("X-Amz-Date")).toMatch(/^\d{8}T\d{6}Z$/);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    // Content-Type + Content-Disposition are locked into the signature.
    const signedHeaders = u.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signedHeaders).toContain("content-type");
    expect(signedHeaders).toContain("content-disposition");
    expect(signedHeaders).toContain("host");
  });

  it("returns an empty fields map and the key", async () => {
    const { getPresignedUploadPost } = await import("../r2");

    const result = await getPresignedUploadPost("clinics/abc/logos/file.png", "image/png");

    expect(result).not.toBeNull();
    expect(result!.key).toBe("clinics/abc/logos/file.png");
    expect(result!.fields).toEqual({});
  });
});
