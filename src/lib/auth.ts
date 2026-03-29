"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  loginLimiter,
  accountLockoutLimiter,
  otpSendLimiter,
  passwordResetLimiter,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { logAuthEvent } from "@/lib/audit-log";
import { t } from "@/lib/i18n";

/**
 * Phone auth feature flag.
 *
 * When `false` (the default), all phone/OTP server actions reject
 * immediately — even if a caller somehow bypasses the UI gate.
 * Flip to `"true"` only after Twilio credentials are configured in
 * Supabase Dashboard and end-to-end SMS delivery is verified.
 */
function isPhoneAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";
}

// ============================================================
// Types
// ============================================================

export interface UserProfile {
  id: string;
  auth_id: string;
  clinic_id: string | null;
  role: "super_admin" | "clinic_admin" | "receptionist" | "doctor" | "patient";
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

// Role to dashboard path mapping
const ROLE_DASHBOARD_MAP: Record<UserProfile["role"], string> = {
  super_admin: "/super-admin/dashboard",
  clinic_admin: "/admin/dashboard",
  receptionist: "/receptionist/dashboard",
  doctor: "/doctor/dashboard",
  patient: "/patient/dashboard",
};

// ============================================================
// Auth Actions
// ============================================================

/**
 * Extract client IP from request headers for server action rate limiting.
 *
 * Only CF-Connecting-IP is used — it is set by Cloudflare's edge and cannot
 * be spoofed by the client. X-Forwarded-For is intentionally NOT used because
 * it is attacker-controlled when the request does not pass through a trusted
 * proxy that overwrites it.
 */
async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  return hdrs.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Sign in with email and password via Supabase Auth.
 * On success, redirects to the appropriate dashboard based on user role.
 *
 * Rate-limited per IP (5 req/60s) and per email account (10 attempts/15min
 * lockout) to prevent brute-force attacks.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  const clientIp = await getClientIp();
  const normalizedEmail = email.trim().toLowerCase();

  // Per-IP rate limit: 5 attempts per 60 seconds
  const ipAllowed = await loginLimiter.check(`login:ip:${clientIp}`);
  if (!ipAllowed) {
    return { error: t("fr", "auth.rateLimitLogin") };
  }

  // Per-account lockout: 10 failed attempts per 15 minutes
  const accountAllowed = await accountLockoutLimiter.check(`login:account:${normalizedEmail}`);
  if (!accountAllowed) {
    return { error: t("fr", "auth.accountLocked") };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    // Log failed login attempt for security audit
    logAuthEvent({
      supabase,
      action: "login.failed",
      actor: normalizedEmail,
      description: `Failed login attempt from IP ${clientIp}`,
      ipAddress: clientIp,
      success: false,
    }).catch((err) => { logger.warn("Failed to log auth event", { context: "auth/signIn", error: err }); });
    return { error: error.message };
  }

  // Fetch user profile to determine redirect
  const profile = await getUserProfile();

  // Log successful login for security audit
  logAuthEvent({
    supabase,
    action: "login.success",
    actor: normalizedEmail,
    clinicId: profile?.clinic_id ?? undefined,
    description: `Successful login from IP ${clientIp}`,
    ipAddress: clientIp,
    success: true,
  }).catch((err) => { logger.warn("Failed to log auth event", { context: "auth/signIn", error: err }); });

  if (profile) {
    redirect(ROLE_DASHBOARD_MAP[profile.role]);
  }

  // Fallback: redirect to patient dashboard
  redirect("/patient/dashboard");
}

/**
 * Send OTP to a phone number via Supabase Auth.
 * Returns an error message if the request fails.
 *
 * Gated by `NEXT_PUBLIC_PHONE_AUTH_ENABLED`. When the flag is not
 * `"true"`, this action rejects immediately without calling Supabase.
 */
export async function signInWithOTP(phone: string): Promise<{ error: string | null }> {
  if (!isPhoneAuthEnabled()) {
    return { error: "Phone authentication is not currently available." };
  }

  // Per-phone rate limit: 3 OTP sends per 60 seconds (prevents SMS pumping)
  const phoneAllowed = await otpSendLimiter.check(`otp:phone:${phone}`);
  if (!phoneAllowed) {
    return { error: t("fr", "auth.rateLimitOtp") };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    phone,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Verify the OTP code entered by the user.
 * On success, redirects to the appropriate dashboard based on user role.
 *
 * Gated by `NEXT_PUBLIC_PHONE_AUTH_ENABLED`.
 */
export async function verifyOTP(
  phone: string,
  token: string,
): Promise<{ error: string | null }> {
  if (!isPhoneAuthEnabled()) {
    return { error: "Phone authentication is not currently available." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    return { error: error.message };
  }

  // Fetch user profile to determine redirect
  const profile = await getUserProfile();
  if (profile) {
    redirect(ROLE_DASHBOARD_MAP[profile.role]);
  }

  // Fallback: redirect to patient dashboard (new users default to patient role)
  redirect("/patient/dashboard");
}

/**
 * Register a new patient account.
 * Sends OTP to the phone number. The auth trigger in the DB
 * will auto-create the user profile with the provided metadata.
 *
 * Gated by `NEXT_PUBLIC_PHONE_AUTH_ENABLED`.
 */
export async function registerPatient(data: {
  phone: string;
  name: string;
  email?: string;
  age?: number;
  gender?: string;
  insurance?: string;
}): Promise<{ error: string | null }> {
  if (!isPhoneAuthEnabled()) {
    return { error: "Phone registration is not currently available." };
  }

  const supabase = await createClient();

  // Rate limit OTP sends per phone number to prevent SMS pumping
  const phoneAllowed = await otpSendLimiter.check(`otp:phone:${data.phone}`);
  if (!phoneAllowed) {
    return { error: t("fr", "auth.rateLimitOtp") };
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone: data.phone,
    options: {
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        // MEDIUM 3.2: Do NOT pass role in user metadata.
        // The DB trigger (migration 00028) always defaults to "patient"
        // regardless of what's in raw_user_meta_data. Passing it here
        // is redundant and creates a false sense that it matters.
        age: data.age,
        gender: data.gender,
        insurance: data.insurance,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Request a password reset email via Supabase Auth (server-side).
 *
 * MEDIUM 3.1: Moved from client-side to server action so that:
 *   - Server-side rate limiting is applied (3 req/60s per IP)
 *   - All reset attempts are logged server-side
 *   - The client cannot bypass rate limits by calling Supabase directly
 *
 * HIGH 2.4: Always returns a generic success message regardless of whether
 * the email exists, preventing username enumeration.
 */
export async function resetPassword(
  email: string,
  redirectTo: string,
): Promise<{ error: string | null }> {
  const clientIp = await getClientIp();

  // Rate limit: 3 password reset requests per 60 seconds per IP
  const allowed = await passwordResetLimiter.check(`reset:ip:${clientIp}`);
  if (!allowed) {
    return { error: t("fr", "auth.rateLimitGeneric") };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo },
  );

  // Always return success to prevent username enumeration.
  // Even if the email doesn't exist, we don't reveal that to the caller.
  if (error) {
    // Log the error server-side for debugging, but don't expose it
    logger.warn("Password reset request failed", { context: "auth/resetPassword", error });
  }

  // Log password reset request for security audit
  logAuthEvent({
    supabase,
    action: "password_reset.requested",
    actor: email.trim().toLowerCase(),
    description: `Password reset requested from IP ${clientIp}`,
    ipAddress: clientIp,
  }).catch((err) => { logger.warn("Failed to log auth event", { context: "auth/resetPassword", error: err }); });

  return { error: null };
}

/**
 * Sign out the current user and redirect to home page.
 * Always redirects even if the sign-out API call fails — the user
 * should never get stuck on a broken session.
 */
export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    logger.error("Sign-out failed", { context: "auth/signOut", error: err });
  }
  redirect("/");
}

// ============================================================
// Session & Profile Helpers
// ============================================================

/**
 * Get the current user's profile from the users table.
 * Returns null if not authenticated or profile not found.
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, auth_id, clinic_id, role, name, phone, email, avatar_url, is_active, metadata")
    .eq("auth_id", user.id)
    .single();

  return profile as UserProfile | null;
}

/**
 * Require authentication. If not authenticated, redirect to login.
 * Returns the user profile.
 */
export async function requireAuth(): Promise<UserProfile> {
  const profile = await getUserProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

/**
 * Require a specific role. If user doesn't have the role, redirect to their dashboard.
 */
export async function requireRole(
  ...allowedRoles: UserProfile["role"][]
): Promise<UserProfile> {
  const profile = await requireAuth();
  if (!allowedRoles.includes(profile.role)) {
    redirect(ROLE_DASHBOARD_MAP[profile.role]);
  }
  return profile;
}

/**
 * Get the dashboard path for a given role.
 */
export async function getDashboardPath(role: UserProfile["role"]): Promise<string> {
  return ROLE_DASHBOARD_MAP[role];
}
