/**
 * GET /api/admin/usage — Per-clinic usage metrics (appointments, users, etc.)
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
    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    // Fetch all clinics
    const { data: clinics, error: clinicsErr } = await supabase
      .from("clinics") // nosemgrep: semgrep.tenant-scoping
      .select("id, name, type, status, created_at")
      .order("name");

    if (clinicsErr) {
      logger.error("Failed to fetch clinics for usage", {
        context: "usage-api",
        error: clinicsErr,
      });
      return apiInternalError("Failed to fetch usage data");
    }

    // Count appointments per clinic
    // nosemgrep: semgrep.tenant-scoping
    const { data: apptCounts } = await supabase.from("appointments").select("clinic_id");

    // Count users per clinic
    // nosemgrep: semgrep.tenant-scoping
    const { data: userCounts } = await supabase.from("users").select("clinic_id");

    // Build per-clinic counts
    const apptByClinic: Record<string, number> = {};
    const usersByClinic: Record<string, number> = {};

    if (apptCounts) {
      for (const row of apptCounts) {
        const cid = row.clinic_id as string;
        apptByClinic[cid] = (apptByClinic[cid] ?? 0) + 1;
      }
    }
    if (userCounts) {
      for (const row of userCounts) {
        const cid = row.clinic_id as string;
        if (cid) usersByClinic[cid] = (usersByClinic[cid] ?? 0) + 1;
      }
    }

    const clinicUsage = (clinics ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      type: c.type as string,
      status: c.status as string,
      appointments: apptByClinic[c.id as string] ?? 0,
      users: usersByClinic[c.id as string] ?? 0,
      created_at: c.created_at as string,
    }));

    return apiSuccess({ clinics: clinicUsage });
  } catch (err) {
    logger.error("Unexpected error fetching usage", { context: "usage-api", error: err });
    return apiInternalError("Failed to fetch usage data");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
