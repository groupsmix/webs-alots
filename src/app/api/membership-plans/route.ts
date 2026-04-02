/**
 * CRUD API for Membership Plans (Fitness Vertical)
 * GET  /api/membership-plans — list plans for clinic
 * POST /api/membership-plans — create a new plan
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiSupabaseError, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { membershipPlanCreateSchema, membershipPlanUpdateSchema } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── GET: List membership plans ──

export const GET = withAuth(
  async (_request: NextRequest, { supabase, profile }: AuthContext) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    // Fitness tables not yet in generated Supabase types (pending type regeneration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data, error } = await db
      .from("membership_plans")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("sort_order", { ascending: true });

    if (error) return apiSupabaseError(error, "membership-plans/list");
    return apiSuccess({ plans: data });
  },
  ["super_admin", "clinic_admin", "receptionist", "doctor"],
);

// ── POST: Create membership plan ──

export const POST = withAuthValidation(
  membershipPlanCreateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: plan, error } = await db
      .from("membership_plans")
      .insert({ ...data, clinic_id: clinicId })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "membership-plans/create");

    await logAuditEvent({
      supabase,
      action: "membership_plan.created",
      type: "admin",
      clinicId,
      description: `Created membership plan: ${data.name}`,
      metadata: { plan_id: plan.id },
    });

    return apiSuccess({ plan }, 201);
  },
  ["super_admin", "clinic_admin"],
);

// ── PATCH: Update membership plan ──

export const PATCH = withAuthValidation(
  membershipPlanUpdateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const { id, ...updates } = data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: plan, error } = await db
      .from("membership_plans")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (error) return apiSupabaseError(error, "membership-plans/update");

    await logAuditEvent({
      supabase,
      action: "membership_plan.updated",
      type: "admin",
      clinicId,
      description: `Updated membership plan: ${id}`,
      metadata: { plan_id: id },
    });

    return apiSuccess({ plan });
  },
  ["super_admin", "clinic_admin"],
);
