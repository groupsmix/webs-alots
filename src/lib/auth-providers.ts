"use client";

import { createClient } from "@/lib/supabase-client";

/**
 * Sign in with Google OAuth via Supabase.
 * Redirects the user to Google's consent screen.
 * After auth, Supabase redirects back to /auth/callback.
 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Sign in with a passkey (WebAuthn) via Supabase.
 * Opens the browser's native passkey prompt (fingerprint, Face ID, security key).
 */
export async function signInWithPasskey(): Promise<{
  error: string | null;
  redirectTo?: string;
}> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPasskey();

  if (error) {
    return { error: error.message };
  }

  // Fetch user profile to determine redirect
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single<{ role: string }>();

    if (profile) {
      const roleDashboardMap: Record<string, string> = {
        super_admin: "/super-admin/dashboard",
        clinic_admin: "/admin/dashboard",
        receptionist: "/receptionist/dashboard",
        doctor: "/doctor/dashboard",
        patient: "/patient/dashboard",
      };
      return { error: null, redirectTo: roleDashboardMap[profile.role] || "/patient/dashboard" };
    }
  }

  return { error: null, redirectTo: "/patient/dashboard" };
}

/**
 * Register a new email/password account via Supabase Auth.
 * Sends a confirmation email. The user must verify before signing in.
 */
export async function registerWithEmail(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  age?: number;
  gender?: string;
  insurance?: string;
  guardianConsent?: boolean;
}): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email.trim().toLowerCase(),
        age: data.age,
        gender: data.gender,
        insurance: data.insurance,
        guardian_consent: data.guardianConsent ?? undefined,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
