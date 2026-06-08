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
 * MFA enforcement is currently disabled — all roles pass through without
 * requiring multi-factor authentication. To re-enable, restore the original
 * AAL2 checks per role.
 *
 * Returns `null` unconditionally (no redirect).
 */
export async function enforceMfa(
  supabase: SupabaseClient,
  role: string,
  pathname: string,
  requestUrl: string,
): Promise<Response | null> {
  // Allow disabling via env var, defaults to true (enforced)
  if (process.env.MFA_ENABLED === "false") return null;

  if (role === "super_admin" || role === "clinic_admin") {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (data?.nextLevel === "aal2" && data?.currentLevel !== "aal2") {
      const redirectUrl = new URL("/mfa-verify", requestUrl);
      redirectUrl.searchParams.set("next", pathname);
      return secureRedirect(redirectUrl);
    }
  }

  return null;
}
