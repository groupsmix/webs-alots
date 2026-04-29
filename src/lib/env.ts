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
 */

import { logger } from "@/lib/logger";

interface EnvRule {
  /** Environment variable name */
  name: string;
  /** If true, the server will refuse to start without this variable */
  required: boolean;
  /** Human-readable description shown in error messages */
  description: string;
  /** Feature group for log grouping */
  group: string;
}

const ENV_RULES: EnvRule[] = [
  // ── Core (required for the app to function) ────────────────────────
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, description: "Supabase project URL", group: "core" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, description: "Supabase anonymous key", group: "core" },

  // ── Auth / Security ────────────────────────────────────────────────
  { name: "BOOKING_TOKEN_SECRET", required: process.env.NODE_ENV === "production", description: "HMAC secret for booking verification tokens (required in production)", group: "auth" },

  // ── Phone Auth (Twilio SMS OTP) ──────────────────────────────────────
  // These are NOT required at startup. They are only needed when
  // NEXT_PUBLIC_PHONE_AUTH_ENABLED is set to "true". Documented here
  // so that `validateEnv()` can warn when phone auth is enabled but
  // the Twilio credentials are missing.
  // Configure these in Supabase Dashboard > Auth > Providers > Phone:
  //   - TWILIO_ACCOUNT_SID
  //   - TWILIO_AUTH_TOKEN
  //   - TWILIO_MESSAGE_SERVICE_SID

  // ── Multi-tenant ───────────────────────────────────────────────────
  { name: "ROOT_DOMAIN", required: process.env.NODE_ENV === "production", description: "Root domain for subdomain routing (required in production)", group: "tenant" },
  { name: "NEXT_PUBLIC_SITE_URL", required: process.env.NODE_ENV === "production", description: "Public site URL for CSRF and links (required in production)", group: "tenant" },

  // ── Supabase Service Role (needed for rate limiter, cron, admin ops) ─
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: process.env.NODE_ENV === "production", description: "Required server-only key for admin Supabase operations (required in production)", group: "core" },

  // ── Cloudflare R2 Storage ──────────────────────────────────────────
  { name: "R2_ACCOUNT_ID", required: false, description: "Cloudflare R2 account ID", group: "storage" },
  { name: "R2_ACCESS_KEY_ID", required: false, description: "Cloudflare R2 access key", group: "storage" },
  { name: "R2_SECRET_ACCESS_KEY", required: false, description: "Cloudflare R2 secret key", group: "storage" },
  { name: "R2_BUCKET_NAME", required: false, description: "Cloudflare R2 bucket name", group: "storage" },
  // Audit Finding #8: PHI file paths and signed URLs are derived from this
  // secret. A hardcoded fallback ("default-salt") is never acceptable in
  // production, so we refuse to boot without a dedicated R2_SIGNED_URL_SECRET.
  { name: "R2_SIGNED_URL_SECRET", required: process.env.NODE_ENV === "production", description: "HMAC secret for R2 signed URLs and upload filename hashing (required in production; `openssl rand -hex 32`)", group: "storage" },
  // Consumed by `src/lib/r2-cleanup.ts` — the fraction (0..1) of keys in a
  // reconciliation pass that, when classified as orphans, triggers a
  // Sentry alert and an error-level log line. Optional: defaults to 0.1
  // (10 %) when unset. The library ignores out-of-range or non-numeric
  // values rather than failing closed — see `readOrphanRateAlertThreshold`.
  { name: "R2_ORPHAN_RATE_ALERT_THRESHOLD", required: false, description: "Orphan-rate threshold (0..1) above which the R2 cleanup cron emits a Sentry alert. Default: 0.1", group: "storage" },

  // ── Payments ───────────────────────────────────────────────────────
  { name: "STRIPE_SECRET_KEY", required: false, description: "Stripe secret key", group: "payments" },
  { name: "STRIPE_WEBHOOK_SECRET", required: false, description: "Stripe webhook signing secret", group: "payments" },
  { name: "CMI_MERCHANT_ID", required: false, description: "CMI merchant ID", group: "payments" },
  { name: "CMI_SECRET_KEY", required: false, description: "CMI HMAC secret key", group: "payments" },

  // ── WhatsApp ───────────────────────────────────────────────────────
  { name: "META_APP_SECRET", required: false, description: "Meta app secret for webhook verification", group: "whatsapp" },
  { name: "WHATSAPP_VERIFY_TOKEN", required: false, description: "WhatsApp webhook verify token", group: "whatsapp" },

  // ── Email ──────────────────────────────────────────────────────────
  { name: "RESEND_API_KEY", required: false, description: "Resend API key for email", group: "email" },

  // ── AI / Chat ──────────────────────────────────────────────────────
  { name: "OPENAI_API_KEY", required: false, description: "OpenAI API key for advanced chat", group: "ai" },
  { name: "CLOUDFLARE_ACCOUNT_ID", required: false, description: "Cloudflare account ID for Workers AI", group: "ai" },
  { name: "CLOUDFLARE_AI_API_TOKEN", required: false, description: "Cloudflare AI API token", group: "ai" },

  // ── Cron ───────────────────────────────────────────────────────────
  { name: "CRON_SECRET", required: process.env.NODE_ENV === "production", description: "Bearer token for cron endpoints (required in production)", group: "cron" },

  // ── Profile-header HMAC (R-02) ────────────────────────────────────
  // Distinct key from CRON_SECRET so leaking one does not compromise
  // both cron invocation and session-header forgery. Falls back to
  // CRON_SECRET only as a transitional measure (see profile-header-hmac.ts).
  { name: "PROFILE_HEADER_HMAC_KEY", required: process.env.NODE_ENV === "production", description: "HMAC key used to sign x-auth-profile-* headers between middleware and withAuth (required in production)", group: "auth" },

  // ── Custom Domains ─────────────────────────────────────────────────
  { name: "CLOUDFLARE_API_TOKEN", required: false, description: "Cloudflare API token for DNS management", group: "domains" },
  { name: "CLOUDFLARE_ZONE_ID", required: false, description: "Cloudflare zone ID for DNS management", group: "domains" },
];

export interface EnvValidationResult {
  valid: boolean;
  missing: { name: string; description: string; group: string }[];
  warnings: { name: string; description: string; group: string }[];
}

/**
 * Validate all environment variables and return a structured result.
 * Does NOT throw — the caller decides whether to hard-fail or warn.
 */
export function validateEnv(): EnvValidationResult {
  const missing: EnvValidationResult["missing"] = [];
  const warnings: EnvValidationResult["warnings"] = [];

  for (const rule of ENV_RULES) {
    if (!process.env[rule.name]) {
      if (rule.required) {
        missing.push({ name: rule.name, description: rule.description, group: rule.group });
      } else {
        warnings.push({ name: rule.name, description: rule.description, group: rule.group });
      }
    }
  }

  return { valid: missing.length === 0, missing, warnings };
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
      logger.info(`Optional env vars missing for "${group}" (feature will be disabled):\n${vars.join("\n")}`, {
        context: "env-validation",
        group,
      });
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

  // Audit Finding #7 — enforce safe PHI masking defaults in production.
  // Production must default to a masked view of PHI ("partial" or "full").
  // Explicitly disabling masking ("none") is only permitted when the operator
  // has set ALLOW_UNMASKED_PHI=true. See SECURITY.md → "PHI Masking Defaults".
  enforcePhiMaskingPolicy();
}

/**
 * Refuse to boot when production is configured with PHI masking disabled
 * unless the operator has explicitly set ALLOW_UNMASKED_PHI=true.
 *
 * Exported for unit tests.
 */
export function enforcePhiMaskingPolicy(): void {
  if (process.env.NODE_ENV !== "production") return;

  const masking = process.env.NEXT_PUBLIC_DATA_MASKING;
  const allowUnmasked = process.env.ALLOW_UNMASKED_PHI === "true";

  if (masking === "none" && !allowUnmasked) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] NEXT_PUBLIC_DATA_MASKING=none is not allowed in production.\n" +
      "Production must default to \"partial\" or \"full\" so patient PHI is never\n" +
      "accidentally exposed in the UI. To intentionally disable masking (e.g. for an\n" +
      "internal staff-only deployment), set ALLOW_UNMASKED_PHI=true alongside\n" +
      "NEXT_PUBLIC_DATA_MASKING=none. See SECURITY.md → \"PHI Masking Defaults\".";
    logger.error(message, { context: "env-validation", check: "phi-masking" });
    throw new Error(message);
  }

  if (masking === "none" && allowUnmasked) {
    logger.warn(
      "PHI masking is DISABLED in production (ALLOW_UNMASKED_PHI=true). " +
        "This must be approved by the Security Officer / DPO and documented.",
      { context: "env-validation", check: "phi-masking" },
    );
  }
}
