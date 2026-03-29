import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { logger } from "@/lib/logger";
import { impersonateSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";
import { createClient } from "@/lib/supabase-server";
import { logSecurityEvent } from "@/lib/audit-log";

/**
 * POST /api/impersonate
 *
 * Allows a super_admin to impersonate a clinic by storing the target clinic_id
 * in a secure cookie. The admin dashboard will read this cookie to switch context.
 *
 * Body: { clinicId: string, clinicName: string, reason: string }
 *
 * DELETE /api/impersonate
 *
 * Ends the impersonation session by clearing the cookie.
 */
export const POST = withAuthValidation(impersonateSchema, async (body, request, { supabase, user }) => {
    const { clinicId, clinicName, password, reason } = body;

    const reauthClient = await createClient();
    const { error: reauthError } = await reauthClient.auth.signInWithPassword({
      email: user.email ?? "",
      password,
    });

    if (reauthError) {
      return NextResponse.json(
        { error: "Re-authentication failed. Please verify your password." },
        { status: 401 },
      );
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
    await logSecurityEvent({
      supabase,
      action: "impersonate.start",
      actor: user.email || user.id,
      clinicId,
      clinicName: clinicName || clinic.name,
      description: `Super admin started impersonating clinic: ${clinicName || clinic.name}. Reason: ${reason}`,
      metadata: { reason, targetClinicId: clinicId },
    });

    // Set impersonation cookie
    const response = NextResponse.json({
      success: true,
      clinicId,
      clinicName: clinicName || clinic.name,
    });

    const sessionMaxAge = 60 * 30; // 30 minutes — time-limited for safety

    response.cookies.set("sa_impersonate_clinic_id", clinicId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: sessionMaxAge,
    });

    response.cookies.set("sa_impersonate_clinic_name", encodeURIComponent(clinicName || clinic.name), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: sessionMaxAge,
    });

    response.cookies.set("sa_impersonate_reason", encodeURIComponent(reason), {
      httpOnly: false, // readable by banner component
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: sessionMaxAge,
    });

    return response;
}, ["super_admin"]);

export const DELETE = withAuth(async (_request, { supabase, user }) => {
  try {
    // Log the end of impersonation
    if (user) {
      await logSecurityEvent({
        supabase,
        action: "impersonate.end",
        actor: user.email || user.id,
        clinicId: "system",
        description: "Super admin ended impersonation session",
      });
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

    response.cookies.set("sa_impersonate_reason", "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    logger.warn("Operation failed", { context: "impersonate/route", error: err });
    return NextResponse.json({ error: "Failed to end impersonation" }, { status: 500 });
  }
}, ["super_admin"]);
