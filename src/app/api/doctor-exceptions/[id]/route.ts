/**
 * DELETE /api/doctor-exceptions/:id — remove an exception day
 *
 * Authorization:
 *   • clinic_admin may delete any exception within their clinic.
 *   • doctor may delete only exceptions they own (doctor_id === profile.id).
 *
 * Tenant scoping: every query is filtered by clinic_id so a caller cannot
 * even observe an exception from a different tenant — IDOR-safe.
 */

import { type NextRequest } from "next/server";
import { apiError, apiForbidden, apiNotFound, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";

export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(
  async (_request: NextRequest, { supabase, profile }: AuthContext, routeCtx) => {
    const { id } = await routeCtx!.params;
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Validate id format before touching the DB.
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return apiNotFound();
    }

    // Fetch first to confirm ownership and get metadata for the audit log.
    // The clinic_id filter guarantees cross-tenant IDs return 404, not 403.
    const { data: exception, error: fetchError } = await supabase
      .from("doctor_exceptions")
      .select("id, doctor_id, date")
      .eq("id", id)
      .eq("clinic_id", clinicId) // tenant isolation
      .maybeSingle();

    if (fetchError || !exception) {
      return apiNotFound("Exception not found");
    }

    // SECURITY: doctors may only delete their own exception days.
    // clinic_admin is allowed to delete any exception in the tenant.
    if (profile.role === "doctor" && exception.doctor_id !== profile.id) {
      return apiForbidden("Doctors may only delete their own exception days");
    }

    const { error: deleteError } = await supabase
      .from("doctor_exceptions")
      .delete()
      .eq("id", id)
      .eq("clinic_id", clinicId); // belt-and-suspenders tenant isolation

    if (deleteError) {
      return apiError("Failed to delete exception", 500);
    }

    await logAuditEvent({
      supabase,
      action: "doctor_exception_deleted",
      type: "admin",
      clinicId,
      description: `Exception removed for doctor ${exception.doctor_id} on ${exception.date}`,
      metadata: { exceptionId: id, doctorId: exception.doctor_id, date: exception.date },
    });

    return apiSuccess({ deleted: true });
  },
  ["clinic_admin", "doctor"],
);
