/**
 * CRUD API for Class Enrollments (Fitness Vertical)
 * GET  /api/class-enrollments — list enrollments
 * POST /api/class-enrollments — enroll a member
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiSupabaseError, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { classEnrollmentCreateSchema, classEnrollmentUpdateSchema } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── GET: List enrollments ──

export const GET = withAuth(
  async (request: NextRequest, { supabase, profile }: AuthContext) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const classId = request.nextUrl.searchParams.get("class_id");
    const memberId = request.nextUrl.searchParams.get("member_id");
    const date = request.nextUrl.searchParams.get("date");

    // Fitness tables not yet in generated Supabase types (pending type regeneration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    let query = db
      .from("class_enrollments")
      .select("*, classes(name, start_time, duration_min), member:users(id, name)")
      .eq("clinic_id", clinicId)
      .order("enrollment_date", { ascending: false });

    if (classId) query = query.eq("class_id", classId);
    if (memberId) query = query.eq("member_id", memberId);
    if (date) query = query.eq("enrollment_date", date);

    const { data, error } = await query;
    if (error) return apiSupabaseError(error, "class-enrollments/list");
    return apiSuccess({ enrollments: data });
  },
  ["super_admin", "clinic_admin", "receptionist", "doctor"],
);

// ── POST: Create enrollment ──

export const POST = withAuthValidation(
  classEnrollmentCreateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: enrollment, error } = await db
      .from("class_enrollments")
      .insert({
        clinic_id: clinicId,
        class_id: data.class_id,
        member_id: data.member_id,
        enrollment_date: data.enrollment_date ?? new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "class-enrollments/create");

    await logAuditEvent({
      supabase,
      action: "class_enrollment.created",
      type: "admin",
      clinicId,
      description: `Enrolled member ${data.member_id} in class ${data.class_id}`,
      metadata: { enrollment_id: enrollment.id },
    });

    return apiSuccess({ enrollment }, 201);
  },
  ["super_admin", "clinic_admin", "receptionist"],
);

// ── PATCH: Update enrollment (check-in/out, status) ──

export const PATCH = withAuthValidation(
  classEnrollmentUpdateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const { id, ...updates } = data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: enrollment, error } = await db
      .from("class_enrollments")
      .update(updates)
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (error) return apiSupabaseError(error, "class-enrollments/update");

    await logAuditEvent({
      supabase,
      action: "class_enrollment.updated",
      type: "admin",
      clinicId,
      description: `Updated enrollment: ${id}`,
      metadata: { enrollment_id: id },
    });

    return apiSuccess({ enrollment });
  },
  ["super_admin", "clinic_admin", "receptionist"],
);
