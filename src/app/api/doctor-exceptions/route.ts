/**
 * GET  /api/doctor-exceptions          — list exception days for the clinic
 *   Query params: ?doctorId=uuid (optional, filters to one doctor)
 *
 * POST /api/doctor-exceptions          — mark a date as unavailable
 *   Body: { doctorId: string; date: "YYYY-MM-DD"; reason?: string }
 *
 * Authorization:
 *   • GET — any staff role within the tenant clinic.
 *   • POST — clinic_admin (for any doctor in the clinic) or doctor (only
 *     for themselves; doctorId from the body is ignored and replaced with
 *     the authenticated profile.id to prevent cross-doctor writes).
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── Validation schemas ─────────────────────────────────────────────────────

const createExceptionSchema = z.object({
  doctorId: z.string().uuid("doctorId must be a valid UUID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  reason: z.string().max(500).optional(),
});

// ── GET — list exceptions ──────────────────────────────────────────────────

export const GET = withAuth(async (request: NextRequest, { supabase }: AuthContext) => {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;
  const doctorId = request.nextUrl.searchParams.get("doctorId");

  let query = supabase
    .from("doctor_exceptions")
    .select("id, doctor_id, date, reason, created_at")
    .eq("clinic_id", clinicId)
    .order("date", { ascending: true });

  if (doctorId) {
    // Basic UUID format guard before hitting the DB
    if (!/^[0-9a-f-]{36}$/i.test(doctorId)) {
      return apiError("doctorId must be a valid UUID", 400);
    }
    query = query.eq("doctor_id", doctorId);
  }

  const { data: exceptions, error } = await query;

  if (error) {
    return apiError("Failed to fetch doctor exceptions", 500);
  }

  return apiSuccess({ exceptions: exceptions ?? [] });
}, STAFF_ROLES);

// ── POST — create exception ────────────────────────────────────────────────

export const POST = withAuthValidation(
  createExceptionSchema,
  async (body, _request, { supabase, profile }) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // SECURITY: ownership enforcement.
    // • doctors can only mark their own exception days; the body value is
    //   ignored to prevent a doctor from blocking another doctor's calendar.
    // • clinic_admin can mark for any doctor — verified below to be in the
    //   same clinic.
    const effectiveDoctorId = profile.role === "doctor" ? profile.id : body.doctorId;

    // Verify the (possibly overridden) doctor belongs to this clinic.
    const { data: doctor, error: doctorError } = await supabase
      .from("users")
      .select("id")
      .eq("id", effectiveDoctorId)
      .eq("clinic_id", clinicId)
      .eq("role", "doctor")
      .maybeSingle();

    if (doctorError || !doctor) {
      return apiNotFound("Doctor not found in this clinic");
    }

    const { data: exception, error: insertError } = await supabase
      .from("doctor_exceptions")
      .insert({
        doctor_id: effectiveDoctorId,
        clinic_id: clinicId,
        date: body.date,
        reason: body.reason ?? null,
      })
      .select("id, doctor_id, date, reason, created_at")
      .single();

    if (insertError) {
      // 23505 = unique_violation — exception already exists for this date
      if (insertError.code === "23505") {
        return apiError("Exception already exists for this date", 409, "DUPLICATE");
      }
      return apiError("Failed to create exception", 500);
    }

    await logAuditEvent({
      supabase,
      action: "doctor_exception_created",
      type: "admin",
      clinicId,
      description: `Exception marked for doctor ${effectiveDoctorId} on ${body.date}`,
      metadata: {
        doctorId: effectiveDoctorId,
        date: body.date,
        reason: body.reason,
        actorRole: profile.role,
      },
    });

    return apiSuccess({ exception }, 201);
  },
  ["clinic_admin", "doctor"],
);
