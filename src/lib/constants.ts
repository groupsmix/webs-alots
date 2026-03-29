/**
 * Default password assigned to staff accounts created during onboarding.
 *
 * Read from the `STAFF_DEFAULT_PASSWORD` environment variable so that the
 * value is never committed to source control. Falls back to a generated
 * random string if the env var is not set, ensuring accounts are never
 * created with a well-known password.
 */
export const STAFF_DEFAULT_PASSWORD =
  process.env.STAFF_DEFAULT_PASSWORD || `Staff-${crypto.randomUUID()}`;

/**
 * Default IANA timezone used as a last-resort fallback when tenant config
 * does not provide one. Matches the primary deployment locale (Morocco).
 *
 * Prefer reading timezone from the tenant's DB config via `getClinicConfig()`.
 * If this fallback is triggered, a warning is logged so the gap can be fixed.
 */
export const DEFAULT_TIMEZONE = "Africa/Casablanca";
