/**
 * SEED-01: Runtime guard against seed user authentication in production.
 *
 * Migration 00019 created seed users with well-known passwords visible
 * in git history. Migration 00039 deletes them, but if they are ever
 * re-created (e.g. by re-running earlier migrations) this guard
 * prevents them from authenticating in production environments.
 *
 * Defence-in-depth: the DB migration 00059 also adds a trigger that
 * blocks sign-in for these IDs at the database level.
 */

/**
 * The well-known seed user auth IDs created in migration 00019.
 * These IDs follow the pattern `a0000000-0000-0000-0000-0000000000XX`.
 */
const SEED_USER_AUTH_IDS: ReadonlySet<string> = new Set([
  "a0000000-0000-0000-0000-000000000001", // Super Admin
  "a0000000-0000-0000-0000-000000000002", // Clinic Admin
  "a0000000-0000-0000-0000-000000000003", // Doctor
  "a0000000-0000-0000-0000-000000000004", // Receptionist
  "a0000000-0000-0000-0000-000000000010", // Patient 1
  "a0000000-0000-0000-0000-000000000011", // Patient 2
  "a0000000-0000-0000-0000-000000000012", // Patient 3
  "a0000000-0000-0000-0000-000000000013", // Patient 4
  "a0000000-0000-0000-0000-000000000014", // Patient 5
]);

/**
 * Returns true if the environment is considered production.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check whether an auth user ID belongs to a seed user that must be
 * blocked from authenticating in production.
 *
 * Returns `true` if the user should be blocked (seed user + production).
 * Returns `false` in development/test or for non-seed users.
 */
export function isSeedUserBlocked(authId: string | null | undefined): boolean {
  if (!authId) return false;
  if (!isProduction()) return false;
  return SEED_USER_AUTH_IDS.has(authId);
}

/**
 * The set of seed user auth IDs (exported for use in tests / migrations).
 */
export { SEED_USER_AUTH_IDS };
