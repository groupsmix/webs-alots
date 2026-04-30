/**
 * Shared API key authentication for public V1 REST endpoints.
 *
 * API keys are stored as SHA-256 hashes in the `clinic_api_keys` table.
 * A short prefix of the raw key is stored alongside the hash so we can
 * narrow the lookup to a single row before doing the constant-time
 * hash comparison.
 *
 * AUDIT-13: API keys now enforce `expires_at` and `scopes` when present.
 * Keys without an `expires_at` are treated as non-expiring (backward
 * compatible). Keys with a `scopes` array are only valid for routes
 * whose required scope appears in the array. Keys without `scopes` are
 * treated as having full access (backward compatible).
 *
 * Legacy plaintext key support has been removed. All keys must use
 * the hashed format.
 */

import { type NextRequest } from "next/server";
import { sha256Hex, timingSafeEqual } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";

export interface ApiKeyAuth {
  clinicId: string;
  /** Scopes granted to this key (null = unrestricted for backward compat) */
  scopes: string[] | null;
}

/**
 * Authenticate a request using a Bearer API key.
 *
 * @param request - The incoming request
 * @param requiredScope - Optional scope that the key must have. When provided,
 *   keys with a non-null `scopes` array must include this scope.
 */
export async function authenticateApiKey(
  request: NextRequest,
  requiredScope?: string,
): Promise<ApiKeyAuth | null> {
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
  //
  // AUDIT-13: Select `expires_at` and `scopes` for enforcement.
  // These columns may not yet be in the generated DB types, so cast the
  // client to `any` just for this query. Row shape is validated at use.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untypedClient = supabase as any;
  const { data: candidates } = await untypedClient
    .from("clinic_api_keys")
    .select("clinic_id, active, key_hash, expires_at, scopes")
    .eq("key_prefix", keyPrefix)
    .eq("active", true)
    .limit(50) as {
      data:
        | Array<{
            clinic_id: string;
            active: boolean;
            key_hash: string | null;
            expires_at: string | null;
            scopes: string[] | null;
          }>
        | null;
    };

  if (!candidates || candidates.length === 0) return null;

  const now = new Date().toISOString();

  // Check each candidate with timing-safe comparison
  for (const candidate of candidates) {
    if (!candidate.key_hash) continue;
    if (timingSafeEqual(candidate.key_hash, keyHash)) {
      // AUDIT-13: Enforce key expiry. Keys with a non-null `expires_at` in
      // the past are rejected even if `active` is still true. This prevents
      // forgotten API keys from being valid indefinitely.
      const expiresAt = candidate.expires_at;
      if (expiresAt && expiresAt < now) {
        logger.warn("Expired API key used", {
          context: "api-auth",
          clinicId: candidate.clinic_id,
          expiresAt,
        });
        return null;
      }

      // AUDIT-13: Enforce scopes. If the key has a `scopes` array and a
      // `requiredScope` was specified by the caller, the key must include
      // that scope. Keys without scopes (null) are unrestricted.
      const scopes = candidate.scopes;
      if (requiredScope && scopes && Array.isArray(scopes)) {
        if (!scopes.includes(requiredScope)) {
          logger.warn("API key missing required scope", {
            context: "api-auth",
            clinicId: candidate.clinic_id,
            requiredScope,
            keyScopes: scopes,
          });
          return null;
        }
      }

      // Fire-and-forget: update last_used_at
      supabase
        .from("clinic_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("key_hash", keyHash)
        .then(({ error }) => {
          if (error) logger.warn("Failed to update API key last_used_at", { context: "api-auth", error });
        });

      return {
        clinicId: candidate.clinic_id,
        scopes: Array.isArray(scopes) ? scopes : null,
      };
    }
  }

  return null;
}
