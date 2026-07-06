/**
 * Feature-flag / runtime-mode env helpers (P11 split from `src/lib/env.ts`).
 *
 * Boolean toggles and environment-mode helpers. Each helper is the
 * authoritative read point for its variable — consumers import via the
 * `@/lib/env` barrel, never `process.env` directly.
 * See `.semgrep/env-access.yml`.
 */

/**
 * Emergency AI kill switch env override (AI-KS). When AI_DISABLED=true the
 * environment always wins over the dashboard KV toggle: AI stays off and the
 * super-admin UI shows the switch as env-locked.
 */
export function isAiDisabledByEnv(): boolean {
  return process.env.AI_DISABLED === "true";
}

/**
 * MFA enforcement toggle. Enforced by default — only the explicit string
 * "false" disables it (operational kill-switch for incident response).
 */
export function isMfaEnabled(): boolean {
  return process.env.MFA_ENABLED !== "false";
}

/**
 * Whether super_admin accounts are *required* to enrol in 2FA (not just
 * stepped-up if they already have it). Off by default so enabling it is a
 * deliberate, verified rollout: set `ENFORCE_SUPER_ADMIN_MFA=true` once at
 * least one super_admin has a verified factor, to avoid locking admins into
 * the /setup-2fa flow unexpectedly.
 *
 * Read through this helper rather than `process.env` directly.
 */
export function isSuperAdminMfaRequired(): boolean {
  return process.env.ENFORCE_SUPER_ADMIN_MFA === "true";
}

/**
 * Whether the custom-domain / Cloudflare DNS feature is enabled.
 *
 * Toggled by `NEXT_PUBLIC_ENABLE_CUSTOM_DOMAINS=true`. When disabled, the
 * `/api/dns/*` handlers refuse with 503 and the related Cloudflare env vars
 * are *optional*. When enabled, those env vars become required at startup.
 *
 * Read it through this helper rather than `process.env` directly so the
 * gating logic stays in one place.
 */
export function isCustomDomainsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CUSTOM_DOMAINS === "true";
}

/**
 * Whether admin-route geo-restriction is enabled.
 *
 * Defaults to `true`. Set `ADMIN_GEO_RESTRICTION_ENABLED=false` (or `0`)
 * to disable. Read through this helper rather than `process.env` directly.
 */
export function isAdminGeoRestrictionEnabled(): boolean {
  const raw = process.env.ADMIN_GEO_RESTRICTION_ENABLED;
  if (raw === undefined || raw === "") return true;
  return raw.trim().toLowerCase() !== "false" && raw.trim() !== "0";
}

/**
 * Comma-separated list of allowed country codes for admin routes, or
 * `undefined` when the env var is unset (caller should default to `"MA"`).
 */
export function getGeoRestrictAdminCountries(): string | undefined {
  return process.env.GEO_RESTRICT_ADMIN;
}

/**
 * Current Worker environment identifier (F-13 / cron-env-guard).
 * Set to "production" or "staging" in wrangler.toml [vars].
 * Unset in local dev, tests, and preview deployments — callers treat
 * undefined as "not staging" (i.e. allow the operation to proceed).
 */
export function getWorkerEnv(): string | undefined {
  return process.env.WORKER_ENV;
}

/**
 * Whether staging is allowed to run destructive crons (F-13).
 * Must be explicitly set to "true" by an operator — never a default.
 * Consumed by `src/lib/cron-env-guard.ts`.
 */
export function getAllowStagingDestructiveCrons(): boolean {
  return process.env.ALLOW_STAGING_DESTRUCTIVE_CRONS === "true";
}

/**
 * Whether the current process is running in production (NODE_ENV).
 * Centralised so callers don't sprinkle `process.env.NODE_ENV` checks
 * across the codebase (semgrep.env-access). Use this for runtime gating;
 * for build-time/edge gating, see callers of `getWorkerEnv()`.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Whether the current process is running inside CI (GitHub Actions sets
 * `CI=true`). Useful for gating production-only side effects when the
 * Next.js `next start` command sets `NODE_ENV=production` during CI.
 */
export function isCi(): boolean {
  return process.env.CI === "true";
}
