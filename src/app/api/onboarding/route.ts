import { apiError, apiForbidden, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { onboardingSchema } from "@/lib/validations";
import { withAuth as _withAuth } from "@/lib/with-auth";
/**
 * POST /api/onboarding
 *
 * Creates a new clinic with the selected clinic type during onboarding.
 * Inserts a clinic row with the clinic_type_key FK and creates the
 * clinic_admin user record.
 */
export const POST = withAuthValidation(onboardingSchema, async (body, request, { supabase, user }) => {
    // Require email verification before allowing clinic creation
    if (!user.email_confirmed_at) {
      return apiForbidden("Email verification required before creating a clinic");
    }

    // Only users without an existing profile may onboard.
    // This prevents any already-registered user (patient, doctor, etc.)
    // from creating additional clinics or escalating privileges.
    const { data: existingProfile } = await supabase
      .from("users")
      .select("clinic_id, role")
      .eq("auth_id", user.id)
      .single();

    if (existingProfile) {
      if (existingProfile.clinic_id) {
        return apiError("You have already created a clinic", 409);
      }
      // User has a profile (e.g. patient) but no clinic — deny escalation
      return apiForbidden("Existing users cannot create new clinics");
    }

    // Map category to the legacy clinic type field
    const legacyTypeMap: Record<string, string> = {
      medical: "doctor",
      para_medical: "doctor",
      diagnostic: "doctor",
      pharmacy_retail: "pharmacy",
      clinics_centers: "dentist",
    };

    // Specific overrides for certain type_keys
    const typeKeyOverrides: Record<string, string> = {
      dental_clinic: "dentist",
      pharmacy: "pharmacy",
      parapharmacy: "pharmacy",
    };

    const legacyType =
      typeKeyOverrides[body.clinic_type_key] ??
      (body.category ? legacyTypeMap[body.category] : undefined) ??
      "doctor";

    // Auto-generate subdomain from clinic name (lowercase, alphanumeric + hyphens)
    // Moved above the orphan check so the subdomain can be used as an
    // additional filter to prevent name-collision attacks.
    const subdomain = body.clinic_name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-");

    // --- Idempotency guard ---
    // If a previous request created the clinic but failed on the user
    // insert (or the response was lost), re-check for an orphaned clinic
    // owned by this auth user before creating a new one.  This narrows
    // the race window where a retry would leave a duplicate clinic.
    //
    // SECURITY FIX: The previous query matched only on (name, type_key)
    // which could collide with another user's clinic. Now we also filter
    // by the generated subdomain which includes the name slug, AND verify
    // no admin user exists yet (checked below). Combined, this prevents
    // a malicious user from claiming an existing clinic by guessing its
    // name during onboarding.
    // FIX: When `subdomain` is empty (e.g. Arabic-only clinic names where the
    // ASCII regex strips all characters), the insert below stores NULL via
    // `subdomain: subdomain || null`. In Postgres, `subdomain = ''` does NOT
    // match `subdomain IS NULL`, so we must use `.is(..., null)` for the
    // null case to keep the orphan-detection idempotency guarantee.
    const orphanBase = supabase
      .from("clinics")
      .select("id")
      .eq("name", body.clinic_name)
      .eq("clinic_type_key", body.clinic_type_key);
    const orphanQuery = subdomain
      ? orphanBase.eq("subdomain", subdomain)
      : orphanBase.is("subdomain", null);
    const { data: orphanedClinic } = await orphanQuery
      .limit(1)
      .maybeSingle();

    let clinicId: string;

    if (orphanedClinic) {
      // Verify no admin user exists for this clinic yet (true orphan)
      const { data: existingAdmin } = await supabase
        .from("users")
        .select("id")
        .eq("clinic_id", orphanedClinic.id)
        .eq("role", "clinic_admin")
        .limit(1)
        .maybeSingle();

      if (existingAdmin) {
        // Clinic already has an admin — this is a genuine duplicate
        return apiError("A clinic with this name already exists", 409);
      }

      // Reuse the orphaned clinic instead of creating another
      clinicId = orphanedClinic.id;
    } else {
      // Create the clinic
      const { data: clinic, error: clinicError } = await supabase.from("clinics")
        .insert({
          name: body.clinic_name,
          type: legacyType,
          clinic_type_key: body.clinic_type_key,
          tier: "pro",
          status: "active",
          subdomain: subdomain || null,
          config: {
            city: body.city ?? null,
            phone: body.phone,
            email: body.email ?? null,
          },
          // Also set direct columns so public branding queries work
          phone: body.phone || null,
          owner_email: body.email ?? null,
          owner_name: body.owner_name || null,
          city: body.city ?? null,
        })
        .select("id")
        .single();

      if (clinicError || !clinic) {
        void clinicError;
        return apiInternalError("Failed to create clinic");
      }
      clinicId = clinic.id;
    }

    // Create the clinic admin user
    const { error: userError } = await supabase.from("users").insert({
      auth_id: user.id,
      clinic_id: clinicId,
      role: "clinic_admin",
      name: body.owner_name,
      phone: body.phone,
      email: body.email ?? user.email ?? null,
    });

    if (userError) {
      void userError;

      // If this is a unique constraint violation on auth_id, the user
      // was already created (concurrent retry) — treat as success.
      if (userError.code === "23505") {
        return apiSuccess({
          status: "created",
          message: "Clinic registered successfully (deduplicated)",
          clinic_id: clinicId,
        });
      }

      // Roll back the orphaned clinic so the user can retry onboarding
      const { error: deleteError } = await supabase
        .from("clinics")
        .delete()
        .eq("id", clinicId);

      if (deleteError) {
        void deleteError;
      }

      return apiInternalError("Failed to create admin user. Please try again.");
    }

    return apiSuccess({
      status: "created",
      message: "Clinic registered successfully",
      clinic_id: clinicId,
      subdomain: subdomain || null,
    });
}, null); // null is intentional: new users don't have a profile/role yet during onboarding; the handler performs its own authorization checks (email verification, no existing profile)
