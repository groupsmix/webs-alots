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
import { getPhiEncryptionKey, getPhiEncryptionKeyOld } from "@/lib/env";
import { logger } from "@/lib/logger";

// ── Key Management ──

/**
 * Current encryption format version prepended to ciphertext (CR-07).
 * Version 0 = legacy (no version byte, IV starts at byte 0).
 * Version 1 = current (1-byte version prefix, IV starts at byte 1).
 */
const ENCRYPTION_FORMAT_VERSION = 1;

/** Cached CryptoKey promise — the key doesn't change at runtime. */
let _cachedKey: Promise<CryptoKey> | undefined;

/** Cached old CryptoKey promise for key rotation fallback (F-A99-10). */
let _cachedOldKey: Promise<CryptoKey | null> | undefined;

/**
 * Assert that a hex-encoded encryption key is present and well-formed.
 * Throws a descriptive error if validation fails (BD-01, CR-01, CR-02).
 */
function assertValidHexKey(
  hexKey: string | undefined,
  envVarName: string,
): asserts hexKey is string {
  if (!hexKey) {
    throw new Error(
      `${envVarName} environment variable is required. ` +
        "Generate one with: openssl rand -hex 32",
    );
  }
  if (hexKey.length !== 64) {
    throw new Error(
      `${envVarName} must be exactly 64 hex characters (256 bits). ` +
        `Got ${hexKey.length} characters.`,
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(hexKey)) {
    throw new Error(`${envVarName} must contain only hex characters (0-9, a-f, A-F).`);
  }
}

/**
 * Validate that PHI_ENCRYPTION_KEY is present and well-formed.
 *
 * BD-01 / CR-01: Call this at application startup to fail fast on
 * misconfiguration instead of silently falling back to no encryption.
 *
 * @throws {Error} if key is missing, wrong length, or not valid hex.
 */
export function validateEncryptionKey(): void {
  assertValidHexKey(getPhiEncryptionKey(), "PHI_ENCRYPTION_KEY");
}

/**
 * Derive a CryptoKey from the hex-encoded master key in environment.
 * The result is cached so that repeated encrypt/decrypt calls avoid
 * re-importing the same raw key via crypto.subtle.importKey().
 *
 * BD-01 / CR-01 / CR-02: Throws if PHI_ENCRYPTION_KEY is missing,
 * wrong length, or not valid hex — never falls back silently.
 */
function getEncryptionKey(): Promise<CryptoKey> {
  if (_cachedKey !== undefined) return _cachedKey;
  _cachedKey = importEncryptionKey();
  return _cachedKey;
}

async function importEncryptionKey(): Promise<CryptoKey> {
  const hexKey = getPhiEncryptionKey();
  assertValidHexKey(hexKey, "PHI_ENCRYPTION_KEY");

  const keyBytes = hexToBytes(hexKey);

  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
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
  const hexKey = getPhiEncryptionKeyOld();
  if (!hexKey) return null;
  try {
    assertValidHexKey(hexKey, "PHI_ENCRYPTION_KEY_OLD");
  } catch (err) {
    logger.error((err as Error).message, { context: "encryption" });
    return null;
  }
  const keyBytes = hexToBytes(hexKey);
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
}

/**
 * Check if PHI encryption is configured and available.
 *
 * FP-12: Validates key length and hex format in addition to presence.
 * Without this, a malformed key causes `importEncryptionKey` to return
 * null, and the caller proceeds assuming encryption is on — resulting
 * in files uploaded unencrypted.
 */
export function isEncryptionConfigured(): boolean {
  // nosemgrep: semgrep.env-access — encryption key presence check; not in env.ts to avoid eager import of crypto
  const hexKey = getPhiEncryptionKey();
  if (!hexKey) return false;
  if (hexKey.length !== 64) return false;
  if (!/^[0-9a-fA-F]+$/.test(hexKey)) return false;
  return true;
}

// ── Encrypt / Decrypt ──

/**
 * Encrypt a buffer using AES-256-GCM.
 *
 * Returns the encrypted data with a version byte and IV prepended:
 *   v1 format: [1-byte version][12-byte IV][ciphertext + 16-byte GCM auth tag]
 *
 * CR-07: The version byte enables key identification after multiple
 * rotations without exhaustive key search.
 *
 * @throws {Error} if PHI_ENCRYPTION_KEY is not configured or invalid.
 */
export async function encryptBuffer(plaintext: Buffer | Uint8Array): Promise<Buffer> {
  const key = await getEncryptionKey();

  // Generate a random 96-bit IV for each encryption operation
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new Uint8Array(plaintext),
  );

  // Prepend version byte + IV to ciphertext for self-contained decryption
  const result = new Uint8Array(1 + iv.length + ciphertext.byteLength);
  result[0] = ENCRYPTION_FORMAT_VERSION;
  result.set(iv, 1);
  result.set(new Uint8Array(ciphertext), 1 + iv.length);

  return Buffer.from(result);
}

/**
 * Attempt AES-GCM decryption with a specific IV offset and key.
 * Returns the plaintext Buffer on success, or null on failure.
 */
async function tryDecrypt(
  encrypted: Uint8Array,
  ivOffset: number,
  key: CryptoKey,
): Promise<Buffer | null> {
  const iv = encrypted.slice(ivOffset, ivOffset + 12);
  const ciphertext = encrypted.slice(ivOffset + 12);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return Buffer.from(plaintext);
  } catch {
    return null;
  }
}

/**
 * Decrypt a buffer that was encrypted with `encryptBuffer`.
 *
 * Supports both formats for backward compatibility:
 *   v1:     [1-byte version][12-byte IV][ciphertext + GCM auth tag]
 *   legacy: [12-byte IV][ciphertext + GCM auth tag]
 *
 * EL-04 / FP-06: Logs `logger.error` (which forwards to Sentry) when
 * all decryption attempts fail, ensuring alerts fire on key
 * misconfiguration or data corruption.
 *
 * Returns null if decryption fails.
 * @throws {Error} if PHI_ENCRYPTION_KEY is not configured or invalid.
 */
export async function decryptBuffer(encrypted: Buffer | Uint8Array): Promise<Buffer | null> {
  const key = await getEncryptionKey();

  if (encrypted.length < 13) {
    logger.error("Encrypted data too short — missing IV or ciphertext", {
      context: "encryption",
      dataLength: encrypted.length,
    });
    return null;
  }

  const oldKey = await getOldEncryptionKey();
  const isVersioned = encrypted[0] === ENCRYPTION_FORMAT_VERSION && encrypted.length >= 14;

  // CR-07: Try versioned format first if version byte is detected,
  // then fall back to legacy format for backward compatibility.
  const offsets = isVersioned ? [1, 0] : [0];
  const keys: CryptoKey[] = oldKey ? [key, oldKey] : [key];

  for (const offset of offsets) {
    for (const k of keys) {
      const result = await tryDecrypt(encrypted, offset, k);
      if (result) {
        if (k === oldKey) {
          logger.warn("Decrypted with PHI_ENCRYPTION_KEY_OLD — file needs re-encryption", {
            context: "encryption",
          });
        }
        return result;
      }
    }
  }

  // EL-04 / FP-06: All key + format combinations failed.
  // logger.error forwards to Sentry via captureSentryError for alerting.
  logger.error(
    "AES-GCM decryption failed — wrong key or corrupted data. " +
      "Verify PHI_ENCRYPTION_KEY is correct and the file is not corrupted.",
    {
      context: "encryption",
      dataLength: encrypted.length,
      formatDetected: isVersioned ? "v1" : "legacy",
      hadOldKey: !!oldKey,
    },
  );
  return null;
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
const PHI_CATEGORIES = new Set([
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
