import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

/**
 * POST /api/impersonate
 *
 * Allows a super_admin to impersonate a clinic by storing the target clinic_id
 * in a secure cookie. The admin dashboard will read this cookie to switch context.
 *
 * Body: { clinicId: string, clinicName: string }
 *
 * DELETE /api/impersonate
 *
 * Ends the impersonation session by clearing the cookie.
 */
export const POST = withAuth(async (request, { supabase, user }) => {
  try {
    const body = await request.json();
    const { clinicId, clinicName } = body as { clinicId: string; clinicName: string };

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId is required" }, { status: 400 });
    }

    // Verify the clinic exists
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("id", clinicId)
      .single();

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    // Log the impersonation for security audit
    try {
      await supabase.from("activity_logs").insert({
        action: "impersonate_start",
        description: `Super admin started impersonating clinic: ${clinicName || clinic.name}`,
        clinic_id: clinicId,
        clinic_name: clinicName || clinic.name,
        actor: user.email || user.id,
        type: "auth",
      });
    } catch {
      // Activity log insert may fail if table doesn't exist — non-blocking
    }

    // Set impersonation cookie
    const response = NextResponse.json({
      success: true,
      clinicId,
      clinicName: clinicName || clinic.name,
    });

    response.cookies.set("sa_impersonate_clinic_id", clinicId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 4, // 4 hours
    });

    response.cookies.set("sa_impersonate_clinic_name", encodeURIComponent(clinicName || clinic.name), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 4,
    });

    return response;
  } catch (err) {
    console.error("[POST /api/impersonate] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Failed to start impersonation" }, { status: 500 });
  }
}, ["super_admin"]);

export const DELETE = withAuth(async (_request, { supabase, user }) => {
  try {
    // Log the end of impersonation
    if (user) {
      try {
        await supabase.from("activity_logs").insert({
          action: "impersonate_end",
          description: "Super admin ended impersonation session",
          actor: user.email || user.id,
          type: "auth",
        });
      } catch {
        // non-blocking
      }
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set("sa_impersonate_clinic_id", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set("sa_impersonate_clinic_name", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("[DELETE /api/impersonate] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Failed to end impersonation" }, { status: 500 });
  }
}, ["super_admin"]);
