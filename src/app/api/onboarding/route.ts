import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { logger } from "@/lib/logger";
import { onboardingSchema, safeParse } from "@/lib/validations";
/**
 * POST /api/onboarding
 *
 * Creates a new clinic with the selected clinic type during onboarding.
 * Inserts a clinic row with the clinic_type_key FK and creates the
 * clinic_admin user record.
 */
export const POST = withAuth(async (request, { supabase, user }) => {
  try {
    // Require email verification before allowing clinic creation
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Email verification required before creating a clinic" },
        { status: 403 },
      );
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
        return NextResponse.json(
          { error: "You have already created a clinic" },
          { status: 409 },
        );
      }
      // User has a profile (e.g. patient) but no clinic — deny escalation
      return NextResponse.json(
        { error: "Existing users cannot create new clinics" },
        { status: 403 },
      );
    }

    const raw = await request.json();
    const parsed = safeParse(onboardingSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

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

    // --- Idempotency guard ---
    // If a previous request created the clinic but failed on the user
    // insert (or the response was lost), re-check for an orphaned clinic
    // owned by this auth user before creating a new one.  This narrows
    // the race window where a retry would leave a duplicate clinic.
    const { data: orphanedClinic } = await supabase
      .from("clinics")
      .select("id")
      .eq("name", body.clinic_name)
      .eq("clinic_type_key", body.clinic_type_key)
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
        return NextResponse.json(
          { error: "A clinic with this name already exists" },
          { status: 409 },
        );
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
          config: {
            city: body.city ?? null,
            phone: body.phone,
            email: body.email ?? null,
          },
        })
        .select("id")
        .single();

      if (clinicError || !clinic) {
        void clinicError;
        return NextResponse.json(
          { error: "Failed to create clinic" },
          { status: 500 },
        );
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
        return NextResponse.json({
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

      return NextResponse.json(
        { error: "Failed to create admin user. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "created",
      message: "Clinic registered successfully",
      clinic_id: clinicId,
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "onboarding/route", error: err });
    return NextResponse.json(
      { error: "Failed to process onboarding" },
      { status: 500 },
    );
  }
}, null); // null is intentional: new users don't have a profile/role yet during onboarding; the handler performs its own authorization checks (email verification, no existing profile)
