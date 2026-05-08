/**
 * Regression tests for finding #2 (CRITICAL): direct uploads must use a
 * presigned POST policy that R2 enforces at write time, not a presigned PUT
 * URL whose size limit can only be checked after the bytes are stored.
 *
 * Pre-fix bug: getPresignedUploadUrl() returned a presigned PUT URL. PUT
 * URLs cannot enforce `content-length-range`, so a malicious client could
 * upload an arbitrarily large file before the confirmation route ever ran.
 *
 * These tests assert the policy that R2 receives:
 *   - `content-length-range` with the requested maxSize (default 2 MB).
 *   - `eq $Content-Type` matching the requested contentType.
 * That policy is what causes oversized / wrong-type uploads to be rejected
 * *at upload time* (per Subtask 6 of Task 1.2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createPresignedPostMock = vi.fn(async () => ({
  url: "https://r2.example/bucket",
  fields: {
    bucket: "test-bucket",
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    Policy: "base64-policy",
    "X-Amz-Signature": "deadbeef",
  },
}));

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: createPresignedPostMock,
}));

vi.mock("@aws-sdk/client-s3", () => {
  class FakeS3Client {
    send = vi.fn();
  }
  class FakeCommand {
    constructor(public input: unknown) {}
  }
  return {
    S3Client: FakeS3Client,
    PutObjectCommand: FakeCommand,
    HeadObjectCommand: FakeCommand,
    GetObjectCommand: FakeCommand,
    DeleteObjectCommand: FakeCommand,
  };
});

describe("getPresignedUploadPost", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    createPresignedPostMock.mockClear();
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_BUCKET_NAME = "test-bucket";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns null when R2 is not configured", async () => {
    delete process.env.R2_ACCOUNT_ID;
    const { getPresignedUploadPost } = await import("../r2");
    const result = await getPresignedUploadPost(
      "clinics/abc/logos/file.png",
      "image/png",
    );
    expect(result).toBeNull();
    expect(createPresignedPostMock).not.toHaveBeenCalled();
  });

  it("locks the policy to the requested content-length-range", async () => {
    const { getPresignedUploadPost, DEFAULT_PRESIGNED_POST_MAX_SIZE } =
      await import("../r2");

    await getPresignedUploadPost(
      "clinics/abc/logos/file.png",
      "image/png",
    );

    expect(createPresignedPostMock).toHaveBeenCalledTimes(1);
    const [, params] = createPresignedPostMock.mock.calls[0] as unknown as [
      unknown,
      {
        Bucket: string;
        Key: string;
        Conditions: Array<unknown[]>;
        Fields: Record<string, string>;
        Expires: number;
      },
    ];

    expect(params.Bucket).toBe("test-bucket");
    expect(params.Key).toBe("clinics/abc/logos/file.png");

    // The default maxSize must match the public constant so tests catch
    // accidental drift between server-side enforcement and the route
    // handler's own MAX_FILE_SIZE constant.
    expect(DEFAULT_PRESIGNED_POST_MAX_SIZE).toBe(2 * 1024 * 1024);

    expect(params.Conditions).toContainEqual([
      "content-length-range",
      0,
      DEFAULT_PRESIGNED_POST_MAX_SIZE,
    ]);
  });

  it("locks the policy to the exact declared Content-Type", async () => {
    const { getPresignedUploadPost } = await import("../r2");

    await getPresignedUploadPost(
      "clinics/abc/photos/file.jpg",
      "image/jpeg",
    );

    const [, params] = createPresignedPostMock.mock.calls[0] as unknown as [
      unknown,
      {
        Conditions: Array<unknown[]>;
        Fields: Record<string, string>;
      },
    ];

    expect(params.Conditions).toContainEqual([
      "eq",
      "$Content-Type",
      "image/jpeg",
    ]);
    // The Content-Type field must be pre-populated so R2 can validate it
    // against the policy condition without the client choosing the value.
    expect(params.Fields["Content-Type"]).toBe("image/jpeg");
  });

  it("respects a caller-supplied maxSize (e.g. tighter per-route limit)", async () => {
    const { getPresignedUploadPost } = await import("../r2");

    const customMax = 512 * 1024; // 512 KB
    await getPresignedUploadPost(
      "clinics/abc/avatars/me.png",
      "image/png",
      customMax,
    );

    const [, params] = createPresignedPostMock.mock.calls[0] as unknown as [
      unknown,
      { Conditions: Array<unknown[]>; Expires: number },
    ];

    expect(params.Conditions).toContainEqual([
      "content-length-range",
      0,
      customMax,
    ]);
  });

  it("returns the URL, fields, and key for the client to POST", async () => {
    const { getPresignedUploadPost } = await import("../r2");

    const result = await getPresignedUploadPost(
      "clinics/abc/logos/file.png",
      "image/png",
    );

    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://r2.example/bucket");
    expect(result!.key).toBe("clinics/abc/logos/file.png");
    expect(result!.fields).toMatchObject({
      bucket: "test-bucket",
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      Policy: "base64-policy",
      "X-Amz-Signature": "deadbeef",
    });
  });
});
