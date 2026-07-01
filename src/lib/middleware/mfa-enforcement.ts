/**
 * §3.5 — MFA enforcement logic for privileged roles.
 *
 * Extracted from middleware.ts to keep the orchestrator under ~300 lines.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMfaEnabled, isSuperAdminMfaRequired } from "@/lib/env";
import { secureRedirect } from "@/lib/middleware/security-headers";

/**
 * §3.5 — MFA step-up for privileged roles.
 *
 * Two layers, both gated by `isMfaEnabled()`:
 *
 * 1. **Step-up (always on for super_admin / clinic_admin):** a user who has a
 *    verified factor (`nextLevel === "aal2"`) but whose current session is
 *    still at AAL1 is challenged at `/mfa-verify`.
 *
 * 2. **Mandatory enrolment (super_admin only, opt-in via
 *    `ENFORCE_SUPER_ADMIN_MFA=true`):** a super_admin with **no** verified
 *    factor (`nextLevel === "aal1"`) is redirected to `/setup-2fa` until they
 *    enrol. Off by default, so the historical optional-enrolment behaviour is
 *    unchanged unless the flag is set. `/setup-2fa` and `/mfa-verify` are not
 *    in PROTECTED_PREFIXES, so `enforceMfa` never runs there — no redirect loop.
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
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    // (1) Step-up: enrolled factor exists but this session hasn't used it yet.
    if (aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2") {
      const redirectUrl = new URL("/mfa-verify", requestUrl);
      redirectUrl.searchParams.set("next", pathname);
      return secureRedirect(redirectUrl);
    }

    // (2) Mandatory enrolment for super_admin (opt-in). `nextLevel === "aal1"`
    // means no verified factor is enrolled yet.
    if (role === "super_admin" && isSuperAdminMfaRequired() && aalData?.nextLevel === "aal1") {
      const redirectUrl = new URL("/setup-2fa", requestUrl);
      redirectUrl.searchParams.set("next", pathname);
      return secureRedirect(redirectUrl);
    }
  }

  return null;
}
