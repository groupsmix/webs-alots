/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export function register() {
  // CRITICAL-03: Enforce seed password rotation in production.
  // Migration 00019 creates seed users with the well-known password
  // "seed-password-change-me". In production, operators MUST rotate
  // these passwords and then set SEED_PASSWORDS_ROTATED=true.
  // Previously this was a warning; now it hard-fails to prevent
  // running with known default credentials.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEED_PASSWORDS_ROTATED !== "true"
  ) {
    throw new Error(
      "FATAL: Seed user passwords have not been rotated. " +
      "Migration 00019 created users with the default password " +
      '"seed-password-change-me". These accounts are publicly known ' +
      "and must be rotated before running in production. " +
      "Set SEED_PASSWORDS_ROTATED=true after changing all seed passwords.",
    );
  }
}
