import { type NextRequest } from "next/server";
import { getPatientAnalytics } from "@/lib/analytics/patient";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

async function handler(request: NextRequest, auth: AuthContext) {
  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId");

  if (!patientId) {
    return apiValidationError("patientId query param required");
  }

  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic context", 403);
  }

  const summary = await getPatientAnalytics(auth.supabase, {
    clinicId,
    patientId,
  });

  await logAuditEvent({
    supabase: auth.supabase,
    type: "patient",
    action: "view_patient_analytics",
    clinicId,
    actor: auth.user.id,
    metadata: { patientId },
  });

  return apiSuccess(summary);
}

export const GET = withAuth(handler, ["doctor", "clinic_admin", "super_admin"]);
