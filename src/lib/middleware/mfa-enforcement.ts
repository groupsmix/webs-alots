/**
 * §3.5 — MFA enforcement logic for privileged roles.
 *
 * Extracted from middleware.ts to keep the orchestrator under ~300 lines.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMfaEnabled } from "@/lib/env";
import { secureRedirect } from "@/lib/middleware/security-headers";

/**
 * §3.5 — MFA step-up for privileged roles (optional-enrollment model).
 *
 * 2FA enrollment is **optional**: privileged users (`super_admin` /
 * `clinic_admin`) are NOT forced to enrol. Enrolment is offered as a
 * self-service action from the dashboard (links to `/setup-2fa`).
 *
 * What is still enforced: **step-up for users who have already enrolled.**
 * `getAuthenticatorAssuranceLevel()` reports `nextLevel === "aal2"` only when
 * a verified factor exists, so an admin who voluntarily enabled 2FA is still
 * challenged at `/mfa-verify` when their session is only at AAL1, while an
 * un-enrolled admin (`nextLevel === "aal1"`) passes through untouched.
 *
 * Returns `null` when no redirect is needed (pass-through).
 */
export async function enforceMfa(
  supabase: SupabaseClient,
  role: string,
  pathname: string,
  requestUrl: string,
): Promise<Response | null> {
  // Allow disabling all MFA logic via env var; defaults to true. Read through
  // the centralised env module (src/lib/env.ts) rather than process.env.
  if (!isMfaEnabled()) return null;

  if (role === "super_admin" || role === "clinic_admin") {
    // Step-up only — never force enrolment. When the user has a verified
    // factor, `nextLevel` is "aal2"; if the session has not yet used it
    // (currentLevel "aal1"), require a step-up challenge. Un-enrolled users
    // report `nextLevel === "aal1"` and fall through with no redirect.
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2") {
      const redirectUrl = new URL("/mfa-verify", requestUrl);
      redirectUrl.searchParams.set("next", pathname);
      return secureRedirect(redirectUrl);
    }
  }

  return null;
}
