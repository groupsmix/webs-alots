/**
 * Audit Archive Cron — drains audit_archive_queue to Cloudflare R2
 * with Object Lock enabled (WORM).
 *
 * F-A188: Implements tamper-evident audit trail per Moroccan Law 09-08.
 *
 * Schedule: Every 5 minutes via Cloudflare Cron Triggers.
 * Configure in wrangler.toml:
 *   [[triggers.crons]]
 *   crons = ["*\/5 * * * *"]
 *
 * The handler is registered in src/app/api/cron/audit-archive/route.ts.
 *
 * R2 object key format:
 *   audit/{YYYY}/{MM}/{DD}/{clinicId}/{sourceId}.json
 *
 * Each object is a JSON-serialized audit_archive_queue row.
 * Once written, the R2 object is protected by Object Lock (Governance mode,
 * 7-year retention) — it cannot be overwritten or deleted without the
 * Lock-Override permission, which no production principal holds.
 */

import { createAdminClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

/** Maximum rows to drain per invocation (prevents timeout). */
const BATCH_SIZE = 100;

/** R2 bucket binding name (configured in wrangler.toml). */
const R2_BUCKET_NAME = "AUDIT_WORM_BUCKET";

interface ArchiveQueueRow {
  id: number;
  source_id: string;
  clinic_id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * Build the R2 object key for an archive row.
 * Format: audit/YYYY/MM/DD/{clinic_id}/{source_id}.json
 */
function buildR2Key(row: ArchiveQueueRow): string {
  const d = new Date(row.created_at);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `audit/${yyyy}/${mm}/${dd}/${row.clinic_id}/${row.source_id}.json`;
}

/**
 * Drain unarchived rows from audit_archive_queue to R2.
 * Returns the count of successfully archived rows.
 */
export async function drainAuditQueue(): Promise<number> {
  const supabase = createAdminClient();

  // Fetch a batch of unarchived rows, ordered oldest-first
  // Use the untyped client because audit_archive_queue is not in generated types yet
  type QueueClient = {
    from(t: string): {
      select(cols: string): {
        is(col: string, val: null): {
          order(col: string, opts: { ascending: boolean }): {
            limit(n: number): Promise<{ data: ArchiveQueueRow[] | null; error: unknown }>;
          };
        };
      };
      update(data: Record<string, unknown>): {
        eq(col: string, val: number): Promise<{ error: unknown }>;
      };
    };
  };

  const client = supabase as unknown as QueueClient;

  const { data: rows, error } = await client
    .from("audit_archive_queue")
    .select("id, source_id, clinic_id, action, payload, created_at")
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error || !rows || rows.length === 0) {
    if (error) {
      logger.error("Failed to fetch audit_archive_queue rows", {
        context: "audit-archive-cron",
        error,
      });
    }
    return 0;
  }

  // Get the R2 bucket from the Cloudflare environment
  // In Workers, env bindings are injected at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bucket: { put(key: string, body: string, opts: Record<string, unknown>): Promise<void> } | undefined =
    (globalThis as Record<string, unknown>)[R2_BUCKET_NAME] as typeof bucket | undefined;

  if (!bucket) {
    logger.error("AUDIT_WORM_BUCKET R2 binding not available — is it configured in wrangler.toml?", {
      context: "audit-archive-cron",
    });
    return 0;
  }

  let archived = 0;

  for (const row of rows) {
    const key = buildR2Key(row);
    const body = JSON.stringify({
      ...row,
      _archive_written_at: new Date().toISOString(),
      _worm: true,
    });

    try {
      // Write to R2 with Object Lock metadata
      // The actual Object Lock retention is enforced at the bucket level;
      // this header is belt-and-suspenders for auditors reading the object.
      await bucket.put(key, body, {
        httpMetadata: {
          contentType: "application/json",
        },
        customMetadata: {
          "x-oltigo-worm": "true",
          "x-oltigo-retention-years": "7",
          "x-oltigo-clinic-id": row.clinic_id,
          "x-oltigo-action": row.action,
        },
      });

      // Mark as archived in the queue
      const { error: updateError } = await client
        .from("audit_archive_queue")
        .update({
          archived_at: new Date().toISOString(),
          r2_key: key,
        })
        .eq("id", row.id);

      if (updateError) {
        logger.error("Failed to mark audit row as archived", {
          context: "audit-archive-cron",
          queueId: row.id,
          r2Key: key,
          error: updateError,
        });
        // Don't count this row — it'll be retried next invocation
        continue;
      }

      archived++;
    } catch (writeError) {
      logger.error("Failed to write audit row to R2", {
        context: "audit-archive-cron",
        queueId: row.id,
        r2Key: key,
        error: writeError,
      });
      // Continue — failed rows will be retried on next invocation
    }
  }

  logger.info("Audit archive drain complete", {
    context: "audit-archive-cron",
    processed: rows.length,
    archived,
    skipped: rows.length - archived,
  });

  return archived;
}
