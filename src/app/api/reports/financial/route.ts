import { type NextRequest } from "next/server";
import { getFinancialReport } from "@/lib/analytics/financial";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

async function handler(request: NextRequest, auth: AuthContext) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  if (!startDate || !endDate) {
    return apiValidationError("startDate and endDate query params required (YYYY-MM-DD)");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return apiValidationError("Dates must be in YYYY-MM-DD format");
  }

  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic context", 403);
  }

  const report = await getFinancialReport(auth.supabase, {
    clinicId,
    startDate,
    endDate,
  });

  await logAuditEvent({
    supabase: auth.supabase,
    type: "payment",
    action: "view_financial_report",
    clinicId,
    actor: auth.user.id,
    metadata: { startDate, endDate },
  });

  return apiSuccess(report);
}

export const GET = withAuth(handler, ["clinic_admin", "super_admin"]);
