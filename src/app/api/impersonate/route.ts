import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

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
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify the current user is a super_admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden — super_admin only" }, { status: 403 });
    }

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
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4, // 4 hours
    });

    response.cookies.set("sa_impersonate_clinic_name", encodeURIComponent(clinicName || clinic.name), {
      httpOnly: false, // readable by client JS for display
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set("sa_impersonate_clinic_name", "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
