import { withAuth } from "@/lib/with-auth";
import { requireTenant } from "@/lib/tenant";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { logAuditEvent } from "@/lib/audit-log";
import { WAITING_LIST_STATUS } from "@/lib/types/database";
import { logger } from "@/lib/logger";
import { waitingListSchema, waitingListDeleteSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";
import { STAFF_ROLES } from "@/lib/auth-roles";
import type { UserRole } from "@/lib/types/database";
import { apiError, apiForbidden, apiInternalError, apiRateLimited, apiSuccess } from "@/lib/api-response";
import { waitingListLimiter, extractClientIp } from "@/lib/rate-limit";

const WAITING_LIST_ROLES: UserRole[] = [...STAFF_ROLES, "patient"];
/**
 * POST /api/booking/waiting-list
 *
 * Add a patient to the waiting list.
 */
export const POST = withAuthValidation(waitingListSchema, async (body, request, { supabase }) => {

    // Honeypot check: if the hidden field was filled, silently reject (Issue 51)
    if (body.website) {
      return apiSuccess({ status: "added", message: "Added to waiting list", entryId: "ok" });
    }

    // Defence-in-depth: per-IP rate limit (Issue 51).
    // The middleware also applies waitingListLimiter, but checking here
    // guards against deployment configs that skip the middleware layer.
    const clientIp = extractClientIp(request);
    const ipAllowed = await waitingListLimiter.check(`waiting-list:${clientIp}`);
    if (!ipAllowed) {
      return apiRateLimited("Trop de demandes. Veuillez réessayer plus tard.");
    }

    // Per-phone rate limit: 3 requests per phone number per hour (Issue 51)
    if (body.patientPhone) {
      const phoneAllowed = await waitingListLimiter.check(`waiting-list-phone:${body.patientPhone}`);
      if (!phoneAllowed) {
        return apiRateLimited("Trop de demandes pour ce numéro. Veuillez réessayer plus tard.");
      }
    }

    // Find or create patient (prefer phone-based lookup to avoid name collisions)
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    const patientId = await findOrCreatePatient(
      supabase, clinicId, body.patientId, body.patientName,
      { phone: body.patientPhone },
    );
    if (!patientId) {
      return apiInternalError("Failed to resolve patient");
    }

    const { data: entry, error } = await supabase
      .from("waiting_list")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        doctor_id: body.doctorId,
        preferred_date: body.preferredDate,
        preferred_time: body.preferredTime ?? null,
        service_id: body.serviceId ?? null,
        status: WAITING_LIST_STATUS.WAITING,
      })
      .select("id")
      .single();

    if (error || !entry) {
      logger.warn("Operation failed", { context: "booking/waiting-list", error });
      return apiError("Failed to add to waiting list");
    }

    // Audit log for healthcare compliance
    await logAuditEvent({
      supabase,
      action: "waiting_list.added",
      type: "booking",
      clinicId,
      description: `Patient ${patientId} added to waiting list (entry ${entry.id}) for doctor ${body.doctorId} on ${body.preferredDate}`,
    });

    return apiSuccess({
      status: "added",
      message: "Added to waiting list",
      entryId: entry.id,
    });
}, WAITING_LIST_ROLES);

/**
 * GET /api/booking/waiting-list?patientId=...  OR  ?doctorId=...&date=...
 *
 * Get waiting list entries.
 */
export const GET = withAuth(async (request, { supabase, profile }) => {
  const patientId = request.nextUrl.searchParams.get("patientId");
  const doctorId = request.nextUrl.searchParams.get("doctorId");
  const date = request.nextUrl.searchParams.get("date");
  const time = request.nextUrl.searchParams.get("time");

  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;

  // Ownership check: patients can only view their OWN waiting list entries
  if (profile.role === "patient" && patientId && patientId !== profile.id) {
    return apiSuccess({ entries: [] });
  }

  if (patientId) {
    const { data: entries } = await supabase
      .from("waiting_list")
      .select("id, clinic_id, patient_id, doctor_id, preferred_date, preferred_time, service_id, status, created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    return apiSuccess({ entries: entries ?? [] });
  }

  if (doctorId && date) {
    let q = supabase
      .from("waiting_list")
      .select("id, clinic_id, patient_id, doctor_id, preferred_date, preferred_time, service_id, status, created_at")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .eq("preferred_date", date);

    if (time) {
      q = q.eq("preferred_time", time);
    }

    const { data: entries } = await q.order("created_at", { ascending: true });
    return apiSuccess({ entries: entries ?? [] });
  }

  return apiError("patientId, or doctorId and date are required");
}, WAITING_LIST_ROLES);

/**
 * DELETE /api/booking/waiting-list
 *
 * Remove a patient from the waiting list.
 */
export const DELETE = withAuthValidation(waitingListDeleteSchema, async (body, _request, { supabase, profile }) => {

    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // For patients, verify they own this waiting list entry before deleting
    if (profile.role === "patient") {
      const { data: entry } = await supabase
        .from("waiting_list")
        .select("patient_id")
        .eq("id", body.entryId)
        .eq("clinic_id", clinicId)
        .single();

      if (!entry || entry.patient_id !== profile.id) {
        return apiForbidden("Forbidden");
      }
    }

    const { error } = await supabase
      .from("waiting_list")
      .delete()
      .eq("id", body.entryId)
      .eq("clinic_id", clinicId);

    if (error) {
      logger.warn("Operation failed", { context: "booking/waiting-list", error });
      return apiError("Failed to remove from waiting list");
    }

    // Audit log for healthcare compliance
    await logAuditEvent({
      supabase,
      action: "waiting_list.removed",
      type: "booking",
      clinicId,
      description: `Waiting list entry ${body.entryId} removed`,
    });

    return apiSuccess({ status: "removed", message: "Removed from waiting list" });
}, WAITING_LIST_ROLES);
