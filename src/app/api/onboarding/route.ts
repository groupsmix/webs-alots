import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { ClinicType } from "@/lib/types/database";

export const runtime = "edge";

interface OnboardingRequestBody {
  clinic_type_key: string;
  category: string;
  clinic_name: string;
  owner_name: string;
  phone: string;
  email?: string;
  city?: string;
}

/**
 * POST /api/onboarding
 *
 * Creates a new clinic with the selected clinic type during onboarding.
 * Inserts a clinic row with the clinic_type_key FK and creates the
 * clinic_admin user record.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OnboardingRequestBody;

    if (!body.clinic_type_key || !body.clinic_name || !body.owner_name || !body.phone) {
      return NextResponse.json(
        { error: "clinic_type_key, clinic_name, owner_name, and phone are required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Map category to the legacy clinic type field
    const legacyTypeMap: Record<string, ClinicType> = {
      medical: "doctor",
      para_medical: "doctor",
      diagnostic: "doctor",
      pharmacy_retail: "pharmacy",
      clinics_centers: "dentist",
    };

    // Specific overrides for certain type_keys
    const typeKeyOverrides: Record<string, ClinicType> = {
      dental_clinic: "dentist",
      pharmacy: "pharmacy",
      parapharmacy: "pharmacy",
    };

    const legacyType: ClinicType =
      typeKeyOverrides[body.clinic_type_key] ??
      legacyTypeMap[body.category] ??
      "doctor";

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
      console.error("[onboarding] create clinic:", clinicError?.message);
      return NextResponse.json(
        { error: "Failed to create clinic" },
        { status: 500 },
      );
    }

    // Create the clinic admin user
    const { error: userError } = await supabase.from("users").insert({
      clinic_id: clinic.id,
      role: "clinic_admin",
      name: body.owner_name,
      phone: body.phone,
      email: body.email ?? null,
    });

    if (userError) {
      console.error("[onboarding] create user:", userError.message);
      // Clinic was created but user failed — still return success with warning
      return NextResponse.json({
        status: "partial",
        message: "Clinic created but admin user could not be added",
        clinic_id: clinic.id,
      });
    }

    return NextResponse.json({
      status: "created",
      message: "Clinic registered successfully",
      clinic_id: clinic.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process onboarding" },
      { status: 500 },
    );
  }
}
