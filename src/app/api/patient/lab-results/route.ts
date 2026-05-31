/**
 * GET /api/patient/lab-results — Fetch lab results for authenticated patient
 *
 * Patients see only their own results. Doctors/admins can query by patientId.
 * Results are sorted by date descending with abnormal values flagged.
 *
 * Note: Uses type assertions for the `lab_results` table since it may not
 * yet exist in the generated Database types.
 */

import { type NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

async function handler(req: NextRequest, auth: AuthContext): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic association", 403, "FORBIDDEN");
  }

  // Determine whose results to fetch
  let targetPatientId: string;
  if (auth.profile.role === "patient") {
    targetPatientId = auth.user.id;
  } else if (patientId) {
    targetPatientId = patientId;
  } else {
    return apiError("patientId required for non-patient roles", 400, "VALIDATION_ERROR");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = auth.supabase as any;
  let query = client
    .from("lab_results")
    .select("*", { count: "exact" })
    .eq("clinic_id", clinicId)
    .eq("patient_id", targetPatientId)
    .order("result_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error, count } = await query;
  if (error) {
    return apiError("Failed to fetch lab results", 500, "DB_ERROR");
  }

  // Log PHI access
  void logAuditEvent({
    supabase: auth.supabase,
    type: "patient",
    action: "lab_results_viewed",
    clinicId,
    actor: auth.user.id,
    metadata: { targetPatientId, resultCount: data?.length ?? 0 },
  });

  return apiSuccess({ results: data, total: count });
}

export const GET = withAuth(handler, ["doctor", "clinic_admin", "patient"]);
