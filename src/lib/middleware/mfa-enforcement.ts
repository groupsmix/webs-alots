/**
 * §3.5 — MFA enforcement logic for privileged roles.
 *
 * Extracted from middleware.ts to keep the orchestrator under ~300 lines.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { secureRedirect } from "@/lib/middleware/security-headers";

/**
 * Enforce MFA requirements based on role.
 *
 * - `super_admin`: MUST have MFA enrolled AND verified (AAL2).
 * - `doctor` / `clinic_admin`: redirect to verify if factors enrolled but session is AAL1.
 *
 * Returns a redirect Response if MFA is required, or `null` if the user passes.
 */
export async function enforceMfa(
  supabase: SupabaseClient,
  role: string,
  pathname: string,
  requestUrl: string,
): Promise<Response | null> {
  if (role === "super_admin") {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel !== "aal2") {
      if (aalData?.nextLevel === "aal2") {
        return secureRedirect(new URL("/login?mfa=required", requestUrl));
      }
      if (!pathname.startsWith("/setup-2fa")) {
        return secureRedirect(new URL("/setup-2fa?required=super_admin", requestUrl));
      }
    }
    return null;
  }

  if (role === "doctor") {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel === "aal1" && aalData?.nextLevel === "aal2") {
      return secureRedirect(new URL("/login?mfa=required", requestUrl));
    }
  }

  if (role === "clinic_admin" && pathname.startsWith("/admin")) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel === "aal1" && aalData?.nextLevel === "aal2") {
      return secureRedirect(new URL("/login?mfa=required", requestUrl));
    }
  }

  return null;
}
