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

/**
 * Internal helper used while building `ENV_RULES` so the `required` flag is
 * evaluated at module load (matching how the other rules use
 * `process.env.NODE_ENV === "production"` checks).
 */
function customDomainsEnabledFromEnv(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CUSTOM_DOMAINS === "true";
}

export const ENV_RULES: EnvRule[] = [
  // ── Core (required for the app to function) ────────────────────────
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
    group: "core",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key",
    group: "core",
  },

  // ── Auth / Security ────────────────────────────────────────────────
  {
    name: "SEED_PASSWORDS_ROTATED",
    required: process.env.NODE_ENV === "production",
    description:
      "Must be set to 'true' in production to acknowledge that seed user passwords have been rotated",
    group: "security",
  },
  {
    name: "BOOKING_TOKEN_SECRET",
    required: process.env.NODE_ENV === "production",
    description: "HMAC secret for booking verification tokens (required in production)",
    group: "auth",
  },
  {
    name: "BOOKING_TOKEN_SECRET_OLD",
    required: false,
    description: "Previous HMAC secret — set during rotation, remove after overlap window",
    group: "auth",
  },

  // ── Multi-tenant ───────────────────────────────────────────────────
  {
    name: "ROOT_DOMAIN",
    required: process.env.NODE_ENV === "production",
    description: "Root domain for subdomain routing (required in production)",
    group: "tenant",
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    required: process.env.NODE_ENV === "production",
    description: "Public site URL for CSRF and links (required in production)",
    group: "tenant",
  },

  // ── Supabase Service Role (needed for rate limiter, cron, admin ops) ─
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: process.env.NODE_ENV === "production",
    description: "Required server-only key for admin Supabase operations (required in production)",
    group: "core",
  },

  // ── Cloudflare R2 Storage ──────────────────────────────────────────
  {
    name: "R2_ACCOUNT_ID",
    required: false,
    description: "Cloudflare R2 account ID",
    group: "storage",
  },
  {
    name: "R2_ACCESS_KEY_ID",
    required: false,
    description: "Cloudflare R2 access key",
    group: "storage",
  },
  {
    name: "R2_SECRET_ACCESS_KEY",
    required: false,
    description: "Cloudflare R2 secret key",
    group: "storage",
  },
  {
    name: "R2_BUCKET_NAME",
    required: false,
    description: "Cloudflare R2 bucket name",
    group: "storage",
  },
  {
    name: "R2_SIGNED_URL_SECRET",
    required:
      process.env.NODE_ENV === "production" ||
      process.env.DEPLOY_ENV === "staging" ||
      process.env.NEXT_PUBLIC_DEPLOY_ENV === "staging",
    description:
      "HMAC secret for R2 signed URLs and upload filename hashing (required in production and staging; `openssl rand -hex 32`)",
    group: "storage",
  },
  {
    name: "R2_ORPHAN_RATE_ALERT_THRESHOLD",
    required: false,
    description:
      "Orphan-rate threshold (0..1) above which the R2 cleanup cron emits a Sentry alert. Default: 0.1",
    group: "storage",
  },

  // ── Payments ───────────────────────────────────────────────────────
  {
    name: "STRIPE_SECRET_KEY",
    required: false,
    description: "Stripe secret key",
    group: "payments",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    required: false,
    description: "Stripe webhook signing secret",
    group: "payments",
  },
  {
    name: "CMI_MERCHANT_ID",
    required: false,
    description: "CMI merchant ID",
    group: "payments",
  },
  {
    name: "CMI_SECRET_KEY",
    required: false,
    description: "CMI HMAC secret key",
    group: "payments",
  },

  // ── WhatsApp ───────────────────────────────────────────────────────
  {
    name: "META_APP_SECRET",
    required: false,
    description: "Meta app secret for webhook verification",
    group: "whatsapp",
  },
  {
    name: "WHATSAPP_VERIFY_TOKEN",
    required: false,
    description: "WhatsApp webhook verify token",
    group: "whatsapp",
  },

  // ── Email ──────────────────────────────────────────────────────────
  {
    name: "RESEND_API_KEY",
    required: false,
    description: "Resend API key for email",
    group: "email",
  },

  // ── AI / Chat ──────────────────────────────────────────────────────
  {
    name: "OPENAI_API_KEY",
    required: false,
    description: "OpenAI API key for advanced chat",
    group: "ai",
  },
  {
    name: "ANTHROPIC_API_KEY",
    required: false,
    description: "Anthropic API key for Claude AI (used by AI Builder and CopilotKit runtime)",
    group: "ai",
  },
  {
    name: "CLOUDFLARE_ACCOUNT_ID",
    required: false,
    description: "Cloudflare account ID for Workers AI",
    group: "ai",
  },
  {
    name: "CLOUDFLARE_AI_API_TOKEN",
    required: false,
    description: "Cloudflare AI API token",
    group: "ai",
  },
  {
    name: "E2B_API_KEY",
    required: false,
    description:
      "E2B sandbox API key for AI Builder (get from https://e2b.dev — free tier: 100 sandbox-hours/month)",
    group: "ai-builder",
  },

  // ── Contact / file encryption ────────────────────────────────
  {
    name: "PHI_ENCRYPTION_KEY",
    required: process.env.NODE_ENV === "production",
    description:
      "AES-256-GCM key for patient contact-field and file encryption (64 hex chars, required in production; `openssl rand -hex 32`)",
    group: "security",
  },
  {
    name: "BACKUP_ENCRYPTION_KEY",
    required: process.env.NODE_ENV === "production",
    description:
      "AES-256-GCM key for database backup encryption (64 hex chars, required in production; `openssl rand -hex 32`)",
    group: "security",
  },

  // ── Observability ────────────────────────────────────────────────────
  {
    name: "NEXT_PUBLIC_SENTRY_DSN",
    required: process.env.NODE_ENV === "production",
    description: "Sentry DSN for error monitoring (required in production)",
    group: "observability",
  },
  {
    name: "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
    required: false,
    description: "Plausible site domain (NEXT_PUBLIC_*), e.g. oltigo.com. Optional.",
    group: "observability",
  },
  {
    name: "NEXT_PUBLIC_PLAUSIBLE_HOST",
    required: !!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && process.env.NODE_ENV === "production",
    description:
      "Self-hosted Plausible Analytics host URL (required in production when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set)",
    group: "observability",
  },
  {
    name: "NEXT_PUBLIC_GA_MEASUREMENT_ID",
    required: false,
    description: "Google Analytics 4 measurement ID (per-clinic, optional).",
    group: "observability",
  },

  // ── Security: AV scanning ────────────────────────
  {
    name: "AV_SCAN_URL",
    required: process.env.NODE_ENV === "production" && process.env.CI !== "true",
    description:
      "AV scanner endpoint (e.g. ClamAV REST) for upload virus scanning (required in production)",
    group: "security",
  },
  {
    name: "AV_SCAN_REQUIRED",
    required: process.env.NODE_ENV === "production",
    description:
      "Set to 'true' to fail-closed when AV scan is unavailable (required in production)",
    group: "security",
  },

  // ── Cron ───────────────────────────────────────────────────────────
  {
    name: "CRON_SECRET",
    required: process.env.NODE_ENV === "production",
    description: "Bearer token for cron endpoints (required in production)",
    group: "cron",
  },

  // ── Profile-header HMAC ────────────────────────────────────
  {
    name: "PROFILE_HEADER_HMAC_KEY",
    required: process.env.NODE_ENV === "production",
    description:
      "HMAC key used to sign x-auth-profile-* headers between middleware and withAuth (required in production)",
    group: "auth",
  },

  // ── Geo-restriction ──────────────────────────────────────────────────
  {
    name: "ADMIN_GEO_RESTRICTION_ENABLED",
    required: false,
    description: "Toggle admin-route geo-restriction (defaults to true; set to 'false' to disable)",
    group: "security",
  },
  {
    name: "GEO_RESTRICT_ADMIN",
    required: false,
    description:
      "Comma-separated ISO 3166-1 alpha-2 country codes allowed to access admin routes (defaults to 'MA')",
    group: "security",
  },

  // ── Custom Domains ─────────────────────────────────────────────────
  {
    name: "CLOUDFLARE_API_TOKEN",
    required: false,
    description: "Cloudflare scoped API token for DNS management",
    group: "domains",
  },
  {
    name: "CLOUDFLARE_ZONE_ID",
    required: customDomainsEnabledFromEnv(),
    description:
      "Cloudflare zone ID for DNS management (required when NEXT_PUBLIC_ENABLE_CUSTOM_DOMAINS=true)",
    group: "domains",
  },
  {
    name: "CLOUDFLARE_ZONE_NAME",
    required: customDomainsEnabledFromEnv(),
    description:
      "Cloudflare zone (root domain) name for DNS management (required when NEXT_PUBLIC_ENABLE_CUSTOM_DOMAINS=true)",
    group: "domains",
  },

  // ── MVP Scope / Feature Flags ──────────────────────────────────────
  {
    name: "NEXT_PUBLIC_DEMO_ENABLED",
    required: false,
    description: "Enable demo mode for landing-page CTA and demo tenant. Default: false.",
    group: "feature-flags",
  },
  {
    name: "AI_DISABLED",
    required: false,
    description:
      "Emergency AI kill switch override. When 'true', all AI features are disabled and the dashboard toggle is locked. Default: unset.",
    group: "feature-flags",
  },
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
        missing.push({
          name: rule.name,
          description: rule.description,
          group: rule.group,
        });
      } else {
        warnings.push({
          name: rule.name,
          description: rule.description,
          group: rule.group,
        });
      }
    }
  }

  if (process.env.WHATSAPP_PROVIDER === "meta" && !process.env.META_APP_SECRET) {
    missing.push({
      name: "META_APP_SECRET",
      description:
        "Meta app secret for webhook HMAC verification (required when WHATSAPP_PROVIDER=meta)",
      group: "whatsapp",
    });
  }

  if (customDomainsEnabledFromEnv()) {
    const hasToken = !!process.env.CLOUDFLARE_API_TOKEN;
    if (!hasToken) {
      missing.push({
        name: "CLOUDFLARE_API_TOKEN",
        description: "Cloudflare API token required when NEXT_PUBLIC_ENABLE_CUSTOM_DOMAINS=true",
        group: "domains",
      });
    }
  }

  const isProduction = process.env.NODE_ENV === "production";
  const avScanRequired = process.env.AV_SCAN_REQUIRED === "true";
  if (isProduction && avScanRequired && !process.env.AV_SCAN_URL) {
    missing.push({
      name: "AV_SCAN_URL",
      description: "AV scanner endpoint required when AV_SCAN_REQUIRED=true in production",
      group: "security",
    });
  }

  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const isCiRunner = process.env.CI === "true";
  if (isProduction && !isBuildPhase && !isCiRunner) {
    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!sentryDsn || /placeholder/i.test(sentryDsn)) {
      missing.push({
        name: "NEXT_PUBLIC_SENTRY_DSN",
        description:
          "Real Sentry DSN required in production (currently missing or set to a 'placeholder' value) — client-side error monitoring is dead without it",
        group: "observability",
      });
    }
  }

  return { valid: missing.length === 0, missing, warnings };
}
