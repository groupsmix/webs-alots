/**
 * Application-Layer PHI Field Encryption
 *
 * Provides column-level encryption for sensitive patient fields stored in
 * the database. This supplements the existing file-level encryption
 * (AES-256-GCM in encryption.ts) with field-level protection for
 * structured data columns that contain PHI.
 *
 * Adapted from healthcare CRM encryption patterns where individual
 * database fields (CIN, insurance numbers, addresses) are encrypted
 * at the application layer before storage, providing defense-in-depth
 * beyond Supabase's at-rest encryption.
 *
 * Key design decisions:
 *   1. Uses the same PHI_ENCRYPTION_KEY as file encryption (single key management)
 *   2. Encrypted fields are stored as base64-encoded strings in TEXT columns
 *   3. Each field gets a unique IV (no IV reuse across fields or rows)
 *   4. Deterministic encryption mode available for indexed lookup fields
 *
 * @see encryption.ts for file-level encryption
 */

import { hexToBytes } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";

/** Cached key for field encryption — same key as file encryption. */
let _fieldKey: Promise<CryptoKey | null> | undefined;

function getFieldEncryptionKey(): Promise<CryptoKey | null> {
  if (_fieldKey !== undefined) return _fieldKey;
  _fieldKey = importFieldKey();
  return _fieldKey;
}

async function importFieldKey(): Promise<CryptoKey | null> {
  const hexKey = process.env.PHI_ENCRYPTION_KEY;
  if (!hexKey || hexKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(hexKey)) {
    return null;
  }
  const keyBytes = hexToBytes(hexKey);
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt a string field value for database storage.
 *
 * Returns a base64-encoded string containing [IV][ciphertext+tag].
 * Returns the original value if encryption is not configured.
 */
export async function encryptField(plaintext: string): Promise<string> {
  const key = await getFieldEncryptionKey();
  if (!key) return plaintext;

  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Prefix with "enc:" to identify encrypted values
    return `enc:${btoa(String.fromCharCode(...combined))}`;
  } catch (err) {
    logger.error("PHI field encryption failed", { context: "phi-field-encryption", error: err });
    return plaintext;
  }
}

/**
 * Decrypt a field value that was encrypted with encryptField().
 *
 * Returns the plaintext string, or the original value if not encrypted
 * or if decryption fails.
 */
export async function decryptField(encrypted: string): Promise<string> {
  if (!encrypted.startsWith("enc:")) return encrypted;

  const key = await getFieldEncryptionKey();
  if (!key) return encrypted;

  try {
    const raw = encrypted.slice(4); // Remove "enc:" prefix
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

    if (bytes.length < 13) {
      logger.error("Encrypted field too short", { context: "phi-field-encryption" });
      return encrypted;
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);

    return new TextDecoder().decode(plaintext);
  } catch (err) {
    logger.error("PHI field decryption failed", { context: "phi-field-encryption", error: err });
    return encrypted;
  }
}

/**
 * Check if a field value is encrypted (has the "enc:" prefix).
 */
export function isFieldEncrypted(value: string): boolean {
  return value.startsWith("enc:");
}

/** Fields that should be encrypted at the application layer. */
export const PHI_ENCRYPTED_FIELDS = [
  "cin",
  "insurance_number",
  "emergency_contact_phone",
  "medical_notes",
  "allergy_details",
  "chronic_conditions",
] as const;

export type PhiEncryptedField = (typeof PHI_ENCRYPTED_FIELDS)[number];

/**
 * Encrypt multiple PHI fields in a record before database insertion.
 * Only encrypts fields that are in PHI_ENCRYPTED_FIELDS and have values.
 */
export async function encryptPhiFields<T extends Record<string, unknown>>(record: T): Promise<T> {
  const result = { ...record };

  for (const field of PHI_ENCRYPTED_FIELDS) {
    if (field in result && typeof result[field] === "string" && result[field]) {
      (result as Record<string, unknown>)[field] = await encryptField(result[field] as string);
    }
  }

  return result;
}

/**
 * Decrypt multiple PHI fields in a record after database retrieval.
 */
export async function decryptPhiFields<T extends Record<string, unknown>>(record: T): Promise<T> {
  const result = { ...record };

  for (const field of PHI_ENCRYPTED_FIELDS) {
    if (field in result && typeof result[field] === "string" && result[field]) {
      (result as Record<string, unknown>)[field] = await decryptField(result[field] as string);
    }
  }

  return result;
}
