/**
 * AES-256-GCM Encryption for Patient Files (PHI)
 *
 * Encrypts patient documents (prescriptions, lab results, x-rays) before
 * uploading to R2 storage, ensuring compliance with Moroccan Law 09-08
 * for protection of personal health information at rest.
 *
 * Uses the Web Crypto API (available in Edge runtimes and Node.js 18+).
 *
 * Key management:
 *   - PHI_ENCRYPTION_KEY env var holds a hex-encoded 256-bit master key
 *   - Generate with: openssl rand -hex 32
 *   - Each file gets a unique random IV (96 bits) prepended to the ciphertext
 *
 * Encrypted format: [12-byte IV][ciphertext + GCM auth tag]
 */

import { logger } from "@/lib/logger";

// ── Key Management ──

/**
 * Derive a CryptoKey from the hex-encoded master key in environment.
 * Returns null if PHI_ENCRYPTION_KEY is not configured.
 */
async function getEncryptionKey(): Promise<CryptoKey | null> {
  const hexKey = process.env.PHI_ENCRYPTION_KEY;
  if (!hexKey) {
    return null;
  }

  // Validate key length (64 hex chars = 32 bytes = 256 bits)
  if (hexKey.length !== 64) {
    logger.error("PHI_ENCRYPTION_KEY must be exactly 64 hex characters (256 bits)", {
      context: "encryption",
    });
    return null;
  }

  const keyBytes = new Uint8Array(
    hexKey.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  );

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Check if PHI encryption is configured and available.
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.PHI_ENCRYPTION_KEY;
}

// ── Encrypt / Decrypt ──

/**
 * Encrypt a buffer using AES-256-GCM.
 *
 * Returns the encrypted data with the IV prepended:
 *   [12-byte IV][ciphertext + 16-byte GCM auth tag]
 *
 * Returns null if encryption is not configured.
 */
export async function encryptBuffer(
  plaintext: Buffer | Uint8Array,
): Promise<Buffer | null> {
  const key = await getEncryptionKey();
  if (!key) return null;

  // Generate a random 96-bit IV for each encryption operation
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new Uint8Array(plaintext),
  );

  // Prepend IV to ciphertext for self-contained decryption
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);

  return Buffer.from(result);
}

/**
 * Decrypt a buffer that was encrypted with `encryptBuffer`.
 *
 * Expects the format: [12-byte IV][ciphertext + GCM auth tag]
 *
 * Returns null if decryption fails or encryption is not configured.
 */
export async function decryptBuffer(
  encrypted: Buffer | Uint8Array,
): Promise<Buffer | null> {
  const key = await getEncryptionKey();
  if (!key) return null;

  if (encrypted.length < 13) {
    logger.error("Encrypted data too short — missing IV or ciphertext", {
      context: "encryption",
    });
    return null;
  }

  // Extract IV (first 12 bytes) and ciphertext (remainder)
  const iv = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    return Buffer.from(plaintext);
  } catch (err) {
    logger.error("AES-GCM decryption failed — wrong key or corrupted data", {
      context: "encryption",
      error: err,
    });
    return null;
  }
}

// ── Patient File Categories Requiring Encryption ──

/**
 * Upload categories that contain Protected Health Information (PHI)
 * and must be encrypted at rest per Moroccan Law 09-08.
 */
export const PHI_CATEGORIES = new Set([
  "documents",
  "prescriptions",
  "lab-results",
  "lab_results",
  "x-rays",
  "xrays",
  "medical-records",
  "medical_records",
  "patient-files",
  "patient_files",
]);

/**
 * Determine if a file upload category requires encryption.
 */
export function requiresEncryption(category: string): boolean {
  return PHI_CATEGORIES.has(category.toLowerCase());
}
