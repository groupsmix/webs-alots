/**
 * CRUD API for Memberships (Fitness Vertical)
 * GET  /api/memberships — list memberships for clinic
 * POST /api/memberships — create a new membership
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiSupabaseError, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { membershipCreateSchema, membershipUpdateSchema } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── GET: List memberships ──

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
      .from("memberships")
      .select("*, membership_plans(name, price, duration_days)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (memberId) {
      query = query.eq("member_id", memberId);
    }

    const { data, error } = await query;
    if (error) return apiSupabaseError(error, "memberships/list");
    return apiSuccess({ memberships: data });
  },
  ["super_admin", "clinic_admin", "receptionist", "doctor"],
);

// ── POST: Create membership ──

export const POST = withAuthValidation(
  membershipCreateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Calculate end_date from plan duration
    const { data: plan } = await db
      .from("membership_plans")
      .select("duration_days")
      .eq("id", data.plan_id)
      .eq("clinic_id", clinicId)
      .single();

    if (!plan) {
      return apiError("Plan not found", 404, "PLAN_NOT_FOUND");
    }

    const startDate = data.start_date ?? new Date().toISOString().slice(0, 10);
    const endDate = new Date(
      new Date(startDate).getTime() + plan.duration_days * 86400000,
    ).toISOString().slice(0, 10);

    const { data: membership, error } = await db
      .from("memberships")
      .insert({
        clinic_id: clinicId,
        member_id: data.member_id,
        plan_id: data.plan_id,
        start_date: startDate,
        end_date: endDate,
        auto_renew: data.auto_renew,
        notes: data.notes,
      })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "memberships/create");

    await logAuditEvent({
      supabase,
      action: "membership.created",
      type: "admin",
      clinicId,
      description: `Created membership for member ${data.member_id}`,
      metadata: { membership_id: membership.id, plan_id: data.plan_id },
    });

    return apiSuccess({ membership }, 201);
  },
  ["super_admin", "clinic_admin", "receptionist"],
);

// ── PATCH: Update membership ──

export const PATCH = withAuthValidation(
  membershipUpdateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const { id, ...updates } = data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: membership, error } = await db
      .from("memberships")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (error) return apiSupabaseError(error, "memberships/update");

    await logAuditEvent({
      supabase,
      action: "membership.updated",
      type: "admin",
      clinicId,
      description: `Updated membership: ${id}`,
      metadata: { membership_id: id },
    });

    return apiSuccess({ membership });
  },
  ["super_admin", "clinic_admin", "receptionist"],
);
