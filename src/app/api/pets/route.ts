/**
 * Pet Profiles API (Veterinary Vertical)
 *
 * CRUD operations for pet profiles in veterinary clinics.
 * Each pet is linked to an owner (patient/client) and scoped to a clinic.
 *
 * GET    /api/pets?owner_id=...  — List pets for an owner (or all pets in clinic)
 * POST   /api/pets               — Create a new pet profile
 * PATCH  /api/pets               — Update an existing pet profile
 * DELETE /api/pets?id=...        — Soft-delete a pet profile (sets is_active = false)
 */

import { apiError, apiSuccess, apiInternalError, apiNotFound } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { petProfileCreateSchema, petProfileUpdateSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/pets?owner_id=...
 *
 * List pet profiles. If owner_id is provided, filters to that owner's pets.
 * Otherwise returns all pets for the authenticated user's clinic.
 */
export const GET = withAuth(async (request, { supabase, profile }) => {
  try {
    if (!profile.clinic_id) {
      return apiError("No clinic associated with this account", 403);
    }

    const ownerId = request.nextUrl.searchParams.get("owner_id");
    const petId = request.nextUrl.searchParams.get("id");

    // Single pet by ID
    if (petId) {
      const { data, error } = await supabase
        .from("pet_profiles")
        .select("*")
        .eq("id", petId)
        .eq("clinic_id", profile.clinic_id ?? "")
        .single();

      if (error || !data) {
        return apiNotFound("Pet profile not found");
      }

      return apiSuccess({ pet: data });
    }

    // List pets
    let query = supabase
      .from("pet_profiles")
      .select("*")
      .eq("clinic_id", profile.clinic_id ?? "")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn("Failed to fetch pet profiles", { context: "pets", error });
      return apiInternalError("Failed to fetch pet profiles");
    }

    return apiSuccess({ pets: data ?? [] });
  } catch (err) {
    logger.warn("Operation failed", { context: "pets", error: err });
    return apiInternalError("Failed to process request");
  }
}, ["super_admin", "clinic_admin", "doctor", "receptionist", "patient"]);

/**
 * POST /api/pets
 *
 * Create a new pet profile.
 */
export const POST = withAuthValidation(petProfileCreateSchema, async (body, _request, { supabase, profile }) => {
  if (!profile.clinic_id) {
    return apiError("No clinic associated with this account", 403);
  }

  const { data, error } = await supabase
    .from("pet_profiles")
    .insert({
      clinic_id: profile.clinic_id,
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

  if (error) {
    logger.warn("Failed to create pet profile", { context: "pets", error });
    return apiInternalError("Failed to create pet profile");
  }

  return apiSuccess({ pet: data }, 201);
}, ["super_admin", "clinic_admin", "doctor", "receptionist"]);

/**
 * PATCH /api/pets
 *
 * Update an existing pet profile.
 */
export const PATCH = withAuthValidation(petProfileUpdateSchema, async (body, _request, { supabase, profile }) => {
  if (!profile.clinic_id) {
    return apiError("No clinic associated with this account", 403);
  }

  const { id, ...updates } = body;

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowedKeys = [
    "name", "species", "breed", "weight_kg",
    "date_of_birth", "photo_url", "notes", "is_active",
  ];

  for (const key of allowedKeys) {
    if (key in updates) {
      updatePayload[key] = (updates as Record<string, unknown>)[key];
    }
  }

  const { data, error } = await supabase
    .from("pet_profiles")
    // @ts-expect-error -- Supabase generated types lag behind actual DB schema
    .update(updatePayload)
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .select()
    .single();

  if (error) {
    logger.warn("Failed to update pet profile", { context: "pets", error });
    return apiInternalError("Failed to update pet profile");
  }

  return apiSuccess({ pet: data });
}, ["super_admin", "clinic_admin", "doctor", "receptionist"]);

/**
 * DELETE /api/pets?id=...
 *
 * Soft-delete a pet profile (sets is_active = false).
 */
export const DELETE = withAuth(async (request, { supabase, profile }) => {
  if (!profile.clinic_id) {
    return apiError("No clinic associated with this account", 403);
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return apiError("id query parameter is required");
  }

  const { error } = await supabase
    .from("pet_profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);

  if (error) {
    logger.warn("Failed to delete pet profile", { context: "pets", error });
    return apiInternalError("Failed to delete pet profile");
  }

  return apiSuccess({ deleted: true });
}, ["super_admin", "clinic_admin", "doctor"]);
