import { NextResponse } from "next/server";
import { clinicConfig } from "@/config/clinic.config";
import { withAuth } from "@/lib/with-auth";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { logAuditEvent } from "@/lib/audit-log";
import { WAITING_LIST_STATUS } from "@/lib/types/database";
import type { UserRole } from "@/lib/types/database";

export const runtime = "edge";

const ALL_ROLES: UserRole[] = ["super_admin", "clinic_admin", "receptionist", "doctor", "patient"];

/**
 * POST /api/booking/waiting-list
 *
 * Add a patient to the waiting list.
 */
export const POST = withAuth(async (request, { supabase }) => {
  try {
    const body = (await request.json()) as {
      patientId: string;
      patientName: string;
      patientPhone?: string;
      doctorId: string;
      preferredDate: string;
      preferredTime?: string;
      serviceId?: string;
    };

    if (!body.patientId || !body.patientName || !body.doctorId || !body.preferredDate) {
      return NextResponse.json(
        { error: "patientId, patientName, doctorId, and preferredDate are required" },
        { status: 400 },
      );
    }

    // Input length validation to prevent DoS via oversized payloads
    if (body.patientName.length > 200 || (body.patientPhone && body.patientPhone.length > 30)) {
      return NextResponse.json({ error: "Input exceeds maximum allowed length" }, { status: 400 });
    }

    // Find or create patient (prefer phone-based lookup to avoid name collisions)
    const patientId = await findOrCreatePatient(
      supabase, clinicConfig.clinicId, body.patientId, body.patientName,
      { phone: body.patientPhone },
    );
    if (!patientId) {
      return NextResponse.json({ error: "Failed to resolve patient" }, { status: 500 });
    }

    const { data: entry, error } = await supabase
      .from("waiting_list")
      .insert({
        clinic_id: clinicConfig.clinicId,
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
      console.error("[POST /api/booking/waiting-list] Error:", error?.message);
      return NextResponse.json({ error: "Failed to add to waiting list" }, { status: 400 });
    }

    // Audit log for healthcare compliance
    await logAuditEvent({
      supabase,
      action: "waiting_list.added",
      type: "booking",
      clinicId: clinicConfig.clinicId,
      description: `Patient ${patientId} added to waiting list (entry ${entry.id}) for doctor ${body.doctorId} on ${body.preferredDate}`,
    });

    return NextResponse.json({
      status: "added",
      message: "Added to waiting list",
      entryId: entry.id,
    });
  } catch (err) {
    console.error("[POST /api/booking/waiting-list] Unexpected error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Failed to add to waiting list" }, { status: 500 });
  }
}, ALL_ROLES);

/**
 * GET /api/booking/waiting-list?patientId=...  OR  ?doctorId=...&date=...
 *
 * Get waiting list entries.
 */
export const GET = withAuth(async (request, { supabase }) => {
  const patientId = request.nextUrl.searchParams.get("patientId");
  const doctorId = request.nextUrl.searchParams.get("doctorId");
  const date = request.nextUrl.searchParams.get("date");
  const time = request.nextUrl.searchParams.get("time");

  const clinicId = clinicConfig.clinicId;

  if (patientId) {
    const { data: entries } = await supabase
      .from("waiting_list")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ entries: entries ?? [] });
  }

  if (doctorId && date) {
    let q = supabase
      .from("waiting_list")
      .select("*")
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
}, ALL_ROLES);

/**
 * DELETE /api/booking/waiting-list
 *
 * Remove a patient from the waiting list.
 */
export const DELETE = withAuth(async (request, { supabase }) => {
  try {
    const body = (await request.json()) as { entryId: string };

    if (!body.entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("waiting_list")
      .delete()
      .eq("id", body.entryId)
      .eq("clinic_id", clinicConfig.clinicId);

    if (error) {
      console.error("[DELETE /api/booking/waiting-list] Error:", error.message);
      return NextResponse.json({ error: "Failed to remove from waiting list" }, { status: 400 });
    }

    // Audit log for healthcare compliance
    await logAuditEvent({
      supabase,
      action: "waiting_list.removed",
      type: "booking",
      clinicId: clinicConfig.clinicId,
      description: `Waiting list entry ${body.entryId} removed`,
    });

    return NextResponse.json({ status: "removed", message: "Removed from waiting list" });
  } catch (err) {
    console.error("[DELETE /api/booking/waiting-list] Unexpected error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Failed to remove from waiting list" }, { status: 500 });
  }
}, ALL_ROLES);
