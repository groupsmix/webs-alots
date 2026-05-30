/**
 * §3.5 — MFA enforcement logic for privileged roles.
 *
 * Extracted from middleware.ts to keep the orchestrator under ~300 lines.
 *
 * MFA enforcement is currently disabled while the platform is in early
 * access. Set the `ENFORCE_MFA` environment variable to `"true"` to
 * re-enable it. When disabled, users who have already enrolled MFA will
 * still be prompted to verify (their session already carries the factor),
 * but unenrolled users will not be forced to set it up.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { secureRedirect } from "@/lib/middleware/security-headers";

/**
 * Enforce MFA requirements based on role.
 *
 * When `ENFORCE_MFA` is `"true"`:
 * - `super_admin`: MUST have MFA enrolled AND verified (AAL2).
 * - `doctor` / `clinic_admin`: MUST have MFA enrolled AND verified (AAL2).
 *   Redirects to /setup-2fa if no factors are enrolled, or to /login if
 *   factors exist but the session is still AAL1.
 * - `patient` / `receptionist`: MFA is never enforced.
 *
 * When `ENFORCE_MFA` is not `"true"` (default):
 * - All roles pass through without MFA checks.
 *
 * Returns a redirect Response if MFA is required, or `null` if the user passes.
 */
export async function enforceMfa(
  supabase: SupabaseClient,
  role: string,
  pathname: string,
  requestUrl: string,
): Promise<Response | null> {
  if (process.env.ENFORCE_MFA !== "true") {
    return null;
  }

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

  if (role === "doctor" || role === "clinic_admin") {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel !== "aal2") {
      if (aalData?.nextLevel === "aal2") {
        return secureRedirect(new URL("/login?mfa=required", requestUrl));
      }
      if (!pathname.startsWith("/setup-2fa")) {
        return secureRedirect(new URL(`/setup-2fa?required=${role}`, requestUrl));
      }
    }
    return null;
  }

  return null;
}
