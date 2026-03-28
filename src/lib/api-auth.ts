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
import { logger } from "@/lib/logger";

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

  // HIGH-04: Use .limit() instead of .single() to handle prefix collisions.
  // With .single(), if two keys share a prefix, both clinics get a 500 error.
  // By iterating over candidates, we gracefully handle collisions.
  const { data: candidates } = await supabase
    .from("clinic_api_keys")
    .select("clinic_id, active, key_hash")
    .eq("key_prefix", keyPrefix)
    .eq("active", true)
    .limit(50);

  if (!candidates || candidates.length === 0) return null;

  // Check each candidate with timing-safe comparison
  for (const candidate of candidates) {
    if (!candidate.key_hash) continue;
    if (timingSafeEqual(candidate.key_hash, keyHash)) {
      // Fire-and-forget: update last_used_at
      supabase
        .from("clinic_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("key_hash", keyHash)
        .then(({ error }) => {
          if (error) logger.warn("Failed to update API key last_used_at", { context: "api-auth", error });
        });

      return { clinicId: candidate.clinic_id };
    }
  }

  return null;
}
