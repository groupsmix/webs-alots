/**
 * §3.5 — MFA enforcement logic for privileged roles.
 *
 * Extracted from middleware.ts to keep the orchestrator under ~300 lines.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Enforce MFA requirements based on role.
 *
 * Redirects privileged roles (super_admin, clinic_admin) to MFA verification
 * if their Authenticator Assurance Level (AAL) is insufficient.
 */
export async function enforceMfa(
  supabase: SupabaseClient,
  role: string,
  pathname: string,
  requestUrl: string,
): Promise<Response | null> {
  // Exempt MFA setup/verification and API auth routes to prevent redirect loops
  if (
    pathname.startsWith("/mfa-setup") ||
    pathname.startsWith("/mfa-verify") ||
    pathname.startsWith("/api/auth/")
  ) {
    return null;
  }

  if (role === "super_admin" || role === "clinic_admin") {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) {
      return null;
    }

    if (data.currentLevel !== data.nextLevel) {
      const url = new URL("/mfa-verify", requestUrl);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return null;
}
