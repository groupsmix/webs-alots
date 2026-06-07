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

import { encryptBuffer, decryptBuffer, isEncryptionConfigured } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { uploadToR2, deleteFromR2, getR2Bucket } from "@/lib/r2";

/**
 * Diagnostic / audit metadata threaded through encrypted upload calls.
 *
 * The values are NOT written into the encrypted blob (which would defeat
 * the purpose of encryption); they are surfaced in structured logs so PHI
 * upload activity can be traced back to a clinic, category and patient.
 */
export interface EncryptedUploadMetadata {
  clinicId?: string;
  category?: string;
  patientId?: string | null;
}

/**
 * Encrypt a file and upload the ciphertext to R2.
 *
 * The R2 key gets a `.enc` suffix to signal that the stored object
 * is encrypted and must be decrypted on download.
 *
 * @param key         R2 object key (the `.enc` suffix is appended automatically)
 * @param plaintext   File contents as Buffer
 * @param contentType Original MIME type (stored as R2 metadata, not in the encrypted blob)
 * @param metadata    Optional diagnostic context (clinicId, category, patientId)
 *                    used for audit logging only — never stored in the encrypted blob.
 * @returns Public URL of the encrypted object, or null on failure
 */
export async function encryptAndUpload(
  key: string,
  plaintext: Buffer | Uint8Array,
  contentType: string,
  metadata?: EncryptedUploadMetadata,
): Promise<string | null> {
  if (!isEncryptionConfigured()) {
    // In production, PHI MUST be encrypted to comply with Moroccan Law 09-08.
    // Silently falling back to plaintext would create a legal and data-breach risk
    // if the encryption key is accidentally unset. Fail hard to surface the issue.
    if (process.env.NODE_ENV === "production") {
      logger.error(
        "PHI encryption not configured in production — aborting upload to prevent unencrypted PHI storage",
        {
          context: "r2-encrypted",
          key,
          metadata,
        },
      );
      return null;
    }
    // Allow plaintext fallback only in development/test for convenience.
    logger.warn(
      "PHI encryption not configured — uploading plaintext as fallback (non-production only)",
      {
        context: "r2-encrypted",
        key,
        metadata,
      },
    );
    return uploadToR2(key, Buffer.from(plaintext), contentType);
  }

  let encrypted: Buffer;
  try {
    encrypted = await encryptBuffer(plaintext);
  } catch (err) {
    logger.error("Failed to encrypt file — aborting upload", {
      context: "r2-encrypted",
      key,
      metadata,
      error: err,
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
export async function downloadAndDecrypt(key: string): Promise<Buffer | null> {
  if (!isEncryptionConfigured()) {
    logger.warn("PHI encryption not configured — cannot decrypt", {
      context: "r2-encrypted",
      key,
    });
    return null;
  }

  try {
    // Native R2 binding: download the encrypted object directly from the
    // bound bucket. No AWS SDK / credentials required (see src/lib/r2.ts).
    const bucket = await getR2Bucket();
    if (!bucket) return null;

    const encKey = key.endsWith(".enc") ? key : `${key}.enc`;
    const object = await bucket.get(encKey);
    if (!object) return null;

    const encrypted = Buffer.from(await object.arrayBuffer());

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
