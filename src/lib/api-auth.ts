/**
 * Shared API key authentication for public V1 REST endpoints.
 *
 * API keys are stored as SHA-256 hashes in the `clinic_api_keys` table.
 * A short prefix of the raw key is stored alongside the hash so we can
 * narrow the lookup to a single row before doing the constant-time
 * hash comparison.
 *
 * Migration path (backward-compatible):
 *   1. If the row has a `key_hash` column populated, compare hashes.
 *   2. Otherwise fall back to the legacy plaintext `key` column so
 *      existing keys keep working until they are rotated.
 */

import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sha256Hex, timingSafeEqual } from "@/lib/crypto-utils";

export async function authenticateApiKey(
  request: NextRequest,
): Promise<{ clinicId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  if (!apiKey) return null;

  const supabase = await createClient();

  // Compute hash of the provided key for comparison
  const keyHash = await sha256Hex(apiKey);
  const keyPrefix = apiKey.slice(0, 8);

  // Try hash-based lookup first (new keys)
  const { data: hashedRow } = await supabase
    .from("clinic_api_keys")
    .select("clinic_id, active, key_hash")
    .eq("key_prefix", keyPrefix)
    .single();

  if (hashedRow?.key_hash && hashedRow.active) {
    if (!timingSafeEqual(hashedRow.key_hash, keyHash)) return null;

    // Update last-used timestamp (fire-and-forget)
    await supabase
      .from("clinic_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_prefix", keyPrefix)
      .eq("key_hash", keyHash);

    return { clinicId: hashedRow.clinic_id };
  }

  // Fallback: legacy plaintext lookup — DEPRECATED.
  // Hard sunset: reject legacy keys after 2025-09-01 to force migration.
  const LEGACY_KEY_SUNSET = new Date("2025-09-01T00:00:00Z");
  if (new Date() >= LEGACY_KEY_SUNSET) {
    console.warn(
      "[api-auth] Legacy plaintext API key authentication has been sunset. " +
      "All keys must be migrated to hashed format.",
    );
    return null;
  }

  const { data: legacyRow } = await supabase
    .from("clinic_api_keys")
    .select("clinic_id, active")
    .eq("key", apiKey)
    .single();

  if (!legacyRow?.active) return null;

  console.warn(
    `[api-auth] Legacy plaintext API key used for clinic ${legacyRow.clinic_id}. ` +
    `This key must be rotated to a hashed key before ${LEGACY_KEY_SUNSET.toISOString()}.`,
  );

  await supabase
    .from("clinic_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key", apiKey);

  return { clinicId: legacyRow.clinic_id };
}
