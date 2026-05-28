/**
 * M-03/M-04: TTL purge cron for dedup tables.
 *
 * Deletes rows older than 90 days from:
 * - `processed_stripe_events` (migration 00092)
 * - `cmi_callbacks_seen` (migration 00084/00091)
 *
 * These tables grow unbounded without purging. The 90-day window is
 * generous — Stripe webhook replay is at most 30 days, and CMI
 * callbacks are one-shot. Keeping 90 days aids forensics.
 *
 * Schedule: daily at 04:00 UTC (between gdpr-purge and stripe-reconcile).
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";

const RETENTION_DAYS = 90;

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const admin = createAdminClient("cron");
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const results: Record<string, number> = {};

  // Purge processed_stripe_events
  const { count: stripeCount, error: stripeErr } = await admin
    .from("processed_stripe_events")
    .delete({ count: "exact" })
    .lt("processed_at", cutoff);

  if (stripeErr) {
    logger.error("dedup-purge: failed to purge processed_stripe_events", {
      context: "cron/dedup-purge",
      error: stripeErr.message,
    });
  }
  results.processed_stripe_events = stripeCount ?? 0;

  // Purge cmi_callbacks_seen
  const { count: cmiCount, error: cmiErr } = await admin
    .from("cmi_callbacks_seen")
    .delete({ count: "exact" })
    .lt("seen_at", cutoff);

  if (cmiErr) {
    logger.error("dedup-purge: failed to purge cmi_callbacks_seen", {
      context: "cron/dedup-purge",
      error: cmiErr.message,
    });
  }
  results.cmi_callbacks_seen = cmiCount ?? 0;

  const total = results.processed_stripe_events + results.cmi_callbacks_seen;
  logger.info(`dedup-purge: purged ${total} rows older than ${RETENTION_DAYS} days`, {
    context: "cron/dedup-purge",
    ...results,
  });

  return NextResponse.json({ ok: true, purged: results, cutoff, retentionDays: RETENTION_DAYS });
}
