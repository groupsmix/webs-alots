/**
 * AI Provider Secret Encryption
 *
 * Thin wrapper over the existing PHI field-encryption helpers so that
 * AI provider API keys are stored encrypted in the database, never in
 * plaintext.
 *
 * Why this exists separately:
 *   1. Makes the call sites at /api/admin/ai-config grep-friendly
 *   2. Lets us no-op gracefully when PHI_ENCRYPTION_KEY isn't configured
 *      (dev environments) — falls back to a `plain:` prefix so the round-trip
 *      still works, but logs a warning.
 *   3. Adds a version tag (`enc:v1:`) so we can migrate formats later
 *      without breaking old rows.
 *
 * Production: PHI_ENCRYPTION_KEY is required (see src/lib/env.ts).
 */

import { logger } from "@/lib/logger";
import { encryptField, decryptField, isFieldEncrypted } from "@/lib/phi-field-encryption";

const ENCRYPTED_PREFIX = "enc:v1:";
const PLAIN_PREFIX = "plain:v1:";

/** Encrypt a provider API key for DB storage. */
export async function encryptProviderKey(plaintext: string | null): Promise<string | null> {
  if (!plaintext) return null;
  try {
    const ciphertext = await encryptField(plaintext);
    return `${ENCRYPTED_PREFIX}${ciphertext}`;
  } catch (err) {
    // Dev fallback — PHI_ENCRYPTION_KEY not set. NEVER hits in production
    // because env.ts validation refuses to boot without it.
    logger.warn("AI provider key stored unencrypted — PHI_ENCRYPTION_KEY missing", {
      context: "ai-secret-encryption",
      error: err instanceof Error ? err.message : String(err),
    });
    return `${PLAIN_PREFIX}${plaintext}`;
  }
}

/** Decrypt a provider API key read from DB. Tolerates legacy plaintext rows. */
export async function decryptProviderKey(stored: string | null): Promise<string | null> {
  if (!stored) return null;

  if (stored.startsWith(ENCRYPTED_PREFIX)) {
    const ciphertext = stored.slice(ENCRYPTED_PREFIX.length);
    try {
      return await decryptField(ciphertext);
    } catch (err) {
      logger.error("Failed to decrypt AI provider key", {
        context: "ai-secret-encryption",
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  if (stored.startsWith(PLAIN_PREFIX)) {
    return stored.slice(PLAIN_PREFIX.length);
  }

  // Legacy row written before this PR — could be either a raw key or an
  // already-encrypted blob from the PHI helpers without our prefix.
  if (isFieldEncrypted(stored)) {
    try {
      return await decryptField(stored);
    } catch {
      // Fall through to treating it as plaintext
    }
  }

  logger.warn("AI provider key read in legacy plaintext format — will re-encrypt on next save", {
    context: "ai-secret-encryption",
  });
  return stored;
}

/** Returns true if the stored value uses our versioned encrypted format. */
export function isProviderKeyEncrypted(stored: string | null): boolean {
  return !!stored && stored.startsWith(ENCRYPTED_PREFIX);
}
