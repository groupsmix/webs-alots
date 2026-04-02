/**
 * CRUD API for Classes (Fitness Vertical)
 * GET  /api/classes — list classes for clinic
 * POST /api/classes — create a new class
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiSupabaseError, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { classCreateSchema, classUpdateSchema } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── GET: List classes ──

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
      .from("classes")
      .select("*, trainer:users(id, name)")
      .eq("clinic_id", clinicId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) return apiSupabaseError(error, "classes/list");
    return apiSuccess({ classes: data });
  },
  ["super_admin", "clinic_admin", "receptionist", "doctor"],
);

// ── POST: Create class ──

export const POST = withAuthValidation(
  classCreateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: cls, error } = await db
      .from("classes")
      .insert({ ...data, clinic_id: clinicId })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "classes/create");

    await logAuditEvent({
      supabase,
      action: "class.created",
      type: "admin",
      clinicId,
      description: `Created class: ${data.name}`,
      metadata: { class_id: cls.id },
    });

    return apiSuccess({ class: cls }, 201);
  },
  ["super_admin", "clinic_admin"],
);

// ── PATCH: Update class ──

export const PATCH = withAuthValidation(
  classUpdateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const { id, ...updates } = data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: cls, error } = await db
      .from("classes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (error) return apiSupabaseError(error, "classes/update");

    await logAuditEvent({
      supabase,
      action: "class.updated",
      type: "admin",
      clinicId,
      description: `Updated class: ${id}`,
      metadata: { class_id: id },
    });

    return apiSuccess({ class: cls });
  },
  ["super_admin", "clinic_admin"],
);
