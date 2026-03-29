import * as Sentry from "@sentry/nextjs";

/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export function register() {
  // Initialize Sentry for server-side error monitoring.
  // DSN is provided via NEXT_PUBLIC_SENTRY_DSN env var.
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    });
  }
  // Validate all required environment variables at startup so missing
  // config is surfaced immediately rather than at runtime.
  // Dynamic import avoids pulling logger into the module graph before
  // Next.js has finished bootstrapping.
  import("@/lib/env").then(({ enforceEnvValidation }) => {
    enforceEnvValidation();
  });

  // CRITICAL-03: Enforce seed password rotation in production.
  // Migration 00019 creates seed users with the well-known password
  // "seed-password-change-me". In production, operators MUST either
  // delete the seed accounts or rotate their passwords, then set
  // SEED_PASSWORDS_ROTATED=true.
  //
  // Additionally, SEED_USERS_DELETED=true should be set to confirm
  // the seed accounts have been fully removed from auth.users.
  // This two-flag approach ensures operators have actually taken action
  // rather than just setting a single env var.
  if (process.env.NODE_ENV === "production") {
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
        "  2. Set the environment variable SEED_PASSWORDS_ROTATED=true\n" +
        "  3. Set the environment variable SEED_USERS_DELETED=true if accounts were deleted\n" +
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
      console.error(message);
      throw new Error(message);
    }

    // Warn (non-fatal) if passwords were rotated but accounts not deleted.
    // Deleting seed accounts is the safest option since the emails are
    // publicly known in the GitHub repo.
    if (process.env.SEED_USERS_DELETED !== "true") {
      console.warn(
        "[STARTUP WARNING] SEED_PASSWORDS_ROTATED is set but SEED_USERS_DELETED is not.\n" +
        "The seed user emails (e.g. admin@health-saas.ma) are publicly visible in the\n" +
        "GitHub repository. Deleting these accounts entirely is strongly recommended.\n" +
        "Set SEED_USERS_DELETED=true after removing them to silence this warning.",
      );
    }
  }
}
