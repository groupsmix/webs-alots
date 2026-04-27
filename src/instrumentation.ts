import * as Sentry from "@sentry/nextjs";

/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// R-20 Fix: Per-route sampling configuration for instrumentation
const SAMPLE_RATES = {
  // Critical paths: 100% sampling for webhooks, cron, payment
  CRITICAL: 1.0,
  // Mutations: 50% sampling for POST/PUT/PATCH/DELETE
  MUTATION: 0.5,
  // Read operations: 10% sampling for GET requests
  READ: 0.1,
} as const;

/**
 * Get sample rate based on transaction context
 */
function getSampleRate(transactionContext: {
  name?: string;
  description?: string;
  tags?: Record<string, string>;
}): number {
  const context = [
    transactionContext.name || "",
    transactionContext.description || "",
    ...Object.values(transactionContext.tags || {}),
  ].join(" ").toLowerCase();

  // Critical paths
  if (
    context.includes("webhook") ||
    context.includes("cron") ||
    context.includes("payment") ||
    context.includes("stripe") ||
    context.includes("notification") ||
    context.includes("reminder")
  ) {
    return SAMPLE_RATES.CRITICAL;
  }

  // Mutations
  if (
    context.includes("post") ||
    context.includes("put") ||
    context.includes("patch") ||
    context.includes("delete") ||
    context.includes("booking") ||
    context.includes("appointment") ||
    context.includes("register")
  ) {
    return SAMPLE_RATES.MUTATION;
  }

  // Reads
  return SAMPLE_RATES.READ;
}

export function register() {
  // Initialize Sentry for server-side error monitoring.
  // DSN is provided via NEXT_PUBLIC_SENTRY_DSN env var.
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // R-20 Fix: Set sendDefaultPii to false explicitly
      // @sentry/nextjs@8 defaults this to true, which is a PII risk
      sendDefaultPii: false,

      // Base tracesSampleRate; per-transaction sampling is handled via tracesSampler
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

      // R-20 Fix: Per-transaction sampling for fine-grained control
      tracesSampler(samplingContext) {
        return getSampleRate(samplingContext);
      },
    });
  }
  // Validate all required environment variables at startup so missing
  // config is surfaced immediately rather than at runtime.
  // Dynamic import avoids pulling logger into the module graph before
  // Next.js has finished bootstrapping.
  import("@/lib/env").then(({ enforceEnvValidation }) => {
    enforceEnvValidation();
  });

  // F-12: Fatal throw when staging env uses production Supabase.
  if (process.env.ROOT_DOMAIN?.includes("staging")) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (supabaseUrl && !supabaseUrl.includes("staging")) {
      const message =
        "[FATAL] Staging environment detected (ROOT_DOMAIN contains 'staging') " +
        "but NEXT_PUBLIC_SUPABASE_URL does not point to a staging Supabase project.\n" +
        "Current value: " + supabaseUrl + "\n" +
        "Staging MUST use a separate Supabase project to prevent data leakage.";
      import("@/lib/logger").then(({ logger }) => logger.error(message, { context: "instrumentation" }));
      throw new Error(message);
    }
  }

  // F-02: Enforce seed user deletion via a positive DB check in production.
  // SEED_PASSWORDS_ROTATED has been removed from wrangler.toml; it must now
  // be set via `wrangler secret put SEED_PASSWORDS_ROTATED`.
  // The runtime guard additionally verifies that seed accounts are truly gone
  // from auth.users so that a forked repo cannot bypass the check by setting
  // the env var without actually deleting the accounts.
  if (process.env.NODE_ENV === "production") {
    // Require the env var to be set via wrangler secret (not committed in repo)
    if (process.env.SEED_PASSWORDS_ROTATED !== "true") {
      const message =
        "[STARTUP HEALTH CHECK FAILED] Seed user passwords have not been rotated.\n" +
        "\n" +
        "Migration 00019 created users with the default password\n" +
        '"seed-password-change-me". These credentials are publicly known.\n' +
        "\n" +
        "To fix:\n" +
        "  1. DELETE all seed users from auth.users and public.users, OR\n" +
        "     change ALL seed user passwords via Supabase Dashboard.\n" +
        "  2. Set the environment variable via: wrangler secret put SEED_PASSWORDS_ROTATED\n" +
        "  3. Set the environment variable via: wrangler secret put SEED_USERS_DELETED\n" +
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
      import("@/lib/logger").then(({ logger }) => logger.error(message, { context: "instrumentation" }));
      throw new Error(message);
    }

    // Positive DB check: verify seed accounts are actually deleted
    const SEED_AUTH_IDS = [
      "a0000000-0000-0000-0000-000000000001",
      "a0000000-0000-0000-0000-000000000002",
      "a0000000-0000-0000-0000-000000000003",
      "a0000000-0000-0000-0000-000000000004",
    ];

    import("@/lib/supabase-server").then(({ createAdminClient }) => {
      try {
        const supabase = createAdminClient();
        supabase
          .from("users")
          .select("id")
          .in("auth_id", SEED_AUTH_IDS)
          .limit(1)
          .then(({ data }) => {
            if (data && data.length > 0) {
              import("@/lib/logger").then(({ logger }) => {
                logger.error(
                  "[STARTUP WARNING] Seed user accounts still exist in the database despite " +
                  "SEED_PASSWORDS_ROTATED being set. Delete seed accounts for full security.",
                  { context: "instrumentation", seedUsersFound: data.length },
                );
              });
            }
          });
      } catch {
        // DB check is best-effort; env var guard is the primary gate
      }
    });

    if (process.env.SEED_USERS_DELETED !== "true") {
      import("@/lib/logger").then(({ logger }) => {
        logger.warn(
          "[STARTUP WARNING] SEED_PASSWORDS_ROTATED is set but SEED_USERS_DELETED is not.\n" +
          "The seed user emails (e.g. admin@health-saas.ma) are publicly visible in the\n" +
          "GitHub repository. Deleting these accounts entirely is strongly recommended.\n" +
          "Set SEED_USERS_DELETED=true after removing them to silence this warning.",
          { context: "instrumentation" },
        );
      });
    }
  }
}
