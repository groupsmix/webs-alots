/**
 * Shared impersonation cookie names + options.
 *
 * Factored out of `src/app/api/impersonate/route.ts` so the clinic-level
 * impersonation flow (`/api/impersonate`) and the user-level callback
 * (`/api/auth/impersonate-callback`) agree byte-for-byte on cookie names and
 * attributes. A mismatch here would silently break the impersonation banner
 * (it reads these cookies) or leak a cookie across tenants.
 *
 * A54.2: `__Host-` prefix in production prevents a `Domain=` attribute, which
 * would otherwise allow subdomain leakage between clinic tenants
 * (e.g. clinic-a.oltigo.com setting a cookie readable by clinic-b.oltigo.com).
 * `__Host-` requires Secure + Path=/ + no Domain, so in dev (non-HTTPS) we
 * fall back to unprefixed names.
 */

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_PREFIX = IS_PROD ? "__Host-" : "";

export const COOKIE_CLINIC_ID = `${COOKIE_PREFIX}sa_impersonate_clinic_id`;
export const COOKIE_CLINIC_NAME = `${COOKIE_PREFIX}sa_impersonate_clinic_name`;
export const COOKIE_SESSION_ID = `${COOKIE_PREFIX}sa_impersonate_session_id`;

/** Cookie options for setting an active impersonation cookie. */
export function impersonationCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Cookie options for clearing an impersonation cookie. */
export function clearImpersonationCookieOptions() {
  return impersonationCookieOptions(0);
}
