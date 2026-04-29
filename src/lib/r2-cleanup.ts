/**
 * R2 cleanup library — reusable primitives for the scheduled job that
 * reconciles the `pending_uploads` tracking table against the contents of
 * the R2 bucket (Task 3.3.2).
 *
 * This module intentionally ships **without any entrypoint** (no route, no
 * cron binding). It exposes pure functions that the future cron handler
 * will call once the orchestration tasks land. Designing the library
 * upfront — with a full unit-test suite and threshold-based alerting —
 * lets us merge the behaviour safely behind feature-less code.
 *
 * ── Failure modes it covers ──
 *   1. **Abandoned uploads** — rows in `pending_uploads` whose
 *      `confirmed_at` is still null after an SLA window (default 24 h).
 *      We delete the object from R2 and prune the tracking row.
 *   2. **Orphan R2 objects** — keys present in the bucket that no row in
 *      `pending_uploads` (pending *or* confirmed) references. Can happen
 *      when a confirmation-route deletion fails or the row insert races
 *      with the browser giving up.
 *
 * ── Alerting ──
 *   After a reconciliation pass we compute `orphans / totalScanned` and,
 *   if it crosses `R2_ORPHAN_RATE_ALERT_THRESHOLD` (default 0.1 = 10 %),
 *   log a structured error and emit a Sentry `captureMessage` so
 *   operations can investigate a leaky upload path rather than letting
 *   the cron quietly delete thousands of objects.
 *
 * The library deliberately takes the Supabase client as a parameter
 * instead of constructing one itself — this mirrors the convention in
 * `audit-log.ts` and keeps the Vitest suite fully mockable without
 * hitting Supabase's singleton caches.
 */

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertClinicId } from "@/lib/assert-tenant";
import { logger } from "@/lib/logger";
import { deleteFromR2, listR2Objects } from "@/lib/r2";

/**
 * Default SLA after which a pending upload is considered abandoned.
 * Matches the R2 lifecycle rule (`docs/r2-lifecycle.md`) so the cron
 * and the bucket policy agree on the same cutoff.
 */
export const DEFAULT_ABANDONED_HOURS = 24;

/**
 * Default threshold for `emitOrphanRateAlert`. A reconciliation pass
 * that classifies ≥ 10 % of scanned keys as orphaned is almost always
 * a code bug, not an operational anomaly — we want a loud alert.
 */
export const DEFAULT_ORPHAN_RATE_THRESHOLD = 0.1;

/**
 * Row shape used by the cleanup library. Mirrors the logical columns of
 * the `pending_uploads` tracking table. Kept as an explicit interface
 * (rather than inferred from the generated `Database` type) so the
 * library is safe to merge before the companion migration lands.
 */
export interface PendingUploadRow {
  id: string;
  clinic_id: string;
  r2_key: string;
  content_type: string | null;
  created_at: string;
  confirmed_at: string | null;
}

/**
 * The cleanup library queries a table that is not part of the generated
 * `Database` type yet (the migration is tracked under Task 3.3.1). We
 * accept any Supabase client and perform narrow type assertions on the
 * query results so the library is typesafe at its public boundary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

/** Resolve the orphan-rate alert threshold from env with safe fallbacks. */
export function readOrphanRateAlertThreshold(): number {
  const raw = process.env.R2_ORPHAN_RATE_ALERT_THRESHOLD;
  if (!raw) return DEFAULT_ORPHAN_RATE_THRESHOLD;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    logger.warn("Ignoring invalid R2_ORPHAN_RATE_ALERT_THRESHOLD, using default", {
      context: "r2-cleanup",
      raw,
      default: DEFAULT_ORPHAN_RATE_THRESHOLD,
    });
    return DEFAULT_ORPHAN_RATE_THRESHOLD;
  }
  return parsed;
}

export interface FindAbandonedOptions {
  /** SLA window; rows older than this with `confirmed_at IS NULL` are abandoned. */
  olderThanHours?: number;
  /** Optional R2 key prefix filter (e.g. `"clinics/{id}/"`). */
  prefix?: string;
  /** Hard cap on rows returned in a single pass (default: 1 000). */
  limit?: number;
}

/**
 * Find pending-upload rows whose confirmation never arrived within the
 * SLA window. Returns rows ordered by creation time so the cron deletes
 * the oldest candidates first.
 *
 * The query is scoped to a single tenant — every cron invocation must
 * iterate over clinics and pass the current `clinicId` (per AGENTS.md
 * tenant-isolation rule 6).
 */
export async function findAbandonedPendingUploads(
  supabase: AnySupabase,
  clinicId: string,
  options: FindAbandonedOptions = {},
): Promise<PendingUploadRow[]> {
  assertClinicId(clinicId, "findAbandonedPendingUploads");

  const {
    olderThanHours = DEFAULT_ABANDONED_HOURS,
    prefix,
    limit = 1000,
  } = options;

  const cutoffIso = new Date(
    Date.now() - olderThanHours * 60 * 60 * 1000,
  ).toISOString();

  let query = supabase
    .from("pending_uploads")
    .select("id, clinic_id, r2_key, content_type, created_at, confirmed_at")
    .eq("clinic_id", clinicId)
    .is("confirmed_at", null)
    .lt("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (prefix) {
    // `like` is intentional — the prefix is a server-chosen constant, never
    // user-controlled, so PostgREST's like syntax is safe here.
    query = query.like("r2_key", `${prefix}%`);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("findAbandonedPendingUploads query failed", {
      context: "r2-cleanup",
      error,
      clinicId,
      olderThanHours,
      prefix,
    });
    throw error;
  }

  return (data ?? []) as PendingUploadRow[];
}

/**
 * Given a batch of R2 keys, return the subset that is NOT referenced by
 * any row in `pending_uploads` (pending or confirmed) for the given
 * tenant. An orphan key is therefore one the application has no record
 * of and is safe to delete.
 *
 * The query is scoped to `clinicId` so a key tracked under one tenant
 * cannot mask an orphan reported by another tenant's reconciliation.
 */
export async function findOrphanKeys(
  supabase: AnySupabase,
  clinicId: string,
  r2Keys: string[],
): Promise<string[]> {
  assertClinicId(clinicId, "findOrphanKeys");

  if (r2Keys.length === 0) return [];

  // De-duplicate input so the `in()` filter stays within PostgREST's
  // practical limit and we don't over-report orphans when callers pass
  // duplicate keys (rare, but cheap to defend against).
  const uniqueKeys = Array.from(new Set(r2Keys));

  const { data, error } = await supabase
    .from("pending_uploads")
    .select("r2_key")
    .eq("clinic_id", clinicId)
    .in("r2_key", uniqueKeys);

  if (error) {
    logger.error("findOrphanKeys query failed", {
      context: "r2-cleanup",
      error,
      clinicId,
      keyCount: uniqueKeys.length,
    });
    throw error;
  }

  const known = new Set<string>(
    ((data ?? []) as { r2_key: string }[]).map((row) => row.r2_key),
  );

  return uniqueKeys.filter((key) => !known.has(key));
}

export interface CleanupAbandonedResult {
  /** Rows matched by the abandoned-pending query. */
  scanned: number;
  /** Objects successfully removed from R2 during this pass. */
  deletedFromR2: number;
  /** Rows deleted from `pending_uploads` after a successful R2 delete. */
  removedFromDb: number;
  /** Failures encountered while deleting the R2 object or DB row. */
  errors: Array<{ key: string; stage: "r2" | "db"; error: unknown }>;
  /** Echoed from the caller so downstream log pipelines can filter. */
  dryRun: boolean;
}

export interface CleanupAbandonedOptions extends FindAbandonedOptions {
  /** When true, logs the would-be deletions without mutating state. */
  dryRun?: boolean;
}

/**
 * Delete abandoned pending uploads from R2 and prune the tracking rows.
 * Errors are collected per-key and returned — a transient R2 outage on
 * one object must not abort the rest of the pass.
 *
 * Scoped to a single tenant: the SELECT and the row DELETE both filter
 * on `clinic_id` so a buggy caller cannot accidentally fan out across
 * the bucket.
 */
export async function cleanupAbandonedUploads(
  supabase: AnySupabase,
  clinicId: string,
  options: CleanupAbandonedOptions = {},
): Promise<CleanupAbandonedResult> {
  assertClinicId(clinicId, "cleanupAbandonedUploads");

  const dryRun = options.dryRun ?? false;
  const abandoned = await findAbandonedPendingUploads(supabase, clinicId, options);

  const errors: CleanupAbandonedResult["errors"] = [];
  let deletedFromR2 = 0;
  let removedFromDb = 0;

  for (const row of abandoned) {
    if (dryRun) continue;

    try {
      await deleteFromR2(row.r2_key);
      deletedFromR2++;
    } catch (err) {
      errors.push({ key: row.r2_key, stage: "r2", error: err });
      logger.warn("R2 delete failed during abandoned-upload cleanup", {
        context: "r2-cleanup",
        clinicId,
        key: row.r2_key,
        error: err,
      });
      continue;
    }

    const { error: deleteError } = await supabase
      .from("pending_uploads")
      .delete()
      .eq("clinic_id", clinicId)
      .eq("id", row.id);

    if (deleteError) {
      errors.push({ key: row.r2_key, stage: "db", error: deleteError });
      logger.warn("pending_uploads row delete failed after R2 delete", {
        context: "r2-cleanup",
        clinicId,
        key: row.r2_key,
        id: row.id,
        error: deleteError,
      });
    } else {
      removedFromDb++;
    }
  }

  logger.info("cleanupAbandonedUploads pass complete", {
    context: "r2-cleanup",
    clinicId,
    scanned: abandoned.length,
    deletedFromR2,
    removedFromDb,
    errorCount: errors.length,
    dryRun,
  });

  return {
    scanned: abandoned.length,
    deletedFromR2,
    removedFromDb,
    errors,
    dryRun,
  };
}

export interface ReconcileOrphansOptions {
  /** R2 key prefix to enumerate (e.g. `"clinics/"`). */
  prefix: string;
  /** When true, logs the would-be deletions without mutating state. */
  dryRun?: boolean;
  /** Override the env-derived alert threshold (mostly for tests). */
  alertThreshold?: number;
  /**
   * Optional cap on keys scanned in a single pass. Useful when the cron
   * wants to bound how much work happens per invocation.
   */
  limit?: number;
}

export interface ReconcileOrphansResult {
  /** Total keys returned by `listR2Objects`. */
  scanned: number;
  /** Keys with no row in `pending_uploads`. */
  orphans: number;
  /** Orphans successfully removed from R2. */
  deletedFromR2: number;
  /** `orphans / scanned`; `0` when `scanned === 0`. */
  orphanRate: number;
  /** Whether `emitOrphanRateAlert` fired. */
  alerted: boolean;
  /** Echoed from caller — useful for log correlation. */
  dryRun: boolean;
  /** Per-key R2 delete failures. */
  errors: Array<{ key: string; error: unknown }>;
}

/**
 * Enumerate objects under the configured R2 prefix, classify any key
 * that is not tracked in `pending_uploads` as an orphan, delete those
 * objects (unless `dryRun`), and fire the alerting hook when the orphan
 * rate crosses the configured threshold.
 *
 * Scoped to a single tenant: callers (the future cron) iterate clinics
 * and pass the current `clinicId`, which is forwarded to
 * `findOrphanKeys` so the DB lookup that classifies orphans cannot see
 * across tenants.
 */
export async function reconcileOrphans(
  supabase: AnySupabase,
  clinicId: string,
  options: ReconcileOrphansOptions,
): Promise<ReconcileOrphansResult> {
  assertClinicId(clinicId, "reconcileOrphans");

  const {
    prefix,
    dryRun = false,
    alertThreshold = readOrphanRateAlertThreshold(),
    limit,
  } = options;

  const keys = await listR2Objects(prefix, limit != null ? { limit } : undefined);
  const orphanKeys = await findOrphanKeys(supabase, clinicId, keys);

  const errors: ReconcileOrphansResult["errors"] = [];
  let deletedFromR2 = 0;

  if (!dryRun) {
    for (const key of orphanKeys) {
      try {
        await deleteFromR2(key);
        deletedFromR2++;
      } catch (err) {
        errors.push({ key, error: err });
        logger.warn("R2 delete failed during orphan reconciliation", {
          context: "r2-cleanup",
          clinicId,
          key,
          error: err,
        });
      }
    }
  }

  const alerted = emitOrphanRateAlert({
    orphanCount: orphanKeys.length,
    totalCount: keys.length,
    threshold: alertThreshold,
    prefix,
  });

  const orphanRate = keys.length === 0 ? 0 : orphanKeys.length / keys.length;

  logger.info("reconcileOrphans pass complete", {
    context: "r2-cleanup",
    clinicId,
    prefix,
    scanned: keys.length,
    orphans: orphanKeys.length,
    deletedFromR2,
    orphanRate,
    alerted,
    dryRun,
    errorCount: errors.length,
  });

  return {
    scanned: keys.length,
    orphans: orphanKeys.length,
    deletedFromR2,
    orphanRate,
    alerted,
    dryRun,
    errors,
  };
}

export interface EmitOrphanRateAlertArgs {
  orphanCount: number;
  totalCount: number;
  /** Override the env-derived threshold (mostly for tests). */
  threshold?: number;
  /** Prefix being reconciled — surfaced as a Sentry tag. */
  prefix?: string;
}

/**
 * Alerting hook called from `reconcileOrphans`. Returns `true` if the
 * alert fired so callers can include it in their structured result.
 *
 * The function intentionally logs via `logger.error` (not `warn`) so
 * that Datadog / LogTail alarms on error-level log lines catch this
 * even when Sentry is unreachable.
 */
export function emitOrphanRateAlert(args: EmitOrphanRateAlertArgs): boolean {
  const { orphanCount, totalCount, prefix } = args;
  const threshold = args.threshold ?? readOrphanRateAlertThreshold();

  if (totalCount <= 0) return false;
  const orphanRate = orphanCount / totalCount;
  if (orphanRate < threshold) return false;

  logger.error("R2 orphan rate exceeded threshold", {
    context: "r2-cleanup",
    orphanCount,
    totalCount,
    orphanRate,
    threshold,
    prefix,
    tags: { alert: "r2_orphan_rate" },
  });

  try {
    Sentry.captureMessage("R2 orphan rate exceeded threshold", {
      level: "warning",
      tags: {
        alert: "r2_orphan_rate",
        prefix: prefix ?? "unknown",
      },
      extra: {
        orphanCount,
        totalCount,
        orphanRate,
        threshold,
        prefix,
      },
    });
  } catch {
    // Sentry unavailable — the structured logger.error above is the
    // durable signal, so swallowing is safe.
  }

  return true;
}
