/**
 * CRUD API for Progress Tracking (Fitness Vertical)
 * GET  /api/progress-tracking — list progress records
 * POST /api/progress-tracking — record progress
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiSupabaseError, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { progressTrackingCreateSchema } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── GET: List progress records ──

export const GET = withAuth(
  async (request: NextRequest, { supabase, profile }: AuthContext) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const memberId = request.nextUrl.searchParams.get("member_id");

    // Fitness tables not yet in generated Supabase types (pending type regeneration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    let query = db
      .from("progress_tracking")
      .select("*, member:users(id, name), recorder:users(id, name)")
      .eq("clinic_id", clinicId)
      .order("recorded_at", { ascending: false });

    if (memberId) {
      query = query.eq("member_id", memberId);
    }

    const { data, error } = await query;
    if (error) return apiSupabaseError(error, "progress-tracking/list");
    return apiSuccess({ records: data });
  },
  ["super_admin", "clinic_admin", "receptionist", "doctor"],
);

// ── POST: Create progress record ──

export const POST = withAuthValidation(
  progressTrackingCreateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: record, error } = await db
      .from("progress_tracking")
      .insert({
        clinic_id: clinicId,
        member_id: data.member_id,
        recorded_by: profile.id,
        recorded_at: data.recorded_at ?? new Date().toISOString().slice(0, 10),
        weight_kg: data.weight_kg,
        body_fat_pct: data.body_fat_pct,
        muscle_mass_kg: data.muscle_mass_kg,
        bmi: data.bmi,
        notes: data.notes,
        photo_urls: data.photo_urls,
        measurements: data.measurements,
      })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "progress-tracking/create");

    await logAuditEvent({
      supabase,
      action: "progress_tracking.created",
      type: "admin",
      clinicId,
      description: `Recorded progress for member ${data.member_id}`,
      metadata: { record_id: record.id },
    });

    return apiSuccess({ record }, 201);
  },
  ["super_admin", "clinic_admin", "doctor"],
);
