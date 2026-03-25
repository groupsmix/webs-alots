"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

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
 * Sign in with email and password via Supabase Auth.
 * On success, redirects to the appropriate dashboard based on user role.
 */
export async function signInWithPassword(
  email: string,
  password: string,
  captchaToken?: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
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
 */
export async function signInWithOTP(phone: string, captchaToken?: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Verify the OTP code entered by the user.
 * On success, redirects to the appropriate dashboard based on user role.
 */
export async function verifyOTP(
  phone: string,
  token: string,
  captchaToken?: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
    options: captchaToken ? { captchaToken } : undefined,
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
 */
export async function registerPatient(data: {
  phone: string;
  name: string;
  email?: string;
  age?: number;
  gender?: string;
  insurance?: string;
  captchaToken?: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    phone: data.phone,
    options: {
      captchaToken: data.captchaToken,
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        role: "patient",
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
