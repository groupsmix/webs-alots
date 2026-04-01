/**
 * Restaurant Table Detail API — Read, Update, Delete a single table.
 *
 * GET    /api/restaurant-tables/[id]  — Get a table
 * PATCH  /api/restaurant-tables/[id]  — Update a table
 * DELETE /api/restaurant-tables/[id]  — Delete a table
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiNotFound, apiSupabaseError, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { safeParse } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const updateTableSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  capacity: z.number().int().positive().max(100).optional(),
  zone: z.string().max(200).nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

/** Extract the table ID from the URL path: /api/restaurant-tables/[id] */
function extractId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split("/");
  return segments[segments.length - 1];
}

/**
 * GET /api/restaurant-tables/[id]
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  const { data, error } = await auth.supabase
    .from("restaurant_tables")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (error || !data) return apiNotFound("Table not found");

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist"]);

/**
 * PATCH /api/restaurant-tables/[id]
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

  const result = safeParse(updateTableSchema, body);
  if (!result.success) return apiError(result.error, 422);

  const { data, error } = await auth.supabase
    .from("restaurant_tables")
    .update(result.data)
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .select()
    .single();

  if (error) return apiSupabaseError(error, "restaurant-tables/update");
  if (!data) return apiNotFound("Table not found");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "restaurant_table.updated",
    type: "admin",
    clinicId,
    description: `Table ${id} updated`,
  });

  return apiSuccess(data);
}, ["super_admin", "clinic_admin"]);

/**
 * DELETE /api/restaurant-tables/[id]
 */
export const DELETE = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  const { error } = await auth.supabase
    .from("restaurant_tables")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return apiSupabaseError(error, "restaurant-tables/delete");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "restaurant_table.deleted",
    type: "admin",
    clinicId,
    description: `Table ${id} deleted`,
  });

  return apiSuccess({ deleted: true });
}, ["super_admin", "clinic_admin"]);
