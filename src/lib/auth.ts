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
 * In Cloudflare, CF-Connecting-IP is the trustworthy source.
 */
async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  return hdrs.get("cf-connecting-ip") ?? hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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
    return { error: "Trop de tentatives de connexion. Veuillez r\u00e9essayer dans quelques minutes." };
  }

  // Per-account lockout: 10 failed attempts per 15 minutes
  const accountAllowed = await accountLockoutLimiter.check(`login:account:${normalizedEmail}`);
  if (!accountAllowed) {
    return { error: "Ce compte est temporairement verrouill\u00e9 suite \u00e0 de nombreuses tentatives \u00e9chou\u00e9es. Veuillez r\u00e9essayer plus tard." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Fetch user profile to determine redirect
  const profile = await getUserProfile();
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
    return { error: "Trop de demandes de code. Veuillez r\u00e9essayer dans quelques minutes." };
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
    return { error: "Trop de demandes de code. Veuillez r\u00e9essayer dans quelques minutes." };
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
    return { error: "Trop de demandes. Veuillez r\u00e9essayer dans quelques minutes." };
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
    logger.warn("Password reset failed (not exposed to client)", { context: "auth", error: error.message });
  }

  return { error: null };
}

/**
 * Sign out the current user and redirect to home page.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
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
    .select("*")
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
