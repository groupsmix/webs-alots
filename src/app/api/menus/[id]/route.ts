/**
 * Menu Detail API — Read, Update, Delete a single menu.
 *
 * GET    /api/menus/[id]  — Get a menu with its items
 * PATCH  /api/menus/[id]  — Update a menu
 * DELETE /api/menus/[id]  — Delete a menu (cascades to menu_items)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiNotFound, apiSupabaseError, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { safeParse } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const updateMenuSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

/** Extract the menu ID from the URL path: /api/menus/[id] */
function extractId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split("/");
  return segments[segments.length - 1];
}

/**
 * GET /api/menus/[id]
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  const { data, error } = await auth.supabase
    .from("menus")
    .select("*, menu_items(*)")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (error || !data) return apiNotFound("Menu not found");

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist"]);

/**
 * PATCH /api/menus/[id]
 */
export const PATCH = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 422);
  }

  const result = safeParse(updateMenuSchema, body);
  if (!result.success) return apiError(result.error, 422);

  const { data, error } = await auth.supabase
    .from("menus")
    .update(result.data)
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .select()
    .single();

  if (error) return apiSupabaseError(error, "menus/update");
  if (!data) return apiNotFound("Menu not found");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "menu.updated",
    type: "admin",
    clinicId,
    description: `Menu ${id} updated`,
  });

  return apiSuccess(data);
}, ["super_admin", "clinic_admin"]);

/**
 * DELETE /api/menus/[id]
 */
export const DELETE = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  const { error } = await auth.supabase
    .from("menus")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return apiSupabaseError(error, "menus/delete");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "menu.deleted",
    type: "admin",
    clinicId,
    description: `Menu ${id} deleted`,
  });

  return apiSuccess({ deleted: true });
}, ["super_admin", "clinic_admin"]);
