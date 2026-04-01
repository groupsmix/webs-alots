/**
 * Cloudflare R2 storage client.
 *
 * R2 is S3-compatible, so we use the AWS SDK v3.
 * Advantages over Supabase Storage:
 *   - Free tier: 10 GB storage, 10M class-A ops, no egress fees
 *   - Served via Cloudflare CDN edge network
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME       — R2 bucket name (e.g., "webs-alots-uploads")
 *   R2_PUBLIC_URL        — Public URL for the bucket (custom domain or r2.dev URL)
 */

import { logger } from "@/lib/logger";

// AWS SDK types — imported dynamically at runtime to keep the heavy SDK
// out of the main bundle (see PERF-01 audit finding).
type S3ClientType = import("@aws-sdk/client-s3").S3Client;
type PutObjectCommandInputType = import("@aws-sdk/client-s3").PutObjectCommandInput;

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
 * @param key    Object key (path in bucket, e.g., "clinics/abc/logo.png")
 * @param body   File contents as Buffer or ReadableStream
 * @param contentType  MIME type (e.g., "image/png")
 * @returns Public URL of the uploaded file, or null if R2 is not configured
 */
export async function uploadToR2(
  key: string,
  body: Buffer | ReadableStream | Uint8Array,
  contentType: string,
): Promise<string | null> {
  const client = await getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");

  const params: PutObjectCommandInputType = {
    Bucket: config.bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  await client.send(new PutObjectCommand(params));

  // Return public URL
  if (config.publicUrl) {
    return `${config.publicUrl.replace(/\/$/, "")}/${key}`;
  }

  // Fallback: no public URL configured
  return `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com/${key}`;
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
 * Generate a pre-signed URL for direct browser upload.
 * Allows clients to upload directly to R2 without going through the server.
 *
 * @param key          Object key
 * @param contentType  Expected MIME type
 * @param expiresIn    URL validity in seconds (default: 3600 = 1 hour)
 * @returns Pre-signed upload URL, or null if R2 is not configured
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 600,
): Promise<string | null> {
  const client = await getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  // HIGH-07: Do NOT set ContentLength here — it enforces an exact byte count,
  // not a maximum.  Files smaller than maxSizeBytes would be rejected by S3.
  // Size enforcement is handled server-side via the upload API route validation.
  //
  // S13-FIX: Set Content-Disposition to "attachment" so browsers will never
  // render uploaded files inline (prevents stored XSS via HTML/JS uploads
  // that bypass the server-side magic-byte validation).
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
    ContentDisposition: "attachment",
  });

  return getSignedUrl(client, command, { expiresIn });
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

  return getSignedUrl(client, command, { expiresIn });
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
  } catch (err) {
    logger.warn("Failed to read R2 object head", { context: "r2", key, error: err });
    return null;
  }
}

/**
 * Build the R2 object key for a clinic upload.
 *
 * Format: clinics/{clinicId}/{category}/{timestamp}-{filename}
 *
 * @param clinicId  Clinic UUID
 * @param category  Upload category (e.g., "logos", "photos", "documents")
 * @param filename  Original filename
 */
export function buildUploadKey(
  clinicId: string,
  category: string,
  filename: string,
): string {
  const timestamp = Date.now();
  // MED-06: Add a random suffix to prevent key collisions when two files
  // are uploaded in the same millisecond with the same filename.
  const rand = crypto.randomUUID().slice(0, 8);
  // Sanitize all path segments to prevent path-traversal (../ etc.)
  const safeClinicId = clinicId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `clinics/${safeClinicId}/${safeCategory}/${timestamp}-${rand}-${safeFilename}`;
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
  } catch (err) {
    logger.warn("Failed to build resized image URL", { context: "r2", srcUrl, error: err });
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
