/**
 * M-03/M-04: TTL purge cron for dedup tables.
 *
 * Deletes rows older than 90 days from:
 * - `processed_stripe_events` (migration 00092)
 * - `cmi_callbacks_seen` (migration 00084/00091)
 * - `processed_whatsapp_messages` (migration 00094, R-16)
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
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";

// W8-A75-01: Differentiated retention. Stripe replay window is 30 days;
// CMI callbacks are one-shot but 90 days is kept for forensics.
const STRIPE_RETENTION_DAYS = 30;
const CMI_RETENTION_DAYS = 90;
const WA_RETENTION_DAYS = 30;

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const admin = createAdminClient("cron");
  const stripeCutoff = new Date(
    Date.now() - STRIPE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const cmiCutoff = new Date(Date.now() - CMI_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const waCutoff = new Date(Date.now() - WA_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const results: Record<string, number> = {};

  // Purge processed_stripe_events
  const { count: stripeCount, error: stripeErr } = await admin
    .from("processed_stripe_events")
    .delete({ count: "exact" })
    .lt("processed_at", stripeCutoff);

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
    .lt("seen_at", cmiCutoff);

  if (cmiErr) {
    logger.error("dedup-purge: failed to purge cmi_callbacks_seen", {
      context: "cron/dedup-purge",
      error: cmiErr.message,
    });
  }
  results.cmi_callbacks_seen = cmiCount ?? 0;

  // Purge processed_whatsapp_messages (R-16)
  const { count: waCount, error: waErr } = await admin
    .from("processed_whatsapp_messages")
    .delete({ count: "exact" })
    .lt("processed_at", waCutoff);

  if (waErr) {
    logger.error("dedup-purge: failed to purge processed_whatsapp_messages", {
      context: "cron/dedup-purge",
      error: waErr.message,
    });
  }
  results.processed_whatsapp_messages = waCount ?? 0;

  const total =
    results.processed_stripe_events +
    results.cmi_callbacks_seen +
    results.processed_whatsapp_messages;
  logger.info(`dedup-purge: purged ${total} rows`, {
    context: "cron/dedup-purge",
    ...results,
    stripeRetention: STRIPE_RETENTION_DAYS,
    cmiRetention: CMI_RETENTION_DAYS,
    waRetention: WA_RETENTION_DAYS,
  });

  return NextResponse.json({
    ok: true,
    purged: results,
    retention: {
      stripe: STRIPE_RETENTION_DAYS,
      cmi: CMI_RETENTION_DAYS,
      whatsapp: WA_RETENTION_DAYS,
    },
  });
}

export const GET = withSentryCron("dedup-purge-daily", "0 4 * * *", handler);
