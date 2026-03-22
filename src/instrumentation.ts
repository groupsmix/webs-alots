/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export function register() {
  // S8: Warn loudly if seed user passwords may not have been rotated.
  // Migration 00019 creates seed users with the well-known password
  // "seed-password-change-me". In production, operators MUST rotate
  // these passwords and then set SEED_PASSWORDS_ROTATED=true to
  // silence this warning.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEED_PASSWORDS_ROTATED !== "true"
  ) {
    console.warn(
      "\n" +
      "╔══════════════════════════════════════════════════════════════════╗\n" +
      "║  WARNING: Seed user passwords may not have been rotated!       ║\n" +
      "║                                                                ║\n" +
      "║  Migration 00019 created users with the default password       ║\n" +
      '║  "seed-password-change-me". If these accounts still use the    ║\n' +
      "║  default password, your application is vulnerable.             ║\n" +
      "║                                                                ║\n" +
      "║  After rotating all seed passwords, set the environment        ║\n" +
      "║  variable SEED_PASSWORDS_ROTATED=true to suppress this         ║\n" +
      "║  warning.                                                      ║\n" +
      "╚══════════════════════════════════════════════════════════════════╝\n",
    );
  }
}
