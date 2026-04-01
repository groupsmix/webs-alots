/**
 * Encrypted R2 Storage Operations
 *
 * Wraps R2 upload/download with AES-256-GCM encryption for patient files.
 * Used for PHI categories (prescriptions, lab results, x-rays, etc.)
 * to comply with Moroccan Law 09-08 data protection requirements.
 *
 * Encrypted files have a `.enc` suffix appended to their R2 key so that
 * the download path knows to decrypt before serving.
 */

import { uploadToR2, deleteFromR2 } from "@/lib/r2";
import { encryptBuffer, decryptBuffer, isEncryptionConfigured } from "@/lib/encryption";
import { logger } from "@/lib/logger";

/**
 * Encrypt a file and upload the ciphertext to R2.
 *
 * The R2 key gets a `.enc` suffix to signal that the stored object
 * is encrypted and must be decrypted on download.
 *
 * @param key         R2 object key (the `.enc` suffix is appended automatically)
 * @param plaintext   File contents as Buffer
 * @param contentType Original MIME type (stored as R2 metadata, not in the encrypted blob)
 * @returns Public URL of the encrypted object, or null on failure
 */
export async function encryptAndUpload(
  key: string,
  plaintext: Buffer | Uint8Array,
  contentType: string,
): Promise<string | null> {
  if (!isEncryptionConfigured()) {
    // In production, PHI MUST be encrypted to comply with Moroccan Law 09-08.
    // Silently falling back to plaintext would create a legal and data-breach risk
    // if the encryption key is accidentally unset. Fail hard to surface the issue.
    if (process.env.NODE_ENV === "production") {
      logger.error("PHI encryption not configured in production — aborting upload to prevent unencrypted PHI storage", {
        context: "r2-encrypted",
        key,
      });
      return null;
    }
    // Allow plaintext fallback only in development/test for convenience.
    logger.warn("PHI encryption not configured — uploading plaintext as fallback (non-production only)", {
      context: "r2-encrypted",
      key,
    });
    return uploadToR2(key, Buffer.from(plaintext), contentType);
  }

  const encrypted = await encryptBuffer(plaintext);
  if (!encrypted) {
    logger.error("Failed to encrypt file — aborting upload", {
      context: "r2-encrypted",
      key,
    });
    return null;
  }

  // Store as application/octet-stream since the content is encrypted.
  // The original contentType is preserved in the key naming convention
  // and can be looked up from the upload metadata in the database.
  const encKey = `${key}.enc`;
  return uploadToR2(encKey, encrypted, "application/octet-stream");
}

/**
 * Download an encrypted file from R2 and decrypt it.
 *
 * @param key  R2 object key (with or without `.enc` suffix)
 * @returns Decrypted file contents as Buffer, or null on failure
 */
export async function downloadAndDecrypt(
  key: string,
): Promise<Buffer | null> {
  if (!isEncryptionConfigured()) {
    logger.warn("PHI encryption not configured — cannot decrypt", {
      context: "r2-encrypted",
      key,
    });
    return null;
  }

  try {
    // Import getClient-level access for raw object download
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return null;
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const encKey = key.endsWith(".enc") ? key : `${key}.enc`;
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: encKey }),
    );

    if (!response.Body) return null;

    // Collect the stream into a buffer
    const chunks: Uint8Array[] = [];
    const body = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    const encrypted = Buffer.concat(chunks);

    return decryptBuffer(encrypted);
  } catch (err) {
    logger.error("Failed to download and decrypt file", {
      context: "r2-encrypted",
      key,
      error: err,
    });
    return null;
  }
}

/**
 * Delete an encrypted file from R2.
 *
 * @param key  R2 object key (with or without `.enc` suffix)
 */
export async function deleteEncrypted(key: string): Promise<void> {
  const encKey = key.endsWith(".enc") ? key : `${key}.enc`;
  return deleteFromR2(encKey);
}
