/**
 * MEDIUM-6: Audit-log flush cron.
 *
 * Drains `pending_audit_logs` (migration 00089) by re-inserting rows
 * into `activity_logs`. On success the pending row is deleted; on
 * failure `retry_count` is incremented and `last_error` is written.
 * After 5 retries Sentry is alerted.
 *
 * Schedule: every 15 minutes (same as notifications).
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";

const BATCH_SIZE = 1000;
const MAX_RETRIES = 5;

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const admin = createAdminClient("cron");
  let flushed = 0;
  let failed = 0;

  const { data: pending, error: fetchErr } = await (
    admin as never as {
      from(t: string): {
        select(cols: string): {
          order(
            col: string,
            opts: { ascending: boolean },
          ): {
            limit(n: number): Promise<{
              data: Array<{
                id: string;
                event_type: string;
                actor_id: string | null;
                clinic_id: string | null;
                entity_type: string | null;
                entity_id: string | null;
                metadata: Record<string, unknown> | null;
                ip_address: string | null;
                user_agent: string | null;
                retry_count: number;
                created_at: string;
              }> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("pending_audit_logs")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr || !pending || pending.length === 0) {
    if (fetchErr) {
      logger.error("Failed to fetch pending audit logs", {
        context: "cron/audit-log-flush",
        error: fetchErr.message,
      });
    }
    return NextResponse.json({ ok: true, flushed: 0, failed: 0 });
  }

  for (const row of pending) {
    const untypedAdmin = admin as never as {
      from(t: string): {
        insert(r: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
        delete(): {
          eq(col: string, val: string): Promise<{ error: { message: string } | null }>;
        };
        update(r: Record<string, unknown>): {
          eq(col: string, val: string): Promise<{ error: { message: string } | null }>;
        };
      };
    };

    const { error: insertErr } = await untypedAdmin.from("activity_logs").insert({
      event_type: row.event_type,
      actor_id: row.actor_id,
      clinic_id: row.clinic_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      metadata: row.metadata,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
    });

    if (!insertErr) {
      await untypedAdmin.from("pending_audit_logs").delete().eq("id", row.id);
      flushed++;
    } else {
      const newRetryCount = (row.retry_count ?? 0) + 1;
      await untypedAdmin
        .from("pending_audit_logs")
        .update({
          retry_count: newRetryCount,
          last_error: insertErr.message,
        })
        .eq("id", row.id);

      failed++;

      if (newRetryCount > MAX_RETRIES) {
        logger.error("Pending audit log exceeded max retries", {
          context: "cron/audit-log-flush",
          pendingId: row.id,
          retryCount: newRetryCount,
          lastError: insertErr.message,
        });
        try {
          const Sentry = await import("@sentry/nextjs");
          Sentry.captureException(
            new Error(`Pending audit log ${row.id} exceeded ${MAX_RETRIES} retries`),
            {
              tags: { compliance: "audit_log_durability" },
              extra: { pendingId: row.id, retryCount: newRetryCount, lastError: insertErr.message },
            },
          );
        } catch {
          // Sentry unavailable
        }
      }
    }
  }

  logger.info("Audit log flush complete", {
    context: "cron/audit-log-flush",
    flushed,
    failed,
    total: pending.length,
  });

  return NextResponse.json({ ok: true, flushed, failed });
}
