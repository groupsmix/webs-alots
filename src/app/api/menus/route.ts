/**
 * Menus API — CRUD for restaurant menus.
 *
 * GET  /api/menus  — List menus for the current clinic
 * POST /api/menus  — Create a new menu
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiSupabaseError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const createMenuSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional().default(0),
});

/**
 * GET /api/menus
 */
export const GET = withAuth(async (_request: NextRequest, auth: AuthContext) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiSuccess([]);

  const { data, error } = await auth.supabase
    .from("menus")
    .select("*, menu_items(count)")
    .eq("clinic_id", clinicId)
    .order("sort_order", { ascending: true });

  if (error) return apiSupabaseError(error, "menus/list");

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist"]);

/**
 * POST /api/menus
 */
export const POST = withAuthValidation(createMenuSchema, async (body, _request, auth) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiSupabaseError({ message: "No clinic context" }, "menus/create");
  }

  const { data, error } = await auth.supabase
    .from("menus")
    .insert({
      clinic_id: clinicId,
      name: body.name,
      description: body.description ?? null,
      is_active: body.is_active,
      sort_order: body.sort_order,
    })
    .select()
    .single();

  if (error) return apiSupabaseError(error, "menus/create");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "menu.created",
    type: "admin",
    clinicId,
    description: `Menu "${body.name}" created`,
  });

  return apiSuccess(data, 201);
}, ["super_admin", "clinic_admin"]);
