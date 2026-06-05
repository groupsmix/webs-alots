/**
 * DELETE /api/doctor-exceptions/:id — remove an exception day
 *
 * Only clinic admins and doctors (who own the exception) may delete.
 * The id is scoped to the tenant's clinic_id to prevent cross-tenant deletion.
 */

import { type NextRequest } from "next/server";
import { apiNotFound, apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";

export const DELETE = withAuth(
  async (
    _request: NextRequest,
    { supabase }: AuthContext,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { id }    = await params;
    const tenant    = await requireTenant();
    const clinicId  = tenant.clinicId;

    // Validate id format before touching the DB.
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return apiNotFound();
    }

    // Fetch first to confirm ownership and get metadata for the audit log.
    const { data: exception, error: fetchError } = await supabase
      .from("doctor_exceptions")
      .select("id, doctor_id, date")
      .eq("id", id)
      .eq("clinic_id", clinicId)      // tenant isolation
      .maybeSingle();

    if (fetchError || !exception) {
      return apiNotFound("Exception not found");
    }

    const { error: deleteError } = await supabase
      .from("doctor_exceptions")
      .delete()
      .eq("id", id)
      .eq("clinic_id", clinicId);    // belt-and-suspenders tenant isolation

    if (deleteError) {
      return apiError("Failed to delete exception", 500);
    }

    await logAuditEvent({
      supabase,
      action:      "doctor_exception_deleted",
      type:        "admin",
      clinicId,
      description: `Exception removed for doctor ${exception.doctor_id} on ${exception.date}`,
      metadata:    { exceptionId: id, doctorId: exception.doctor_id, date: exception.date },
    });

    return apiSuccess({ deleted: true });
  },
  STAFF_ROLES,
);
