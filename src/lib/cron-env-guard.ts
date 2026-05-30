/**
 * F-13 (audit-4) — Destructive cron safety guard for non-production envs.
 *
 * Background: in `wrangler.toml`, both `[env.production.vars]` and
 * `[env.staging.vars]` set `NODE_ENV = "production"` so the Next.js runtime
 * behaves the same in both. That makes `NODE_ENV` useless as a staging-vs-
 * production discriminator. A separate marker (`WORKER_ENV`) is therefore
 * set per-env in `wrangler.toml`:
 *
 *   [env.production.vars]  WORKER_ENV = "production"
 *   [env.staging.vars]     WORKER_ENV = "staging"
 *
 * Destructive crons (GDPR purge, billing renewals, Stripe reconciliation,
 * dedup TTL purge) must not execute in staging unless an operator has
 * explicitly opted in, because:
 *
 *   1. Staging schedules in `wrangler.toml` are identical to production's.
 *   2. If a Worker secret injection error lets staging resolve to the
 *      production Supabase URL/key, the destructive cron would purge real
 *      patient records, charge real customers, or corrupt the live
 *      financial journal.
 *
 * Guard contract: return a 503 NextResponse if the current Worker env is
 * `staging` and `ALLOW_STAGING_DESTRUCTIVE_CRONS !== "true"`. Otherwise
 * return null (cron is allowed to proceed). Always returns null when
 * `WORKER_ENV` is unset (local dev, tests, preview, prod-without-marker).
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Logical names for the cron jobs that mutate production-sensitive state.
 * Kept as a string union so adding a new destructive cron forces a code
 * review of this file (no magic strings at call sites).
 */
export type DestructiveCronName = "billing" | "gdpr-purge" | "stripe-reconcile" | "dedup-purge";

/**
 * Verify that a destructive cron is permitted to run in the current
 * Worker environment. Call immediately after `verifyCronSecret()` in
 * each destructive cron route handler.
 *
 * - Returns `null` when the cron is allowed to proceed.
 * - Returns a 503 `NextResponse` (and logs an `error`) when blocked.
 *
 * Staging deployments can override on a per-operation basis by setting
 * `ALLOW_STAGING_DESTRUCTIVE_CRONS=true` in the staging Worker secrets.
 * This is intentionally an explicit, audited choice — never a default.
 */
export function assertCronAllowedInThisEnv(name: DestructiveCronName): NextResponse | null {
  const workerEnv = process.env.WORKER_ENV;
  if (workerEnv !== "staging") return null;

  const explicitOptIn = process.env.ALLOW_STAGING_DESTRUCTIVE_CRONS === "true";
  if (explicitOptIn) {
    logger.warn(
      `[cron-env-guard] Destructive cron "${name}" executed in staging with explicit opt-in.`,
      {
        context: "cron-env-guard",
        cron: name,
        workerEnv,
      },
    );
    return null;
  }

  const message =
    `Destructive cron "${name}" was invoked in WORKER_ENV=staging without an explicit ` +
    "opt-in. Set ALLOW_STAGING_DESTRUCTIVE_CRONS=true on the staging Worker if this " +
    "was intentional. This guard prevents staging from corrupting production data when " +
    "Worker secrets accidentally resolve to production credentials.";
  logger.error(message, {
    context: "cron-env-guard",
    cron: name,
    workerEnv,
  });

  return NextResponse.json(
    {
      error: "Destructive cron disabled in staging",
      cron: name,
      hint: "Set ALLOW_STAGING_DESTRUCTIVE_CRONS=true to override.",
    },
    { status: 503 },
  );
}
