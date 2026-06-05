/**
 * POST /api/waitlist
 *
 * Join the waitlist for a specific doctor.
 * Patients submit themselves; staff may supply an explicit patientId.
 */

import { z } from "zod";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { requireTenant } from "@/lib/tenant";

const joinSchema = z.object({
  doctorId: z.string().uuid("doctorId must be a UUID"),
  patientId: z.string().uuid("patientId must be a UUID").optional(),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "preferredDate must be YYYY-MM-DD")
    .optional(),
});

export const POST = withAuthValidation(
  joinSchema,
  async (body, _request, { supabase, profile }) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Resolve which patient to register
    const patientId = body.patientId ?? (profile.role === "patient" ? profile.id : undefined);

    if (!patientId) {
      return apiError("patientId is required for non-patient callers", 422, "VALIDATION_ERROR");
    }

    // Verify doctor belongs to this clinic
    const { data: doctor } = await supabase
      .from("users")
      .select("id")
      .eq("id", body.doctorId)
      .eq("clinic_id", clinicId)
      .eq("role", "doctor")
      .maybeSingle();

    if (!doctor) return apiNotFound("Doctor not found in this clinic");

    // Verify patient belongs to this clinic
    const { data: patient } = await supabase
      .from("users")
      .select("id")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .maybeSingle();

    if (!patient) return apiNotFound("Patient not found in this clinic");

    const { data: entry, error: insertErr } = await supabase
      .from("waitlist")
      .insert({
        clinic_id: clinicId,
        doctor_id: body.doctorId,
        patient_id: patientId,
        preferred_date: body.preferredDate ?? null,
      })
      .select("id")
      .single();

    if (insertErr) return apiError("Failed to join waitlist", 500);

    await logAuditEvent({
      supabase,
      action: "waitlist_joined",
      type: "booking",
      clinicId,
      description: `Patient ${patientId} joined waitlist for doctor ${body.doctorId}`,
      metadata: { waitlistId: entry.id, doctorId: body.doctorId, patientId },
    });

    return apiSuccess({ waitlistId: entry.id }, 201);
  },
  ["super_admin", "clinic_admin", "receptionist", "doctor", "patient"],
);
