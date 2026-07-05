import { logger } from "@/lib/logger";

/**
 * Security-posture feature flags that meaningfully change the application's
 * authn/authz attack surface. Each entry pairs the flag itself with the
 * acknowledgement variable an operator must also set in production to
 * confirm they understand the change.
 *
 * The {@link enforceSecurityFlagAcknowledgments} guard hard-fails startup
 * when any of these flags is `"true"` in production but the matching
 * acknowledgment is not. This prevents accidental enablement from silently
 * widening the attack surface — the operator has to also set the
 * acknowledgement, which forces a deliberate decision.
 */
export const SECURITY_FLAG_ACKNOWLEDGMENTS: ReadonlyArray<{
  flag: string;
  ack: string;
  /** Short summary of what enabling the flag changes. */
  posture: string;
}> = [
  {
    flag: "SELF_SERVICE_REGISTRATION_ENABLED",
    ack: "SELF_SERVICE_REGISTRATION_ACK",
    posture:
      "exposes /api/v1/register-clinic to unauthenticated public traffic, " +
      "creating clinics and admin users with only Turnstile + DNS verification",
  },
  {
    flag: "NEXT_PUBLIC_PHONE_AUTH_ENABLED",
    ack: "PHONE_AUTH_ACK",
    posture:
      "enables phone/OTP login (Twilio SMS); requires Twilio credentials in " +
      "Supabase and changes the authentication surface and rate-limit profile",
  },
];

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function getSupabasePoolerUrlFromEnv(): string | undefined {
  const value = process.env.SUPABASE_POOLER_URL?.trim();
  return value ? value : undefined;
}

/**
 * Refuse to boot in production when seed user passwords have not been rotated.
 * Exported for unit tests.
 */
export function enforceSeedPasswordsRotated(): void {
  if (!isProductionRuntime()) return;

  const rotated = process.env.SEED_PASSWORDS_ROTATED;
  if (rotated !== "true") {
    const message =
      "[STARTUP HEALTH CHECK FAILED] Seed user passwords have not been rotated.\n" +
      "\n" +
      "Migration 00019 created users with a well-known default password\n" +
      "(see supabase/seed.sql). These credentials are publicly known.\n" +
      "\n" +
      "To fix:\n" +
      "  1. DELETE all seed users from auth.users and public.users, OR\n" +
      "     change ALL seed user passwords via Supabase Dashboard.\n" +
      "  2. Set the environment variable via: wrangler secret put SEED_PASSWORDS_ROTATED true\n" +
      "  3. Set the environment variable via: wrangler secret put SEED_USERS_DELETED true\n" +
      "  4. Re-deploy the application.\n" +
      "\n" +
      "Seed user UUIDs (from migration 00019):\n" +
      "  a0000000-0000-0000-0000-000000000001 (super_admin)\n" +
      "  a0000000-0000-0000-0000-000000000002 (clinic_admin)\n" +
      "  a0000000-0000-0000-0000-000000000003 (doctor)\n" +
      "  a0000000-0000-0000-0000-000000000004 (receptionist)\n" +
      "  a0000000-0000-0000-0000-000000000010..0014 (patients)\n" +
      "\n" +
      "The application will NOT start until this is resolved.";
    logger.error(message, {
      context: "env-validation",
      check: "seed-passwords-rotated",
    });
    throw new Error(message);
  }
}

/**
 * A2-08: Enforce explicit acknowledgement for every enabled security flag.
 * Exported for unit tests.
 */
export function enforceSecurityFlagAcknowledgments(): void {
  if (!isProductionRuntime()) return;

  const violations = SECURITY_FLAG_ACKNOWLEDGMENTS.filter(
    ({ flag, ack }) => process.env[flag] === "true" && process.env[ack] !== "true",
  );

  if (violations.length === 0) return;

  const lines = violations.map(
    ({ flag, ack, posture }) =>
      `  - ${flag}=true is set but ${ack}=true is missing.\n` +
      `    Posture change: ${posture}.\n` +
      `    Set ${ack}=true in your deployment environment to confirm.`,
  );
  const message =
    "[STARTUP HEALTH CHECK FAILED] Security-posture feature flags are enabled in\n" +
    "production without an explicit acknowledgement:\n\n" +
    lines.join("\n\n") +
    "\n\nThis check exists so flipping these flags is always a deliberate decision.";
  logger.error(message, {
    context: "env-validation",
    check: "security-flag-ack",
  });
  throw new Error(message);
}

/**
 * Refuse to boot when production is configured with PHI masking disabled
 * unless the operator has explicitly set ALLOW_UNMASKED_PHI=true.
 * Exported for unit tests.
 */
export function enforcePhiMaskingPolicy(): void {
  if (!isProductionRuntime()) return;

  const masking = process.env.NEXT_PUBLIC_DATA_MASKING;
  const allowUnmasked = process.env.ALLOW_UNMASKED_PHI === "true";

  if (masking === "none" && !allowUnmasked) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] NEXT_PUBLIC_DATA_MASKING=none is not allowed in production.\n" +
      'Production must default to "partial" or "full" so patient PHI is never\n' +
      "accidentally exposed in the UI. To intentionally disable masking (e.g. for an\n" +
      "internal staff-only deployment), set ALLOW_UNMASKED_PHI=true alongside\n" +
      'NEXT_PUBLIC_DATA_MASKING=none. See SECURITY.md → "PHI Masking Defaults".';
    logger.error(message, { context: "env-validation", check: "phi-masking" });
    throw new Error(message);
  }

  if (masking === "none" && allowUnmasked) {
    const reason = process.env.ALLOW_UNMASKED_PHI_REASON || "(no reason provided)";
    const message =
      "PHI masking is DISABLED in production (ALLOW_UNMASKED_PHI=true). " +
      "This must be approved by the Security Officer / DPO and documented. " +
      `Reason on record: ${reason}`;

    logger.warn(message, { context: "env-validation", check: "phi-masking" });

    import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.captureMessage(message, {
          level: "fatal",
          tags: {
            check: "phi-masking",
            allow_unmasked_phi: "true",
          },
          extra: { reason },
        });
      })
      .catch(() => {
        // Sentry unavailable — warning already emitted via logger.
      });
  }
}

/**
 * Refuse to boot in production when PHI_ENCRYPTION_KEY is missing or malformed.
 * Exported for unit tests.
 */
export function enforcePhiEncryptionConfigured(): void {
  if (!isProductionRuntime()) return;

  const key = process.env.PHI_ENCRYPTION_KEY;
  if (!key) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] PHI_ENCRYPTION_KEY is required in production.\n" +
      "Patient files (Moroccan Law 09-08 PHI) cannot be encrypted without it. Generate a key with: openssl rand -hex 32";
    logger.error(message, {
      context: "env-validation",
      check: "phi-encryption",
    });
    throw new Error(message);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] PHI_ENCRYPTION_KEY must be exactly 64 hex characters (256 bits).\n" +
      "Generate a valid key with: openssl rand -hex 32";
    logger.error(message, {
      context: "env-validation",
      check: "phi-encryption",
    });
    throw new Error(message);
  }
}

/**
 * Refuse to boot in production when BACKUP_ENCRYPTION_KEY is missing or malformed.
 * Exported for unit tests.
 */
export function enforceBackupEncryptionConfigured(): void {
  if (!isProductionRuntime()) return;

  const key = process.env.BACKUP_ENCRYPTION_KEY;
  if (!key) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] BACKUP_ENCRYPTION_KEY is required in production.\n" +
      "Database backups contain all PHI for all tenants (all clinic data). An unencrypted backup\n" +
      "is a single-point-of-compromise for the entire platform and violates Moroccan Law 09-08.\n" +
      "Generate a key with: openssl rand -hex 32";
    logger.error(message, {
      context: "env-validation",
      check: "backup-encryption",
    });
    throw new Error(message);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] BACKUP_ENCRYPTION_KEY must be exactly 64 hex characters (256 bits).\n" +
      "Generate a valid key with: openssl rand -hex 32";
    logger.error(message, {
      context: "env-validation",
      check: "backup-encryption",
    });
    throw new Error(message);
  }
}

/**
 * Require the Supabase transaction pooler to be configured in production.
 */
export function enforceSupabasePoolerConfigured(): void {
  if (!isProductionRuntime()) return;
  if (process.env.CI === "true") return;

  const poolerUrl = getSupabasePoolerUrlFromEnv();
  if (poolerUrl) return;

  const message =
    "[STARTUP HEALTH CHECK FAILED] SUPABASE_POOLER_URL is required in production.\n" +
    "Direct Postgres driver paths (migrations, backups) must use the Supabase\n" +
    "transaction pooler (port 6543) to avoid connection exhaustion from ephemeral\n" +
    "Cloudflare isolates. supabase-js request traffic already uses HTTPS/Supavisor\n" +
    "and is unaffected. Set the pooler URL via Worker secret before deploy.";
  logger.error(message, {
    context: "env-validation",
    check: "supabase-pooler",
  });
  throw new Error(message);
}

/**
 * Reject CRON_SECRET shorter than 32 characters in production.
 * Exported for unit tests.
 */
export function enforceCronSecretMinLength(): void {
  if (!isProductionRuntime()) return;

  const secret = process.env.CRON_SECRET;
  if (secret && secret.length < 32) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] CRON_SECRET must be at least 32 characters.\n" +
      "A short secret is vulnerable to brute-force. Generate one: `openssl rand -hex 32`.";
    logger.error(message, {
      context: "env-validation",
      check: "cron-secret-length",
    });
    throw new Error(message);
  }
}

/**
 * Reject BOOKING_TOKEN_SECRET shorter than 32 characters in production.
 * Exported for unit tests.
 */
export function enforceBookingTokenSecretMinLength(): void {
  if (!isProductionRuntime()) return;

  const secret = process.env.BOOKING_TOKEN_SECRET;
  if (secret && secret.length < 32) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] BOOKING_TOKEN_SECRET must be at least 32 characters.\n" +
      "A short secret lets attackers forge booking tokens and skip OTP verification. " +
      "Generate one: `openssl rand -hex 32`.";
    logger.error(message, {
      context: "env-validation",
      check: "booking-token-secret-length",
    });
    throw new Error(message);
  }
}

/**
 * Assert that PROFILE_HEADER_HMAC_KEY and CRON_SECRET are distinct.
 * Exported for unit tests.
 */
export function enforceHmacKeyIndependence(): void {
  if (!isProductionRuntime()) return;

  const hmac = process.env.PROFILE_HEADER_HMAC_KEY;
  const cron = process.env.CRON_SECRET;
  if (hmac && cron && hmac === cron) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] PROFILE_HEADER_HMAC_KEY must not equal CRON_SECRET.\n" +
      "Using the same value means a leaked cron token also compromises session-header " +
      "forgery. Generate a distinct key: `openssl rand -hex 32`.";
    logger.error(message, {
      context: "env-validation",
      check: "hmac-key-independence",
    });
    throw new Error(message);
  }
}

/**
 * Validate RATE_LIMIT_BACKEND against known values.
 * Exported for unit tests.
 */
export function enforceRateLimitBackend(): void {
  const backend = process.env.RATE_LIMIT_BACKEND;
  if (!backend) return;

  const validBackends = new Set(["kv", "supabase", "memory"]);
  if (!validBackends.has(backend)) {
    const message =
      `[STARTUP HEALTH CHECK FAILED] RATE_LIMIT_BACKEND="${backend}" is not a recognized value.\n` +
      `Valid options: ${[...validBackends].join(", ")}. A typo silently downgrades to in-memory limiting.`;
    logger.error(message, {
      context: "env-validation",
      check: "rate-limit-backend",
    });
    throw new Error(message);
  }

  if (isProductionRuntime() && backend === "memory") {
    if (process.env.GITHUB_ACTIONS === "true") {
      logger.warn(
        "RATE_LIMIT_BACKEND=memory accepted in production mode because GITHUB_ACTIONS=true. " +
          "This path is permitted only for the E2E Playwright runner and must " +
          "never be set in a real production deployment.",
        { context: "env-validation", check: "rate-limit-backend" },
      );
      return;
    }

    const message =
      "[STARTUP HEALTH CHECK FAILED] RATE_LIMIT_BACKEND=memory is not allowed in production.\n" +
      "In-memory rate limiting is per-isolate and provides no real protection in a " +
      "multi-isolate Worker deployment. Use 'kv' or 'supabase'.";
    logger.error(message, {
      context: "env-validation",
      check: "rate-limit-backend",
    });
    throw new Error(message);
  }
}

/**
 * Ensure exactly one email provider is configured at production boot.
 * Exported for unit tests.
 */
export function enforceEmailProviderExclusivity(): void {
  if (!isProductionRuntime()) return;

  const hasResend = !!process.env.RESEND_API_KEY;
  const hasSmtp = !!(
    (process.env.EMAIL_RELAY_HOST || process.env.SMTP_HOST) &&
    (process.env.EMAIL_RELAY_USER || process.env.SMTP_USER) &&
    (process.env.EMAIL_RELAY_PASS || process.env.SMTP_PASS)
  );

  if (hasResend && hasSmtp) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] Both Resend (RESEND_API_KEY) and the HTTP email relay\n" +
      "(EMAIL_RELAY_HOST/SMTP_HOST + USER + PASS) are configured. Configure exactly one email\n" +
      "provider — having both risks duplicate sends and ambiguous routing.";
    logger.error(message, {
      context: "env-validation",
      check: "email-provider-exclusivity",
    });
    throw new Error(message);
  }

  if (!hasResend && !hasSmtp) {
    const message =
      "[STARTUP HEALTH CHECK FAILED] No email provider is configured. Set either\n" +
      "RESEND_API_KEY or the HTTP email relay credentials\n" +
      "(EMAIL_RELAY_HOST/SMTP_HOST + EMAIL_RELAY_USER/SMTP_USER + EMAIL_RELAY_PASS/SMTP_PASS).";
    logger.error(message, {
      context: "env-validation",
      check: "email-provider-exclusivity",
    });
    throw new Error(message);
  }
}
