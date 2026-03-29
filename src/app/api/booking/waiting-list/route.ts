import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { requireTenant } from "@/lib/tenant";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { logAuditEvent } from "@/lib/audit-log";
import { WAITING_LIST_STATUS } from "@/lib/types/database";
import { logger } from "@/lib/logger";
import { waitingListSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";
import { STAFF_ROLES } from "@/lib/auth-roles";
import type { UserRole } from "@/lib/types/database";

const WAITING_LIST_ROLES: UserRole[] = [...STAFF_ROLES, "patient"];
/**
 * POST /api/booking/waiting-list
 *
 * Add a patient to the waiting list.
 */
export const POST = withAuthValidation(waitingListSchema, async (body, request, { supabase }) => {

    // Find or create patient (prefer phone-based lookup to avoid name collisions)
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    const patientId = await findOrCreatePatient(
      supabase, clinicId, body.patientId, body.patientName,
      { phone: body.patientPhone },
    );
    if (!patientId) {
      return NextResponse.json({ error: "Failed to resolve patient" }, { status: 500 });
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
      return NextResponse.json({ error: "Failed to add to waiting list" }, { status: 400 });
    }

    // Audit log for healthcare compliance
    await logAuditEvent({
      supabase,
      action: "waiting_list.added",
      type: "booking",
      clinicId,
      description: `Patient ${patientId} added to waiting list (entry ${entry.id}) for doctor ${body.doctorId} on ${body.preferredDate}`,
    });

    return NextResponse.json({
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
    return NextResponse.json({ entries: [] });
  }

  if (patientId) {
    const { data: entries } = await supabase
      .from("waiting_list")
      .select("id, clinic_id, patient_id, doctor_id, preferred_date, preferred_time, service_id, status, created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ entries: entries ?? [] });
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
    return NextResponse.json({ entries: entries ?? [] });
  }

  return NextResponse.json(
    { error: "patientId, or doctorId and date are required" },
    { status: 400 },
  );
}, WAITING_LIST_ROLES);

/**
 * DELETE /api/booking/waiting-list
 *
 * Remove a patient from the waiting list.
 */
export const DELETE = withAuth(async (request, { supabase, profile }) => {
  try {
    const body = (await request.json()) as { entryId: string };

    if (!body.entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

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
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from("waiting_list")
      .delete()
      .eq("id", body.entryId)
      .eq("clinic_id", clinicId);

    if (error) {
      logger.warn("Operation failed", { context: "booking/waiting-list", error });
      return NextResponse.json({ error: "Failed to remove from waiting list" }, { status: 400 });
    }

    // Audit log for healthcare compliance
    await logAuditEvent({
      supabase,
      action: "waiting_list.removed",
      type: "booking",
      clinicId,
      description: `Waiting list entry ${body.entryId} removed`,
    });

    return NextResponse.json({ status: "removed", message: "Removed from waiting list" });
  } catch (err) {
    logger.warn("Operation failed", { context: "booking/waiting-list", error: err });
    return NextResponse.json({ error: "Failed to remove from waiting list" }, { status: 500 });
  }
}, WAITING_LIST_ROLES);
