import { apiSuccess, apiInternalError, apiNotFound, apiUnauthorized } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logSecurityEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { impersonateSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

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

    // AUTH-02: Prevent impersonation of other super_admin accounts.
    // Check if the target clinic has any super_admin users — if so, block.
    const { data: superAdminsInClinic } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("role", "super_admin")
      .limit(1);

    if (superAdminsInClinic && superAdminsInClinic.length > 0) {
      return apiUnauthorized("Cannot impersonate a clinic with super_admin accounts");
    }

    const reauthClient = await createClient();
    const { error: reauthError } = await reauthClient.auth.signInWithPassword({
      email: user.email ?? "",
      password,
    });

    if (reauthError) {
      return apiUnauthorized("Re-authentication failed. Please verify your password.");
    }

    // Verify the clinic exists
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("id", clinicId)
      .single();

    if (!clinic) {
      return apiNotFound("Clinic not found");
    }

    // AUTH-02: Log IP and user agent for every impersonation event
    const clientIp = request.headers.get("cf-connecting-ip")
      ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "unknown";

    // Log the impersonation for security audit
    await logSecurityEvent({
      supabase,
      action: "impersonate.start",
      actor: user.email || user.id,
      clinicId,
      clinicName: clinicName || clinic.name,
      description: `Super admin started impersonating clinic: ${clinicName || clinic.name}. Reason: ${reason}`,
      metadata: { reason, targetClinicId: clinicId, ipAddress: clientIp, userAgent },
    });

    // Set impersonation cookie
    const response = apiSuccess({
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

    // F-11: Cookie is httpOnly to prevent XSS exfiltration.
    // The impersonation banner reads the reason via a server action instead.
    response.cookies.set("sa_impersonate_reason", encodeURIComponent(reason), {
      httpOnly: true,
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

    const response = apiSuccess({ success: true });

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
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    logger.warn("Operation failed", { context: "impersonate/route", error: err });
    return apiInternalError("Failed to end impersonation");
  }
}, ["super_admin"]);
