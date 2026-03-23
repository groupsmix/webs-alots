import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "edge";

/**
 * GET /api/clinic-features?type_key=general_medicine
 *
 * Returns the features_config for a given clinic type key.
 */
export async function GET(request: NextRequest) {
  try {
    const typeKey = request.nextUrl.searchParams.get("type_key");

    if (!typeKey) {
      return NextResponse.json(
        { error: "type_key query parameter is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("clinic_types")
      .select("features_config")
      .eq("type_key", typeKey)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Clinic type not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      type_key: typeKey,
      features_config: data.features_config,
    });
  } catch (err) {
    void err;
    return NextResponse.json(
      { error: "Failed to fetch clinic features" },
      { status: 500 },
    );
  }
}
