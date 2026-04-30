/**
 * Cloudflare R2 storage client.
 *
 * R2 is S3-compatible, so we use the AWS SDK v3.
 * Advantages over Supabase Storage:
 *   - Free tier: 10 GB storage, 10M class-A ops, no egress fees
 *   - Served via Cloudflare CDN edge network
 *
 * Security (R-16 Fix):
 *   - By default, files are served via signed URLs through a Cloudflare Worker
 *   - User-uploaded files are NEVER placed in a public bucket
 *   - Filenames are hashed on write to prevent guessable URLs
 *   - For truly public assets (clinic logos, marketing images), use a separate
 *     "webs-alots-public" bucket and NEVER put user-uploaded files there
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME       — R2 bucket name (e.g., "webs-alots-uploads")
 *   R2_PUBLIC_URL        — (Deprecated) Legacy public URL; use signed URLs instead
 *   R2_SIGNED_URL_SECRET — Secret for generating per-request signed URLs and
 *                          hashing upload filenames. **Required in production.**
 *                          Must be a high-entropy random string (e.g. `openssl rand -hex 32`).
 *                          Rotate per `docs/SOP-SECRET-ROTATION.md` §8.
 */

import { createHmac } from "crypto";
import { logger } from "@/lib/logger";

/**
 * Resolve the HMAC secret used for R2 signed URLs and upload-key filename
 * hashing.
 *
 * Audit finding #8: production must never fall back to a hardcoded salt. The
 * same applies to falling back to the R2 access key, since that couples URL
 * signing to the AWS credential (rotating one forces rotating the other).
 *
 * Behaviour:
 *   - Returns `R2_SIGNED_URL_SECRET` when set.
 *   - In production, throws if the variable is missing. Startup validation in
 *     `src/lib/env.ts` should have already prevented the server from booting,
 *     but this is defense-in-depth for code paths that run before or outside
 *     the instrumentation hook.
 *   - In non-production environments, falls back to `R2_SECRET_ACCESS_KEY` for
 *     developer convenience (historical behaviour). If neither is set, throws
 *     with a helpful error rather than silently using a shared constant.
 */
function getR2SigningSecret(): string {
  const keySecret = process.env.R2_SIGNED_URL_SECRET;
  if (keySecret) return keySecret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "R2_SIGNED_URL_SECRET is required in production. " +
        "Generate one with `openssl rand -hex 32` and deploy it as a Cloudflare Worker secret.",
    );
  }

  const fallback = process.env.R2_SECRET_ACCESS_KEY;
  if (!fallback) {
    throw new Error(
      "R2 signing secret is missing. Set R2_SIGNED_URL_SECRET in your .env.local " +
        "(or R2_SECRET_ACCESS_KEY for historical compatibility in development).",
    );
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Signed URL Generation (R-16 Fix)
// ---------------------------------------------------------------------------
// Instead of using R2_PUBLIC_URL directly, we generate per-request signed URLs
// with a short expiration. This ensures files are only accessible to authorized users.

/**
 * Generate a signed URL for R2 object access.
 * The URL includes HMAC signature for per-request authorization.
 *
 * @param key        Object key
 * @param expiresIn  URL validity in seconds (default: 3600 = 1 hour)
 * @returns Signed URL that validates against the secret
 */
export function generateSignedR2Url(key: string, expiresIn = 3600): string {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !bucketName) {
    // R2 is not configured — return a best-effort placeholder URL.
    // Callers should check isR2Configured() before using signed URLs.
    logger.warn("generateSignedR2Url called but R2 is not fully configured", { context: "r2", key });
    return `https://r2-not-configured.invalid/${key}`;
  }

  const secret = getR2SigningSecret();

  // R-16 Fix: Generate HMAC-signed URL for per-request authorization.
  // The signature covers (bucket, key, expires) so an attacker who obtains a
  // valid URL cannot tamper with the bucket parameter to access a different
  // R2 bucket while keeping the signature valid.
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const signatureBase = `${bucketName}:${key}:${expiresAt}`;
  const signature = createHmac("sha256", secret).update(signatureBase).digest("hex").slice(0, 32);

  // URL format: https://{domain}/r2/{bucket}/{key}?expires={expires}&sig={signature}
  const baseUrl = process.env.R2_SIGNED_URL_BASE || `https://oltigo.com/r2`;
  const params = new URLSearchParams({
    b: bucketName,
    k: key,
    e: expiresAt.toString(),
    s: signature,
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Validate a signed URL's signature.
 * Used by the R2 proxy worker to authorize requests.
 *
 * The signature base includes the bucket so a valid URL for one bucket cannot
 * be replayed against another by tampering with the `b` query parameter.
 *
 * @param bucket     Bucket name from URL (`b` query parameter)
 * @param key        Object key from URL
 * @param expires    Expiration timestamp from URL
 * @param signature  HMAC signature from URL
 * @returns true if the signature is valid and not expired
 */
export function validateSignedR2Url(
  bucket: string,
  key: string,
  expires: number,
  signature: string,
): boolean {
  // Check expiration
  if (Math.floor(Date.now() / 1000) > expires) {
    return false;
  }

  let secret: string;
  try {
    secret = getR2SigningSecret();
  } catch {
    // Misconfiguration — reject rather than accept unsigned URLs.
    return false;
  }

  const signatureBase = `${bucket}:${key}:${expires}`;
  const expectedSignature = createHmac("sha256", secret).update(signatureBase).digest("hex").slice(0, 32);

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) return false;
  let match = 0;
  for (let i = 0; i < signature.length; i++) {
    match |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return match === 0;
}

// AWS SDK types — imported dynamically at runtime to keep the heavy SDK
// out of the main bundle (see PERF-01 audit finding).
type S3ClientType = import("@aws-sdk/client-s3").S3Client;
type PutObjectCommandInputType = import("@aws-sdk/client-s3").PutObjectCommandInput;

/**
 * Default maximum size enforced by direct-upload presigned POST policies.
 * Individual call-sites may pass a smaller bound when they know the
 * acceptable upper limit for that upload kind.
 */
export const DEFAULT_PRESIGNED_POST_MAX_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Returned by {@link getPresignedUploadPost}. Clients submit the file as the
 * `file` field of a `multipart/form-data` POST to `url`, including every
 * field returned in `fields`.
 */
export interface PresignedUploadPost {
  url: string;
  fields: Record<string, string>;
  key: string;
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

let _client: S3ClientType | null = null;
let _lastConfigHash = "";

async function getClient(): Promise<S3ClientType | null> {
  const config = getR2Config();
  if (!config) return null;

  // Rebuild the client whenever credentials or config change,
  // ensuring stale credentials are never used after rotation.
  const configHash = `${config.accountId}:${config.accessKeyId}:${config.bucketName}`;
  if (_client && configHash === _lastConfigHash) return _client;

  const { S3Client } = await import("@aws-sdk/client-s3");

  _lastConfigHash = configHash;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return _client;
}

/**
 * Check if R2 is configured and available.
 */
export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

/**
 * Upload a file to R2.
 *
 * Returns a stable URL for the uploaded object that callers can persist in the
 * database. If `R2_PUBLIC_URL` is configured, the public URL is returned;
 * otherwise the underlying R2 storage URL is returned. Callers that need
 * authorization should generate signed URLs at read time using
 * {@link generateSignedR2Url} or {@link getPresignedDownloadUrl} rather than
 * relying on the URL returned here.
 *
 * @param key    Object key (path in bucket, e.g., "clinics/abc/logo.png")
 * @param body   File contents as Buffer or ReadableStream
 * @param contentType  MIME type (e.g., "image/png")
 * @param options  Optional settings (hashFilename for R-16 fix)
 * @returns Stable URL of the uploaded file, or null if R2 is not configured
 */
export async function uploadToR2(
  key: string,
  body: Buffer | ReadableStream | Uint8Array,
  contentType: string,
  options: { hashFilename?: boolean } = {},
): Promise<string | null> {
  const client = await getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");

  // R-16 Fix: Hash filenames on write so guessable basenames don't survive to the URL
  // This prevents enumeration attacks where attackers guess filenames
  let finalKey = key;
  if (options.hashFilename) {
    finalKey = hashFilename(key);
    logger.info("R2 filename hashed for security", {
      context: "r2",
      originalKey: key,
      hashedKey: finalKey,
    });
  }

  const params: PutObjectCommandInputType = {
    Bucket: config.bucketName,
    Key: finalKey,
    Body: body,
    ContentType: contentType,
  };

  try {
    await client.send(new PutObjectCommand(params));
  } catch (err) {
    // A84-F3: Surface R2 upload failures with a structured log entry so
    // operators can correlate storage outages (disk-full, network, auth)
    // without leaking internal details to the caller.
    logger.error("R2 upload failed", {
      context: "r2",
      key: finalKey,
      contentType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Return a stable URL so callers can persist it. Callers that serve PHI or
  // other sensitive content should generate short-lived signed URLs at read
  // time via generateSignedR2Url() / getPresignedDownloadUrl() rather than
  // relying on the public URL.
  if (config.publicUrl) {
    return `${config.publicUrl.replace(/\/$/, "")}/${finalKey}`;
  }
  return `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com/${finalKey}`;
}

/**
 * Hash the filename portion of a key to prevent guessable URLs.
 * R-16 Fix: Replaces user-supplied basenames with a hash.
 *
 * @param key Original object key
 * @returns Key with hashed filename portion
 */
function hashFilename(key: string): string {
  // Extract directory and filename
  const lastSlash = key.lastIndexOf("/");
  const directory = lastSlash > 0 ? key.substring(0, lastSlash) : "";
  const filename = lastSlash > 0 ? key.substring(lastSlash + 1) : key;

  // Hash the filename while preserving extension
  const dotIndex = filename.lastIndexOf(".");
  const extension = dotIndex > 0 ? filename.substring(dotIndex) : "";

  const hash = createHmac("sha256", getR2SigningSecret())
    .update(filename + Date.now().toString())
    .digest("hex")
    .slice(0, 16);

  return directory ? `${directory}/${hash}${extension}` : `${hash}${extension}`;
}

/**
 * Delete a file from R2.
 *
 * @param key  Object key to delete
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = await getClient();
  const config = getR2Config();
  if (!client || !config) return;

  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
  );
}

/**
 * Generate a pre-signed POST policy for direct browser upload.
 *
 * Audit 3.7 / HIGH-07 Fix: PUT pre-signed URLs cannot enforce a maximum object
 * size — a malicious client could upload multi-gigabyte files before the
 * server confirmation route ever runs. Presigned POST policies *can* enforce
 * size via the `content-length-range` condition, so R2 itself rejects
 * oversized uploads at write time rather than after the fact.
 *
 * The returned `fields` must be sent verbatim as `multipart/form-data` fields
 * alongside the file (which goes in a final `file` part). The S3/R2 server
 * validates the policy before accepting any bytes.
 *
 * Conditions enforced server-side by R2:
 *   - `content-length-range`: file size must be within `[0, maxSize]`.
 *   - `eq $Content-Type`: declared MIME type must match `contentType` exactly.
 *
 * S13-FIX: `Content-Disposition: attachment` is locked into the policy so
 * browsers never render uploaded files inline (defense-in-depth against
 * stored XSS via HTML/JS uploads that bypass magic-byte validation).
 *
 * @param key          Object key
 * @param contentType  Expected MIME type (locked into the POST policy)
 * @param maxSize      Maximum bytes accepted (default: 2 MB)
 * @param expiresIn    Policy validity in seconds (default: 600 = 10 min)
 * @returns Presigned POST URL + fields, or null if R2 is not configured
 */
export async function getPresignedUploadPost(
  key: string,
  contentType: string,
  maxSize: number = DEFAULT_PRESIGNED_POST_MAX_SIZE,
  expiresIn = 600,
): Promise<PresignedUploadPost | null> {
  const client = await getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  const { createPresignedPost } = await import("@aws-sdk/s3-presigned-post");

  const presigned = await createPresignedPost(client, {
    Bucket: config.bucketName,
    Key: key,
    Conditions: [
      ["content-length-range", 0, maxSize],
      ["eq", "$Content-Type", contentType],
      ["eq", "$Content-Disposition", "attachment"],
    ],
    Fields: {
      "Content-Type": contentType,
      "Content-Disposition": "attachment",
    },
    Expires: expiresIn,
  });

  return {
    url: presigned.url,
    fields: presigned.fields,
    key,
  };
}

/**
 * Generate a pre-signed URL for downloading a private file.
 *
 * @param key        Object key
 * @param expiresIn  URL validity in seconds (default: 3600 = 1 hour)
 * @returns Pre-signed download URL, or null if R2 is not configured
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string | null> {
  const client = await getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  // S13-FIX: Set Content-Disposition to "attachment" so browsers will always
  // download the file rather than rendering it inline. This prevents stored XSS
  // attacks where a malicious HTML file that bypasses magic-byte validation could
  // be rendered in the context of the R2 storage domain.
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ResponseContentDisposition: "attachment",
  });

  // Audit 8.2: We do not log the download here because getPresignedDownloadUrl 
  // only generates the URL, it doesn't mean the file was actually downloaded.
  // The actual download access log should be tracked via Cloudflare Logpush 
  // on the R2 bucket or a dedicated download proxy route.

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Object metadata retrieved from R2 via HeadObject.
 */
export interface R2ObjectMetadata {
  contentLength: number;
  contentType: string | null;
}

/**
 * Fetch object metadata (size + content type) from R2 without downloading the
 * body. Used by the upload confirmation route to validate that a direct
 * upload actually matched the declared content-type and size, even though the
 * presigned POST policy already enforces these server-side.
 *
 * Returns `null` if the object does not exist or R2 is not configured.
 */
export async function getR2ObjectMetadata(
  key: string,
): Promise<R2ObjectMetadata | null> {
  const client = await getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      }),
    );
    return {
      contentLength: response.ContentLength ?? 0,
      contentType: response.ContentType ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * List objects stored in R2 under the given key prefix, paginating over every
 * page returned by `ListObjectsV2`. Used by the cleanup library
 * (`r2-cleanup.ts`) to enumerate uploads for orphan reconciliation without
 * caring about the 1 000-key page limit enforced by S3-compatible APIs.
 *
 * Returns an empty array when R2 is not configured so callers can safely
 * invoke it during smoke runs without triggering credential errors.
 *
 * @param prefix    R2 key prefix to scan (e.g. `"clinics/"`). Required — an
 *                  empty prefix would enumerate the entire bucket.
 * @param opts.limit     Optional hard cap on the total number of keys
 *                       returned across all pages. Defaults to no cap.
 * @param opts.pageSize  Page size forwarded as `MaxKeys` (default: 1 000,
 *                       the S3 maximum).
 */
export async function listR2Objects(
  prefix: string,
  opts: { limit?: number; pageSize?: number } = {},
): Promise<string[]> {
  const client = await getClient();
  const config = getR2Config();
  if (!client || !config) return [];

  const limit = opts.limit ?? Number.POSITIVE_INFINITY;
  const pageSize = opts.pageSize ?? 1000;
  if (limit <= 0) return [];

  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");

  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: prefix,
        MaxKeys: pageSize,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of response.Contents ?? []) {
      if (typeof obj.Key === "string") {
        keys.push(obj.Key);
        if (keys.length >= limit) return keys;
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken ?? undefined : undefined;
  } while (continuationToken);

  return keys;
}

/**
 * Read the first N bytes of an object from R2 for content validation.
 *
 * @param key      Object key
 * @param bytes    Number of bytes to read (default: 16)
 * @returns Buffer with the first bytes, or null if not found / not configured
 */
export async function readR2ObjectHead(
  key: string,
  bytes = 16,
): Promise<Buffer | null> {
  const client = await getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  const { GetObjectCommand } = await import("@aws-sdk/client-s3");

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Range: `bytes=0-${bytes - 1}`,
  });

  try {
    const response = await client.send(command);
    if (!response.Body) return null;
    const chunks: Uint8Array[] = [];
    // @ts-expect-error -- Body is a Readable stream in Node.js
    for await (const chunk of response.Body) {
      chunks.push(chunk as Uint8Array);
    }
    return Buffer.concat(chunks);
  } catch {
    logger.warn("Failed to read R2 object head", { context: "r2", key });
    return null;
  }
}

/**
 * Build the R2 object key for a clinic upload.
 *
 * Format: clinics/{clinicId}/{category}/{timestamp}-{randomSuffix}-{hashedFilename}
 *
 * R-16 Fix: Filenames are hashed on write to prevent guessable URLs.
 *
 * @param clinicId  Clinic UUID
 * @param category  Upload category (e.g., "logos", "photos", "documents")
 * @param filename  Original filename
 * @param hashFilename  Whether to hash the filename (default: true for security)
 */
export function buildUploadKey(
  clinicId: string,
  category: string,
  filename: string,
  hashFilename = true,
): string {
  const timestamp = Date.now();
  // MED-06: Add a random suffix to prevent key collisions when two files
  // are uploaded in the same millisecond with the same filename.
  const rand = crypto.randomUUID().slice(0, 8);

  // Sanitize all path segments to prevent path-traversal (../ etc.)
  const safeClinicId = clinicId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  // R-16 Fix: Hash the filename to prevent guessable URLs
  // Even if an attacker knows the clinic ID, category, and timestamp,
  // they cannot guess the final filename without knowing the secret
  let finalFilename = safeFilename;
  if (hashFilename) {
    const dotIndex = safeFilename.lastIndexOf(".");
    const extension = dotIndex > 0 ? safeFilename.substring(dotIndex) : "";

    const hash = createHmac("sha256", getR2SigningSecret())
      .update(safeFilename + timestamp.toString())
      .digest("hex")
      .slice(0, 16);

    finalFilename = `${hash}${extension}`;
  }

  return `clinics/${safeClinicId}/${safeCategory}/${timestamp}-${rand}-${finalFilename}`;
}

// ── Image Resizing Utilities ──

/** Standard thumbnail widths for responsive images. */
export const IMAGE_WIDTHS = [100, 300, 800] as const;

/**
 * Build a Cloudflare Image Resizing URL for a given source image.
 *
 * Cloudflare Image Resizing transforms images on the fly at the CDN edge
 * (no server-side processing or extra storage needed). It works with any
 * image served through Cloudflare — including R2 public URLs.
 *
 * @param srcUrl   Original image URL (must be proxied through Cloudflare)
 * @param width    Desired width in pixels
 * @param options  Additional Image Resizing options
 * @returns Transformed image URL, or original URL if not an http(s) URL
 *
 * @see https://developers.cloudflare.com/images/transform-images/transform-via-url/
 */
export function getResizedImageUrl(
  srcUrl: string,
  width: number,
  options: { quality?: number; fit?: "scale-down" | "contain" | "cover" | "crop" | "pad"; format?: "auto" | "webp" | "avif" } = {},
): string {
  if (!srcUrl.startsWith("http")) return srcUrl;

  const { quality = 80, fit = "cover", format = "auto" } = options;

  try {
    const url = new URL(srcUrl);
    // Cloudflare Image Resizing URL format: /cdn-cgi/image/{options}/{path}
    const optionsPart = `width=${width},quality=${quality},fit=${fit},format=${format}`;
    return `${url.origin}/cdn-cgi/image/${optionsPart}${url.pathname}`;
  } catch {
    logger.warn("Failed to build resized image URL", { context: "r2", srcUrl });
    return srcUrl;
  }
}

/**
 * Generate a `sizes` attribute and srcSet-like map for responsive images.
 * Returns thumbnail URLs for the standard widths (100, 300, 800px).
 */
export function getResponsiveImageUrls(srcUrl: string): Record<number, string> {
  const urls: Record<number, string> = {};
  for (const w of IMAGE_WIDTHS) {
    urls[w] = getResizedImageUrl(srcUrl, w);
  }
  return urls;
}
