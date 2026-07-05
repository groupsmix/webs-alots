/**
 * Centralized Environment Variable Validation
 *
 * Validates that all required environment variables are set at startup
 * rather than failing at runtime when the relevant code path executes.
 *
 * Called from the Next.js instrumentation hook (src/instrumentation.ts)
 * so that missing variables are surfaced immediately on server start.
 *
 * Variables are grouped by feature. Optional features (e.g. Stripe,
 * WhatsApp) only warn when partially configured — they do not block
 * startup.
 *
 * Post clinical/EMR-strip review (chore/strip-clinical-surface): every rule
 * below was re-audited after the clinical surface was removed. No variable
 * existed solely for a deleted clinical feature, so none were removed. The
 * encryption keys (PHI_ENCRYPTION_KEY, BACKUP_ENCRYPTION_KEY) remain required
 * in production because they now protect patient CONTACT/personal data,
 * uploaded files, and backups; and the security controls (CRON_SECRET,
 * BOOKING_TOKEN_SECRET, AV_SCAN_URL, PROFILE_HEADER_HMAC_KEY, R2_SIGNED_URL_SECRET)
 * are unchanged.
 */

import {
  enforceBackupEncryptionConfigured,
  enforceBookingTokenSecretMinLength,
  enforceCronSecretMinLength,
  enforceEmailProviderExclusivity,
  enforceHmacKeyIndependence,
  enforcePhiEncryptionConfigured,
  enforcePhiMaskingPolicy,
  enforceRateLimitBackend,
  enforceSecurityFlagAcknowledgments,
  enforceSeedPasswordsRotated,
  enforceSupabasePoolerConfigured,
  SECURITY_FLAG_ACKNOWLEDGMENTS,
} from "@/lib/env-startup";
import { ENV_RULES, type EnvValidationResult, validateEnv } from "@/lib/env-validation";
import { logger } from "@/lib/logger";

export {
  enforceBackupEncryptionConfigured,
  enforceBookingTokenSecretMinLength,
  enforceCronSecretMinLength,
  enforceEmailProviderExclusivity,
  enforceHmacKeyIndependence,
  enforcePhiEncryptionConfigured,
  enforcePhiMaskingPolicy,
  enforceRateLimitBackend,
  enforceSecurityFlagAcknowledgments,
  enforceSeedPasswordsRotated,
  enforceSupabasePoolerConfigured,
  ENV_RULES,
  SECURITY_FLAG_ACKNOWLEDGMENTS,
  validateEnv,
};
export type { EnvValidationResult };

// The env-rule registry and `validateEnv()` live in `@/lib/env-validation`
// and are re-exported above to keep `@/lib/env` as the stable public API.

/**
 * Emergency AI kill switch env override (AI-KS). When AI_DISABLED=true the
 * environment always wins over the dashboard KV toggle: AI stays off and the
 * super-admin UI shows the switch as env-locked.
 */
export function isAiDisabledByEnv(): boolean {
  return process.env.AI_DISABLED === "true";
}

/**
 * Public URL for the landing-page "Demo" CTA. `NEXT_PUBLIC_*` so the value is
 * inlined into the client bundle at build time. Falls back to the production
 * demo host when unset.
 */
export function getDemoUrl(): string {
  return process.env.NEXT_PUBLIC_DEMO_URL || "https://demo.oltigo.com";
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
 * Run env validation and log results.
 * Called from instrumentation.ts on server startup.
 *
 * - Required variables missing → throws (server won't start)
 * - Optional variables missing → warns (feature degraded)
 */
export function enforceEnvValidation(): void {
  const result = validateEnv();

  // Log warnings for optional missing variables (grouped by feature)
  if (result.warnings.length > 0) {
    const grouped = new Map<string, string[]>();
    for (const w of result.warnings) {
      const list = grouped.get(w.group) ?? [];
      list.push(`  ${w.name} — ${w.description}`);
      grouped.set(w.group, list);
    }

    for (const [group, vars] of grouped) {
      logger.info(
        `Optional env vars missing for "${group}" (feature will be disabled):\n${vars.join("\n")}`,
        {
          context: "env-validation",
          group,
        },
      );
    }

    // F-34: Emit Sentry alert for WhatsApp provider degradation in production
    if (process.env.NODE_ENV === "production") {
      const whatsappWarnings = result.warnings.filter((w) => w.group === "whatsapp");
      if (whatsappWarnings.length > 0) {
        try {
          import("@sentry/nextjs").then((Sentry) => {
            Sentry.captureMessage(
              "WhatsApp primary provider (Meta) unavailable — degrading to Twilio fallback",
              {
                level: "warning",
                tags: { degradation: "whatsapp_meta_to_twilio" },
                extra: { missingVars: whatsappWarnings.map((w) => w.name) },
              },
            );
          });
        } catch {
          // Sentry unavailable
        }
      }
    }
  }

  // Hard-fail for required variables
  if (!result.valid) {
    const lines = result.missing.map((m) => `  ${m.name} — ${m.description}`);
    const message =
      `[STARTUP HEALTH CHECK FAILED] Required environment variables are missing:\n${lines.join("\n")}\n\n` +
      "The application cannot start without these variables.\n" +
      "Set them in your .env.local (development) or deployment environment (production).";
    logger.error(message, { context: "env-validation" });
    throw new Error(message);
  }

  // Reject boot in production when seed passwords have not been rotated
  enforceSeedPasswordsRotated();

  // C-08: Validate PHI_ENCRYPTION_KEY shape (64 hex chars = AES-256-GCM).
  // The ENV_RULES check above only ensures the key is set; this validates
  // that the value is actually usable for encryption. An invalid key would
  // silently disable encryption at first use.
  enforcePhiEncryptionConfigured();

  // A6-05 / A22-01: Validate BACKUP_ENCRYPTION_KEY shape.
  enforceBackupEncryptionConfigured();

  // RISK-001 / DB-01: Cloudflare Workers must use Supabase's transaction
  // pooler in production. Direct database connections from ephemeral workers
  // will exhaust connection slots under load.
  enforceSupabasePoolerConfigured();

  // Audit Finding #7 — enforce safe PHI masking defaults in production.
  // Production must default to a masked view of PHI ("partial" or "full").
  // Explicitly disabling masking ("none") is only permitted when the operator
  // has set ALLOW_UNMASKED_PHI=true. See SECURITY.md → "PHI Masking Defaults".
  enforcePhiMaskingPolicy();

  // A100-35: Reject CRON_SECRET shorter than 32 chars in production.
  enforceCronSecretMinLength();

  // F-15 (audit-4): Reject BOOKING_TOKEN_SECRET shorter than 32 chars in
  // production. A weak or empty secret would let attackers forge booking
  // tokens and skip OTP verification. ENV_RULES.required only catches the
  // missing case; this guard catches typos and short values.
  enforceBookingTokenSecretMinLength();

  // S-05: Assert PROFILE_HEADER_HMAC_KEY !== CRON_SECRET to prevent a
  // leaked cron token from also forging session headers.
  enforceHmacKeyIndependence();

  // S-33: Validate RATE_LIMIT_BACKEND against known backends.
  enforceRateLimitBackend();

  // F-10: Ensure exactly one email provider is configured (not both).
  enforceEmailProviderExclusivity();

  // A2-08: Refuse to boot in production when a security-posture flag is
  // enabled without an explicit acknowledgment.
  enforceSecurityFlagAcknowledgments();
}

// Production startup enforcement guards and the security-flag policy list are
// implemented in `@/lib/env-startup` and re-exported above. Keeping them in a
// leaf module trims this file's review surface without changing its public API.

// ─── Typed getters — use these instead of process.env.X directly ───────────
// Each getter is the authoritative read point for its variable. Files that
// need a value import the getter from here rather than reading process.env.
// This ensures validateEnv() validation runs at startup before any accessor
// is called, and avoids spreading raw process.env reads across the codebase.

/**
 * Supabase public URL (HTTPS PostgREST origin). Returns "" when unset so
 * callers can guard with `if (url)`; `validateEnv()` enforces presence in
 * production at startup. This is a non-throwing accessor by design.
 */
export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

/** Supabase anon key. */
export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

/** Supabase service-role key — server only. */
export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** CRON_SECRET — used by cron-auth middleware. */
export function getCronSecret(): string {
  return process.env.CRON_SECRET ?? "";
}

/** Timestamp of last CRON_SECRET rotation (ISO 8601). */
export function getCronSecretRotatedAt(): string | undefined {
  return process.env.CRON_SECRET_ROTATED_AT;
}

/** PHI encryption key (AES-256-GCM base64). */
export function getPhiEncryptionKey(): string | undefined {
  return process.env.PHI_ENCRYPTION_KEY;
}

/** Stripe secret key. */
export function getStripeSecretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY;
}

/** Stripe webhook secret. */
export function getStripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

/** Resend API key for transactional email. */
export function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY;
}

/** SMTP relay host (fallback email provider). */
export function getSmtpHost(): string | undefined {
  return process.env.EMAIL_RELAY_HOST ?? process.env.SMTP_HOST;
}

/** SMTP relay user. */
export function getSmtpUser(): string | undefined {
  return process.env.EMAIL_RELAY_USER ?? process.env.SMTP_USER;
}

/** SMTP relay password. */
export function getSmtpPass(): string | undefined {
  return process.env.EMAIL_RELAY_PASS ?? process.env.SMTP_PASS;
}

/** From address for transactional email. */
export function getEmailFromAddress(): string {
  // Canonical product domain is oltigo.com (see NEXT_PUBLIC_SITE_URL default,
  // image hosts, security.txt). Keep the fallback on the same domain so a
  // missing EMAIL_FROM does not emit a different-domain sender. Production
  // overrides this via the EMAIL_FROM env var to its verified sending domain.
  return process.env.EMAIL_FROM ?? "noreply@oltigo.com";
}

/** Meta / WhatsApp app secret for HMAC webhook verification. */
export function getMetaAppSecret(): string | undefined {
  return process.env.META_APP_SECRET;
}

/** WhatsApp verify token for the hub.challenge handshake. */
export function getWhatsAppVerifyToken(): string | undefined {
  return process.env.WHATSAPP_VERIFY_TOKEN;
}

/** Cloudflare R2 credentials. */
export function getR2Config(): {
  accountId: string | undefined;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  bucketName: string | undefined;
  signedUrlSecret: string | undefined;
  signedUrlBase: string | undefined;
  publicUrl: string | undefined;
} {
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    signedUrlSecret: process.env.R2_SIGNED_URL_SECRET,
    signedUrlBase: process.env.R2_SIGNED_URL_BASE,
    publicUrl: process.env.R2_PUBLIC_URL,
  };
}

/** Cloudflare API credentials for DNS / custom hostname management. */
export function getCloudflareApiConfig(): {
  apiToken: string | undefined;
  zoneId: string | undefined;
  zoneName: string | undefined;
  accountId: string | undefined;
} {
  return {
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    zoneName: process.env.CLOUDFLARE_ZONE_NAME,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  };
}

/**
 * Cloudflare Workers AI credentials (OpenAI-compatible endpoint used by
 * src/lib/ai/providers.ts).
 *
 * NOTE: In the Cloudflare Workers runtime these values are stored as secrets
 * on getCloudflareContext().env, NOT in process.env. Use getWorkersAiConfigAsync()
 * in async request handlers instead of this sync version.
 * This sync version is kept for backwards compatibility with callers that
 * cannot be made async (e.g. non-CF environments, tests).
 */
export function getWorkersAiConfig(): {
  accountId: string | undefined;
  apiToken: string | undefined;
} {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID, // nosemgrep: semgrep.env-access — sync fallback, prefer getWorkersAiConfigAsync in CF runtime
    // CLOUDFLARE_AI_TOKEN is the legacy variable name — kept as a fallback
    // for deployments configured before CLOUDFLARE_AI_API_TOKEN existed.
    apiToken: process.env.CLOUDFLARE_AI_API_TOKEN ?? process.env.CLOUDFLARE_AI_TOKEN, // nosemgrep: semgrep.env-access — sync fallback
  };
}

/**
 * Async version of getWorkersAiConfig — reads from getCloudflareContext().env
 * first (CF Workers runtime) then falls back to process.env (local dev/tests).
 */
export async function getWorkersAiConfigAsync(): Promise<{
  accountId: string | undefined;
  apiToken: string | undefined;
}> {
  const { getWorkerBinding } = await import("@/lib/cf-bindings");
  return {
    accountId:
      (await getWorkerBinding<string>("CLOUDFLARE_ACCOUNT_ID")) ??
      process.env.CLOUDFLARE_ACCOUNT_ID, // nosemgrep: semgrep.env-access — local dev fallback
    apiToken:
      (await getWorkerBinding<string>("CLOUDFLARE_AI_API_TOKEN")) ??
      (await getWorkerBinding<string>("CLOUDFLARE_AI_TOKEN")) ??
      process.env.CLOUDFLARE_AI_API_TOKEN ?? // nosemgrep: semgrep.env-access — local dev fallback
      process.env.CLOUDFLARE_AI_TOKEN,
  };
}

/** Booking token HMAC secret. */
export function getBookingTokenSecret(): string | undefined {
  return process.env.BOOKING_TOKEN_SECRET;
}

/** Root domain (e.g. oltigo.com). */
export function getRootDomain(): string {
  return process.env.ROOT_DOMAIN ?? "";
}

/** Public site URL (e.g. https://oltigo.com). */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

/** Rate-limit backend selection. */
export function getRateLimitBackend(): string {
  return process.env.RATE_LIMIT_BACKEND ?? "kv";
}

/** Profile-header HMAC key. */
export function getProfileHeaderHmacKey(): string | undefined {
  return process.env.PROFILE_HEADER_HMAC_KEY;
}

/** PHI encryption key rotation — old key for decrypt-and-re-encrypt migration. */
export function getPhiEncryptionKeyOld(): string | undefined {
  return process.env.PHI_ENCRYPTION_KEY_OLD;
}

/** Backup encryption key (AES-256-GCM). */
export function getBackupEncryptionKey(): string | undefined {
  return process.env.BACKUP_ENCRYPTION_KEY;
}

/**
 * Supabase connection-pooler URL (PgBouncer/Supavisor on port 6543).
 * Set as a Cloudflare Workers secret. Falls back to the direct URL
 * when unset (local dev, CI without pooler).
 * Consumed by `src/lib/supabase-server.ts`.
 */
export function getSupabasePoolerUrl(): string | undefined {
  const value = process.env.SUPABASE_POOLER_URL?.trim();
  return value ? value : undefined;
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

/** Twilio account SID. */
export function getTwilioAccountSid(): string | undefined {
  return process.env.TWILIO_ACCOUNT_SID;
}

/** Twilio API Key SID. */
export function getTwilioApiKey(): string | undefined {
  return process.env.TWILIO_API_KEY;
}

/** Twilio API Secret. */
export function getTwilioApiSecret(): string | undefined {
  return process.env.TWILIO_API_SECRET;
}

/** Anthropic API key for Claude AI (AI Builder, CopilotKit runtime). */
export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

/** E2B sandbox API key for AI Builder code execution. */
export function getE2bApiKey(): string | undefined {
  return process.env.E2B_API_KEY;
}

/** Insurance provider. */
export function getInsuranceProvider(): string {
  return process.env.INSURANCE_PROVIDER ?? "sandbox";
}
