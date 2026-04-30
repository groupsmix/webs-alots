"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logAuthEvent } from "@/lib/audit-log";
import { sendEmail } from "@/lib/email";
import { breachedPasswordEmail } from "@/lib/email-templates";
import { checkBreachedPassword } from "@/lib/hibp";
import { logger } from "@/lib/logger";
import { ROLE_DASHBOARD_MAP } from "@/lib/middleware/routes";
import {
  loginLimiter,
  accountLockoutLimiter,
  otpSendLimiter,
  passwordResetLimiter,
} from "@/lib/rate-limit";
import { isSeedUserBlocked } from "@/lib/seed-guard";
import { createClient } from "@/lib/supabase-server";
import { recordLoginAndAlert } from "@/lib/suspicious-login";

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
    return { error: "auth.rateLimitLogin" };
  }

  // Per-account lockout: 10 failed attempts per 15 minutes
  const accountAllowed = await accountLockoutLimiter.check(`login:account:${normalizedEmail}`);
  if (!accountAllowed) {
    return { error: "auth.accountLocked" };
  }

  const supabase = await createClient();

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
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

  // SEED-01: Block seed users from authenticating in production.
  // Even if the password matches, these accounts must not be usable
  // in production because their credentials are in git history.
  if (signInData?.user && isSeedUserBlocked(signInData.user.id)) {
    logger.warn("Blocked seed user login attempt in production", {
      context: "auth/signIn",
      userId: signInData.user.id,
      email: normalizedEmail,
      ip: clientIp,
    });
    await supabase.auth.signOut();
    logAuthEvent({
      supabase,
      action: "login.blocked_seed_user",
      actor: normalizedEmail,
      description: `Seed user login blocked in production from IP ${clientIp}`,
      ipAddress: clientIp,
      success: false,
    }).catch((err) => { logger.warn("Failed to log auth event", { context: "auth/signIn", error: err }); });
    return { error: "auth.invalidCredentials" };
  }

  // Check if user has MFA enabled and needs to complete 2FA
  // When AAL1 is granted but AAL2 is required, the user needs to verify TOTP
  if (signInData?.user) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel === "aal1" && aalData?.nextLevel === "aal2") {
      // Password auth succeeded but MFA verification is needed
      // Return special error code so the client can show the TOTP input
      return { error: "mfa_required" };
    }
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

  // A154: HIBP breached-password check (async, non-blocking).
  // Runs after successful auth so we don't leak timing info about
  // whether the email exists. Sends a warning email if the password
  // appears in known breaches. Does NOT block the login.
  // A126-02 fix: Properly handle fire-and-forget on Workers - use waitUntil for Cloudflare context.
  const handleBreachedPassword = async () => {
    try {
      const result = await checkBreachedPassword(password);
      if (result.breached) {
        logger.warn("User logged in with breached password", {
          context: "auth/hibp",
          email: normalizedEmail,
          breachCount: result.count,
        });
        const template = breachedPasswordEmail({ userEmail: normalizedEmail });
        await sendEmail({ to: normalizedEmail, subject: template.subject, html: template.html });
      }
    } catch (err) {
      logger.warn("HIBP check failed post-login", { context: "auth/hibp", error: err });
    }
  };

  // Register async task with proper cleanup handler for Workers
  if (typeof globalThis !== 'undefined' && 'waitUntil' in globalThis) {
    // Cloudflare Workers environment
    (globalThis as { waitUntil: (promise: Promise<unknown>) => void }).waitUntil(handleBreachedPassword());
  } else {
    // Standard Node.js environment
    handleBreachedPassword().catch((err) => logger.warn("HIBP async task failed", { error: err }));
  }

  // A154: Suspicious login detection (async, non-blocking).
  // Records the login event and alerts user if IP+UA is new.
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent") ?? "unknown";

  const handleLoginAlert = async () => {
    try {
      await recordLoginAndAlert(supabase, {
        userId: signInData.user?.id ?? normalizedEmail,
        email: normalizedEmail,
        ipAddress: clientIp,
        userAgent,
        clinicId: profile?.clinic_id ?? undefined,
      });
    } catch (err) {
      logger.warn("Suspicious login check failed", { context: "auth/suspicious-login", error: err });
    }
  };

  // Register async task with proper cleanup handler for Workers
  if (typeof globalThis !== 'undefined' && 'waitUntil' in globalThis) {
    // Cloudflare Workers environment
    (globalThis as { waitUntil: (promise: Promise<unknown>) => void }).waitUntil(handleLoginAlert());
  } else {
    // Standard Node.js environment
    handleLoginAlert().catch((err) => logger.warn("Login alert async task failed", { error: err }));
  }

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
    return { error: "auth.phoneDisabled" };
  }

  // Per-phone rate limit: 3 OTP sends per 60 seconds (prevents SMS pumping)
  const phoneAllowed = await otpSendLimiter.check(`otp:phone:${phone}`);
  if (!phoneAllowed) {
    return { error: "auth.rateLimitOtp" };
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
    return { error: "auth.phoneDisabled" };
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
    return { error: "auth.phoneDisabled" };
  }

  const supabase = await createClient();

  // Rate limit OTP sends per phone number to prevent SMS pumping
  const phoneAllowed = await otpSendLimiter.check(`otp:phone:${data.phone}`);
  if (!phoneAllowed) {
    return { error: "auth.rateLimitOtp" };
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
    return { error: "auth.rateLimitGeneric" };
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

  // Purge all service-worker caches so no PHI persists after logout.
  // This runs server-side where `caches` is unavailable, so the actual
  // purge is done client-side via the sign-out-button component.
  // See src/components/sign-out-button.tsx for the browser-side purge.

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
