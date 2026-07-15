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
 *
 * P11: this file is a thin barrel. The implementation lives in leaf modules:
 *   - `@/lib/env-validation`             — ENV_RULES registry + validateEnv()
 *   - `@/lib/env-startup`                — production enforcement guards
 *   - `@/lib/env-getters-core`           — Supabase, domains, platform secrets
 *   - `@/lib/env-getters-integrations`   — Stripe, R2, Cloudflare, Twilio, email, AI
 *   - `@/lib/env-getters-observability`  — Plausible, GA, AV-scan
 *   - `@/lib/env-flags`                  — boolean toggles & runtime-mode helpers
 * `@/lib/env` remains the stable public API — import from here, not the leaves.
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

// ─── Typed getters — use these instead of process.env.X directly ───────────
// Each getter is the authoritative read point for its variable. Files that
// need a value import the getter from here rather than reading process.env.
// This ensures validateEnv() validation runs at startup before any accessor
// is called, and avoids spreading raw process.env reads across the codebase.
// P11: the getters live in domain-grouped leaf modules and are re-exported
// here so no consumer import path changes.

export {
  getBackupEncryptionKey,
  getBookingTokenSecret,
  getCronSecret,
  getCronSecretRotatedAt,
  getDemoUrl,
  getPhiEncryptionKey,
  getPhiEncryptionKeyOld,
  getProfileHeaderHmacKey,
  getPublicAppVersion,
  getRateLimitBackend,
  getRootDomain,
  getSiteUrl,
  getSupabaseAnonKey,
  getSupabasePoolerUrl,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env-getters-core";

export {
  getAnthropicApiKey,
  getCloudflareApiConfig,
  getE2bApiKey,
  getEmailFromAddress,
  getInsuranceProvider,
  getMetaAppSecret,
  getR2Config,
  getR2OrphanRateAlertThreshold,
  getResendApiKey,
  getSmtpHost,
  getSmtpPass,
  getSmtpUser,
  getStripeSecretKey,
  getStripeWebhookSecret,
  getTwilioAccountSid,
  getTwilioApiKey,
  getTwilioApiSecret,
  getUptimeKumaWebhookSecret,
  getWhatsAppVerifyToken,
  getWorkersAiConfig,
  getWorkersAiConfigAsync,
} from "@/lib/env-getters-integrations";

export {
  getAvScanRequired,
  getAvScanUrl,
  getGaMeasurementId,
  getPlausibleDomain,
  getPlausibleHost,
} from "@/lib/env-getters-observability";

export {
  getAllowStagingDestructiveCrons,
  getGeoRestrictAdminCountries,
  getWorkerEnv,
  isAdminGeoRestrictionEnabled,
  isAiDisabledByEnv,
  isCi,
  isCustomDomainsEnabled,
  isMfaEnabled,
  isProduction,
  isSuperAdminMfaRequired,
} from "@/lib/env-flags";

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
