/**
 * GET /api/admin/referrals — List all patient referrals across clinics
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

async function handleGet(_request: NextRequest, _auth: AuthContext) {
  try {
    // nosemgrep: semgrep.tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    const { data, error } = await supabase
      .from("referrals") // nosemgrep: semgrep.tenant-scoping
      .select(
        "id, clinic_id, referring_doctor_id, referred_to_doctor_id, patient_id, reason, status, created_at, clinics(name)",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      logger.error("Failed to fetch referrals", { context: "referrals-api", error });
      return apiInternalError("Failed to fetch referrals");
    }

    // Enrich with the referring/referred DOCTOR names — that is the point of a
    // "references between doctors" view; the IDs alone are meaningless to an
    // operator. Patient names are intentionally NOT resolved here: this is a
    // cross-tenant, platform-operator view and patient identity is PHI that
    // must stay masked by default (see env.ts → enforcePhiMaskingPolicy).
    const rows = (data ?? []) as Array<{
      referring_doctor_id: string | null;
      referred_to_doctor_id: string | null;
      [key: string]: unknown;
    }>;
    const doctorIds = [
      ...new Set(
        rows
          .flatMap((r) => [r.referring_doctor_id, r.referred_to_doctor_id])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const nameById = new Map<string, string>();
    if (doctorIds.length > 0) {
      const { data: doctors } = await supabase
        .from("users") // nosemgrep: semgrep.tenant-scoping — super-admin cross-tenant referral overview; resolves staff (doctor) names only, no patient PHI
        .select("id, name")
        .in("id", doctorIds);
      for (const d of doctors ?? []) nameById.set(d.id as string, d.name as string);
    }
    const enriched = rows.map((r) => ({
      ...r,
      referring_doctor_name: nameById.get(r.referring_doctor_id as string) ?? null,
      referred_to_doctor_name: nameById.get(r.referred_to_doctor_id as string) ?? null,
    }));

    return apiSuccess({ referrals: enriched });
  } catch (err) {
    logger.error("Unexpected error fetching referrals", { context: "referrals-api", error: err });
    return apiInternalError("Failed to fetch referrals");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
