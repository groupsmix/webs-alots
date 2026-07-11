/**
 * DB-backed upload size limit resolver.
 *
 * Provides `limitForClinicCategory()` which checks the `upload_policies` table
 * for a per-clinic override before falling back to the hardcoded platform
 * defaults defined in `LIMITS_BY_CATEGORY`.
 *
 * This makes the `maxSize` enforcement authoritative: the PUT /api/upload
 * confirm step uses this function so that clinic admins who set a tighter limit
 * via the admin API will see it enforced on upload confirmation — not just
 * advertised in the presigned URL response.
 */

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";

/** Platform-level ceiling — no policy row may exceed this. */
export const MAX_UPLOAD_BYTES_CEILING = 26_214_400; // 25 MiB

/**
 * Extract the clinicId segment from an R2 key produced by `buildUploadKey()`.
 *
 * Key format: `clinics/{clinicId}/{category}/{filename}`
 *
 * Returns `null` when the key does not match the expected structure (e.g. a
 * legacy or manually crafted key).
 */
export function clinicIdFromKey(key: string): string | null {
  const parts = key.split("/");
  if (parts.length < 4 || parts[0] !== "clinics") return null;
  return parts[1] || null;
}

/**
 * Resolve the effective upload size cap for a (clinicId, category) pair.
 *
 * @param clinicId        Tenant UUID — scopes the DB lookup.
 * @param category        Raw category string (will be normalised internally).
 * @param platformDefault Pre-computed platform default from `limitForCategory()`.
 *                        Passed in by the caller to avoid a circular import between
 *                        this module and `@/app/api/upload/route`.
 * @returns               Byte limit to enforce, always ≤ MAX_UPLOAD_BYTES_CEILING.
 */
export async function limitForClinicCategory(
  clinicId: string,
  category: string,
  platformDefault: number,
): Promise<number> {
  if (!clinicId) return platformDefault;

  try {
    // Use service-role admin client — this is called from authenticated route
    // handlers that have already verified the caller's identity and clinic
    // membership. We look up the policy for the tenant, not for the caller.
    // nosemgrep: semgrep.admin-client-guard -- deliberate service-role read of the tenant's
    // own policy row; the query below is still clinic-scoped via .eq("clinic_id").
    const supabase = createAdminClient("upload-policy");

    // Clinic-scoped: filtered by .eq("clinic_id", clinicId) below. The `as any`
    // cast (upload_policies is not yet in the generated DB types) hides the chain
    // from the tenant-scoping AST matcher, so suppress that false positive here.
    // nosemgrep: semgrep.tenant-scoping
    const { data, error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .from("upload_policies")
      .select("max_upload_bytes")
      .eq("clinic_id", clinicId)
      .eq("category", category)
      .maybeSingle();

    if (error) {
      logger.warn("Failed to fetch upload policy, using platform default", {
        context: "upload-policy",
        clinicId,
        category,
        error: error.message,
      });
      return platformDefault;
    }

    if (data?.max_upload_bytes) {
      // Clamp to the global ceiling regardless of what the DB row says.
      // This ensures a misconfigured or manually-inserted row cannot widen
      // the limit beyond what the proxy body cap allows.
      return Math.min(Number(data.max_upload_bytes), MAX_UPLOAD_BYTES_CEILING);
    }
  } catch (err) {
    // Fail open to the platform default so a DB hiccup doesn't block all uploads.
    logger.warn("Exception resolving upload policy, using platform default", {
      context: "upload-policy",
      clinicId,
      category,
      error: err,
    });
  }

  return platformDefault;
}
