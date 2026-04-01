/**
 * Restaurant Tables API — CRUD for table management.
 *
 * GET  /api/restaurant-tables  — List tables for the current restaurant
 * POST /api/restaurant-tables  — Create a new table
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiSupabaseError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const createTableSchema = z.object({
  name: z.string().min(1).max(200),
  capacity: z.number().int().positive().max(100),
  zone: z.string().max(200).optional(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional().default(0),
});

/**
 * GET /api/restaurant-tables
 */
export const GET = withAuth(async (_request: NextRequest, auth: AuthContext) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiSuccess([]);

  const { data, error } = await auth.supabase
    .from("restaurant_tables")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("sort_order", { ascending: true });

  if (error) return apiSupabaseError(error, "restaurant-tables/list");

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist"]);

/**
 * POST /api/restaurant-tables
 */
export const POST = withAuthValidation(createTableSchema, async (body, _request, auth) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiSupabaseError({ message: "No clinic context" }, "restaurant-tables/create");
  }

  const { data, error } = await auth.supabase
    .from("restaurant_tables")
    .insert({
      clinic_id: clinicId,
      name: body.name,
      capacity: body.capacity,
      zone: body.zone ?? null,
      is_active: body.is_active,
      sort_order: body.sort_order,
    })
    .select()
    .single();

  if (error) return apiSupabaseError(error, "restaurant-tables/create");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "restaurant_table.created",
    type: "admin",
    clinicId,
    description: `Table "${body.name}" (capacity: ${body.capacity}) created`,
  });

  return apiSuccess(data, 201);
}, ["super_admin", "clinic_admin"]);
