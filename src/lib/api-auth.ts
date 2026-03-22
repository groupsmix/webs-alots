/**
 * Shared API key authentication for public V1 REST endpoints.
 *
 * API keys are stored as SHA-256 hashes in the `clinic_api_keys` table.
 * A short prefix of the raw key is stored alongside the hash so we can
 * narrow the lookup to a single row before doing the constant-time
 * hash comparison.
 *
 * Legacy plaintext key support has been removed. All keys must use
 * the hashed format.
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

  if (!hashedRow?.key_hash || !hashedRow.active) return null;
  if (!timingSafeEqual(hashedRow.key_hash, keyHash)) return null;

  // Update last-used timestamp (fire-and-forget)
  await supabase
    .from("clinic_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_prefix", keyPrefix)
    .eq("key_hash", keyHash);

  return { clinicId: hashedRow.clinic_id };
}
