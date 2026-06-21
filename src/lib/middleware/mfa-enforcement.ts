/**
 * §3.5 — MFA enforcement logic for privileged roles.
 *
 * Extracted from middleware.ts to keep the orchestrator under ~300 lines.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMfaEnabled } from "@/lib/env";
import { secureRedirect } from "@/lib/middleware/security-headers";

/**
 * Enforce MFA requirements for privileged roles.
 *
 * Two-stage check for `super_admin` and `clinic_admin`:
 *
 * 1. **Enrollment gate** — if no verified TOTP factor exists at all, redirect
 *    to `/setup-2fa?required=1&next=<pathname>` so the admin is forced to
 *    enrol before accessing privileged routes. This closes the gap identified
 *    in QA risk R1: an account with no authenticator enrolled had
 *    `nextLevel = "aal1"` (not "aal2"), so the old level-only check never
 *    fired and password-only login succeeded with zero MFA challenge.
 *
 * 2. **Session level gate** — if a verified factor exists but the current
 *    session is at AAL1 (factor not yet used this session), redirect to
 *    `/mfa-verify?next=<pathname>` for step-up authentication.
 *
 * Returns `null` when no redirect is needed (pass-through).
 */
export async function enforceMfa(
  supabase: SupabaseClient,
  role: string,
  pathname: string,
  requestUrl: string,
): Promise<Response | null> {
  // Allow disabling via env var; defaults to true (enforced). Read through the
  // centralised env module (src/lib/env.ts) rather than process.env directly.
  if (!isMfaEnabled()) return null;

  if (role === "super_admin" || role === "clinic_admin") {
    // --- Stage 1: enrollment check ---
    // listFactors() is a lightweight read that does not count against
    // sign-in rate limits. We filter to verified factors only; an
    // unverified (mid-enrolment) factor is not yet usable as an MFA factor.
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = (factorsData?.totp ?? []).filter((f) => f.status === "verified");

    if (verifiedTotp.length === 0) {
      // No verified authenticator — force enrolment first.
      const redirectUrl = new URL("/setup-2fa", requestUrl);
      redirectUrl.searchParams.set("required", "1");
      redirectUrl.searchParams.set("next", pathname);
      return secureRedirect(redirectUrl);
    }

    // --- Stage 2: session level check ---
    // The user has an authenticator enrolled; check whether they have
    // already used it this session (AAL2) or need a step-up challenge.
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2") {
      const redirectUrl = new URL("/mfa-verify", requestUrl);
      redirectUrl.searchParams.set("next", pathname);
      return secureRedirect(redirectUrl);
    }
  }

  return null;
}
