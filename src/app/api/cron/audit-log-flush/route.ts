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

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";
import { isValidClinicId } from "@/lib/tenant-context";
import type { Database, Json } from "@/lib/types/database";

const BATCH_SIZE = 1000;
const MAX_RETRIES = 5;

type PendingAuditLog = Database["public"]["Tables"]["pending_audit_logs"]["Row"];

interface AuditPayload {
  action?: unknown;
  type?: unknown;
  actor?: unknown;
  clinic_id?: unknown;
  clinic_name?: unknown;
  description?: unknown;
  ip_address?: unknown;
  user_agent?: unknown;
  metadata?: unknown;
  timestamp?: unknown;
}

const ACTIVITY_LOG_TYPES = new Set([
  "admin",
  "announcement",
  "auth",
  "billing",
  "booking",
  "clinic",
  "config",
  "feature",
  "patient",
  "payment",
  "security",
  "template",
]);

function parsePayload(payload: Json | null): AuditPayload | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  return payload as AuditPayload;
}

function toString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return null;
}

function toJson(value: unknown): Json | null {
  if (value === null || value === undefined) return null;
  return value as Json;
}

function sanitizeClinicId(value: unknown): string | null {
  const str = toString(value);
  if (!str) return null;
  return isValidClinicId(str) ? str : null;
}

function sanitizeType(value: unknown): string | null {
  const str = toString(value);
  if (!str) return null;
  return ACTIVITY_LOG_TYPES.has(str) ? str : null;
}

async function flushRow(
  admin: SupabaseClient<Database>,
  row: PendingAuditLog,
): Promise<{ flushed: boolean; errorMessage?: string }> {
  const payload = parsePayload(row.payload);

  if (!payload) {
    return { flushed: false, errorMessage: "pending_audit_logs payload is not an object" };
  }

  const type = sanitizeType(payload.type);
  const clinicId = sanitizeClinicId(payload.clinic_id);
  const timestamp = toString(payload.timestamp) ?? row.created_at;

  if (!type) {
    return {
      flushed: false,
      errorMessage: `invalid audit type in payload: ${String(payload.type)}`,
    };
  }

  const { error: insertErr } = await admin.from("activity_logs").insert({
    action: toString(payload.action) ?? "",
    type,
    actor: toString(payload.actor),
    clinic_id: clinicId,
    clinic_name: toString(payload.clinic_name),
    description: toString(payload.description),
    ip_address: toString(payload.ip_address),
    user_agent: toString(payload.user_agent),
    metadata: toJson(payload.metadata),
    timestamp,
  });

  if (insertErr) {
    return { flushed: false, errorMessage: insertErr.message };
  }

  const { error: deleteErr } = await admin.from("pending_audit_logs").delete().eq("id", row.id);
  if (deleteErr) {
    return { flushed: false, errorMessage: deleteErr.message };
  }

  return { flushed: true };
}

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const admin = createAdminClient("cron");
  let flushed = 0;
  let failed = 0;

  const { data: pending, error: fetchErr } = await admin
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
    return apiSuccess({ flushed: 0, failed: 0 });
  }

  for (const row of pending) {
    const result = await flushRow(admin, row);
    if (result.flushed) {
      flushed++;
      continue;
    }

    const newRetryCount = (row.retry_count ?? 0) + 1;
    const lastError = result.errorMessage ?? "unknown flush error";

    const { error: updateErr } = await admin
      .from("pending_audit_logs")
      .update({ retry_count: newRetryCount, last_error: lastError })
      .eq("id", row.id);

    if (updateErr) {
      logger.error("Failed to update pending audit log retry count", {
        context: "cron/audit-log-flush",
        pendingId: row.id,
        error: updateErr.message,
      });
    }

    failed++;

    if (newRetryCount > MAX_RETRIES) {
      logger.error("Pending audit log exceeded max retries", {
        context: "cron/audit-log-flush",
        pendingId: row.id,
        retryCount: newRetryCount,
        lastError,
      });
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(
          new Error(`Pending audit log ${row.id} exceeded ${MAX_RETRIES} retries`),
          {
            tags: { compliance: "audit_log_durability" },
            extra: { pendingId: row.id, retryCount: newRetryCount, lastError },
          },
        );
      } catch {
        // Sentry unavailable
      }
    }
  }

  logger.info("Audit log flush complete", {
    context: "cron/audit-log-flush",
    flushed,
    failed,
    total: pending.length,
  });

  return apiSuccess({ flushed, failed });
}

export const GET = withSentryCron("audit-log-flush", "*/15 * * * *", handler);
