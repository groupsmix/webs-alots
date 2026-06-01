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
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const signMock = vi.fn(async (_url: string, _init: unknown) => ({
  url: "https://test-account.r2.cloudflarestorage.com/test-bucket/clinics/abc/logos/file.png?X-Amz-Signature=deadbeef",
}));

vi.mock("aws4fetch", () => ({
  AwsClient: class {
    sign = signMock;
  },
}));

describe("getPresignedUploadPost", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    signMock.mockClear();
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
    expect(signMock).not.toHaveBeenCalled();
  });

  it("keeps DEFAULT_PRESIGNED_POST_MAX_SIZE at 2 MB for backward compatibility", async () => {
    const { DEFAULT_PRESIGNED_POST_MAX_SIZE } = await import("../r2");
    expect(DEFAULT_PRESIGNED_POST_MAX_SIZE).toBe(2 * 1024 * 1024);
  });

  it("signs a PUT request with the locked Content-Type and Content-Disposition", async () => {
    const { getPresignedUploadPost } = await import("../r2");

    await getPresignedUploadPost("clinics/abc/photos/file.jpg", "image/jpeg");

    expect(signMock).toHaveBeenCalledTimes(1);
    const [, init] = signMock.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string> },
    ];
    expect(init.method).toBe("PUT");
    expect(init.headers["Content-Type"]).toBe("image/jpeg");
    expect(init.headers["Content-Disposition"]).toBe("attachment");
  });

  it("returns the signed URL, an empty fields map, and the key", async () => {
    const { getPresignedUploadPost } = await import("../r2");

    const result = await getPresignedUploadPost("clinics/abc/logos/file.png", "image/png");

    expect(result).not.toBeNull();
    expect(result!.url).toContain("r2.cloudflarestorage.com");
    expect(result!.key).toBe("clinics/abc/logos/file.png");
    expect(result!.fields).toEqual({});
  });
});
