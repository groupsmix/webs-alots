/**
 * Observability & scanning env getters (P11 split from `src/lib/env.ts`).
 *
 * Plausible Analytics, Google Analytics, and the AV-scan service. Each
 * getter is the authoritative read point for its variable — consumers
 * import via the `@/lib/env` barrel, never `process.env` directly.
 * See `.semgrep/env-access.yml`.
 */

/**
 * Plausible Analytics site domain. When set, the PlausibleScript component
 * renders. Always client-bundled via the NEXT_PUBLIC_ prefix.
 * A64: centralised so cookie-consent + plausible-script do not read process.env directly.
 */
export function getPlausibleDomain(): string | undefined {
  return process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
}

/**
 * Plausible Analytics host URL. Defaults to plausible.io for the SaaS
 * offering. Required in production when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set
 * (enforced at the registry level in OBSERVABILITY_ENV_REGISTRY).
 * A64: centralised so plausible-script does not read process.env directly.
 */
export function getPlausibleHost(): string {
  return process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "https://plausible.io";
}

/**
 * Per-clinic Google Analytics 4 measurement ID. Optional. When unset,
 * the analytics-script consent gate short-circuits without touching the GA SDK.
 * A64: centralised so cookie-consent does not read process.env directly.
 */
export function getGaMeasurementId(): string | undefined {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
}

/**
 * AV scan service endpoint. Required in production for clinical (PHI)
 * uploads — see `enforceEnvValidation()` for the registry-level guard.
 * Returns `undefined` when unset; callers must handle that case.
 */
export function getAvScanUrl(): string | undefined {
  return process.env.AV_SCAN_URL;
}

/**
 * Whether the upload pipeline should fail-closed when the AV scan
 * service is unreachable or returns a non-OK status. W8-S-01 control.
 * Non-PHI uploads honour this flag; PHI uploads always fail closed.
 */
export function getAvScanRequired(): boolean {
  return process.env.AV_SCAN_REQUIRED === "true";
}
