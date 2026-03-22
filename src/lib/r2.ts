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

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

let _client: S3Client | null = null;
let _clientCreatedAt = 0;

/** FIX (MED-07): TTL for the S3Client singleton (60 seconds).
 * After credential rotation the stale client will be replaced
 * within this window instead of living forever. */
const CLIENT_TTL_MS = 60_000;

function getClient(): S3Client | null {
  const now = Date.now();
  if (_client && now - _clientCreatedAt < CLIENT_TTL_MS) return _client;

  const config = getR2Config();
  if (!config) return null;

  _client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  _clientCreatedAt = now;

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
  const client = getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  const params: PutObjectCommandInput = {
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
  const client = getClient();
  const config = getR2Config();
  if (!client || !config) return;

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
  maxSizeBytes: number = 10 * 1024 * 1024, // HIGH-07: Default 10 MB limit
): Promise<string | null> {
  const client = getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  // HIGH-07: Include ContentLength in the presigned URL to enforce size limits.
  // The presigned URL will only accept uploads up to maxSizeBytes.
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
    ContentLength: maxSizeBytes,
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
  const client = getClient();
  const config = getR2Config();
  if (!client || !config) return null;

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
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
