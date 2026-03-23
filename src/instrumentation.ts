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
    // Log a structured message before throwing so monitoring tools can
    // surface the exact remediation steps without parsing the error stack.
    const message =
      "[STARTUP HEALTH CHECK FAILED] Seed user passwords have not been rotated.\n" +
      "\n" +
      "Migration 00019 created users with the default password\n" +
      '"seed-password-change-me". These credentials are publicly known.\n' +
      "\n" +
      "To fix:\n" +
      "  1. Log into Supabase and change ALL seed user passwords.\n" +
      "  2. Set the environment variable SEED_PASSWORDS_ROTATED=true\n" +
      "  3. Re-deploy the application.\n" +
      "\n" +
      "The application will NOT start until this is resolved.";
    console.error(message);
    throw new Error(message);
  }
}
