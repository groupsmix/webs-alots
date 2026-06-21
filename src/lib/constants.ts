/**
 * Default IANA timezone used as a last-resort fallback when tenant config
 * does not provide one. Matches the primary deployment locale (Morocco).
 *
 * Prefer reading timezone from the tenant's DB config via `getClinicConfig()`.
 * If this fallback is triggered, a warning is logged so the gap can be fixed.
 */
export const DEFAULT_TIMEZONE = "Africa/Casablanca";
