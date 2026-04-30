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
 *
 * ── Key Rotation Procedure ──
 *
 * PHI encryption keys should be rotated periodically (recommended: annually,
 * or immediately if a key compromise is suspected).
 *
 * Steps to rotate the PHI_ENCRYPTION_KEY:
 *
 *   1. Generate a new 256-bit key:
 *        openssl rand -hex 32
 *
 *   2. Set the new key as PHI_ENCRYPTION_KEY and keep the old key as
 *      PHI_ENCRYPTION_KEY_OLD in your environment / secret manager:
 *        PHI_ENCRYPTION_KEY=<new-key-hex>
 *        PHI_ENCRYPTION_KEY_OLD=<old-key-hex>
 *
 *   3. Run the re-encryption migration script (scripts/rotate-phi-key.ts):
 *      - Reads all encrypted files from R2 (PHI_CATEGORIES)
 *      - Decrypts each file with PHI_ENCRYPTION_KEY_OLD
 *      - Re-encrypts with PHI_ENCRYPTION_KEY
 *      - Uploads the re-encrypted file back to R2
 *      - Logs progress and any failures for manual retry
 *
 *   4. After all files are re-encrypted successfully, remove
 *      PHI_ENCRYPTION_KEY_OLD from the environment.
 *
 *   5. Update Cloudflare Worker secrets:
 *        wrangler secret put PHI_ENCRYPTION_KEY
 *
 *   6. Record the rotation in the audit log for compliance:
 *        - Date of rotation
 *        - Operator who performed it
 *        - Number of files re-encrypted
 *        - Any files that failed and require manual attention
 *
 * IMPORTANT: Never delete the old key until ALL files have been successfully
 * re-encrypted. Keep a secure backup of both keys during the transition.
 */

import { hexToBytes } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";

// ── Key Management ──

/** Cached CryptoKey promise — the key doesn't change at runtime. */
let _cachedKey: Promise<CryptoKey | null> | undefined;

/** Cached old CryptoKey promise for key rotation fallback (F-A99-10). */
let _cachedOldKey: Promise<CryptoKey | null> | undefined;

/**
 * Derive a CryptoKey from the hex-encoded master key in environment.
 * The result is cached so that repeated encrypt/decrypt calls avoid
 * re-importing the same raw key via crypto.subtle.importKey().
 * Returns null if PHI_ENCRYPTION_KEY is not configured.
 */
function getEncryptionKey(): Promise<CryptoKey | null> {
  if (_cachedKey !== undefined) return _cachedKey;
  _cachedKey = importEncryptionKey();
  return _cachedKey;
}

async function importEncryptionKey(): Promise<CryptoKey | null> {
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

  const keyBytes = hexToBytes(hexKey);

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Import the old/rotated encryption key from PHI_ENCRYPTION_KEY_OLD.
 * Used during key rotation so that files encrypted with the previous key
 * can still be decrypted (F-A99-10 / A100-01).
 */
function getOldEncryptionKey(): Promise<CryptoKey | null> {
  if (_cachedOldKey !== undefined) return _cachedOldKey;
  _cachedOldKey = importOldEncryptionKey();
  return _cachedOldKey;
}

async function importOldEncryptionKey(): Promise<CryptoKey | null> {
  const hexKey = process.env.PHI_ENCRYPTION_KEY_OLD;
  if (!hexKey) return null;
  if (hexKey.length !== 64) {
    logger.error("PHI_ENCRYPTION_KEY_OLD must be exactly 64 hex characters (256 bits)", {
      context: "encryption",
    });
    return null;
  }
  const keyBytes = hexToBytes(hexKey);
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
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
    // F-A99-10 / A100-01: During key rotation, files encrypted with the
    // old key will fail to decrypt with the new key. Try the old key
    // before giving up, so patients can still view their prescriptions
    // mid-rotation.
    const oldKey = await getOldEncryptionKey();
    if (oldKey) {
      try {
        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          oldKey,
          ciphertext,
        );
        logger.warn("Decrypted with PHI_ENCRYPTION_KEY_OLD — file needs re-encryption", {
          context: "encryption",
        });
        return Buffer.from(plaintext);
      } catch {
        // Old key also failed — fall through to error below
      }
    }

    logger.error("AES-GCM decryption failed — wrong key or corrupted data", {
      context: "encryption",
      error: err,
    });
    return null;
  }
}

// ── Patient File Categories Requiring Encryption ──

/**
 * Normalize a category key to a single canonical form: lowercase + all
 * hyphens folded to underscores. Mirrors `normalizeCategory()` in the
 * upload route so the per-category size limits and the PHI-encryption
 * decision can never disagree on what e.g. `"X-Rays"` means.
 *
 * Audit Finding C-08: keeping two separate normalizations (one lowercase-
 * only here, one hyphen-folding in upload route) meant a category like
 * `x_rays` had a 25 MB limit but bypassed encryption because the PHI set
 * only listed `x-rays` / `xrays`.
 */
export function normalizePhiCategory(category: string): string {
  return category.trim().toLowerCase().replace(/-/g, "_");
}

/**
 * Upload categories that contain Protected Health Information (PHI)
 * and must be encrypted at rest per Moroccan Law 09-08.
 *
 * Stored in canonical normalized form (lowercase, underscores). Callers
 * must look up via `requiresEncryption()` rather than directly reading
 * this set, since `requiresEncryption()` applies the same normalization
 * to the input.
 */
export const PHI_CATEGORIES = new Set([
  // AUDIT-02: Both singular and plural forms must be listed so that a
  // category of "document" (singular, present in LIMITS_BY_CATEGORY) is
  // correctly recognised as PHI. Previously only "documents" was listed,
  // meaning uploads with category="document" bypassed encryption.
  "document",
  "documents",
  "prescriptions",
  "lab_report",
  "lab_results",
  "x_rays",
  // `xrays` (no separator) intentionally listed separately because the
  // hyphen-fold normalization does not collapse "xrays" → "x_rays".
  // Both forms appear in LIMITS_BY_CATEGORY and must mirror that set.
  "xrays",
  "radiology",
  "medical_records",
  "patient_files",
]);

/**
 * Determine if a file upload category requires encryption. Applies the
 * same normalization as `LIMITS_BY_CATEGORY` so `lab-results`,
 * `lab_results`, `Lab-Results` etc. all resolve to the same decision.
 */
export function requiresEncryption(category: string): boolean {
  return PHI_CATEGORIES.has(normalizePhiCategory(category));
}
