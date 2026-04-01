/**
 * Pet Profiles API — CRUD for veterinary pet profiles.
 *
 * GET  /api/pets?ownerId=...  — List pets (optionally filtered by owner)
 * POST /api/pets              — Create a new pet profile
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiSupabaseError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const createPetSchema = z.object({
  owner_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  species: z.string().min(1).max(100),
  breed: z.string().max(200).optional(),
  weight_kg: z.number().positive().max(9999.99).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
  photo_url: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * GET /api/pets
 * Lists pet profiles for the current clinic.
 * Optionally filter by ownerId query param.
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiSuccess([]);
  }

  const ownerId = request.nextUrl.searchParams.get("ownerId");

  let query = auth.supabase
    .from("pet_profiles")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  const { data, error } = await query;
  if (error) return apiSupabaseError(error, "pets/list");

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist", "doctor", "patient"]);

/**
 * POST /api/pets
 * Create a new pet profile.
 */
export const POST = withAuthValidation(createPetSchema, async (body, _request, auth) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiSupabaseError({ message: "No clinic context" }, "pets/create");
  }

  const { data, error } = await auth.supabase
    .from("pet_profiles")
    .insert({
      clinic_id: clinicId,
      owner_id: body.owner_id,
      name: body.name,
      species: body.species,
      breed: body.breed ?? null,
      weight_kg: body.weight_kg ?? null,
      date_of_birth: body.date_of_birth ?? null,
      photo_url: body.photo_url ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return apiSupabaseError(error, "pets/create");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "pet_profile.created",
    type: "patient",
    clinicId,
    description: `Pet profile "${body.name}" (${body.species}) created for owner ${body.owner_id}`,
  });

  logger.info("Pet profile created", {
    context: "pets/create",
    petId: data.id,
    clinicId,
  });

  return apiSuccess(data, 201);
}, ["super_admin", "clinic_admin", "receptionist", "doctor"]);
