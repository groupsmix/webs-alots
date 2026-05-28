/**
 * GET /api/cron/stripe-reconcile
 *
 * BL-002: Daily Stripe payment reconciliation.
 *
 * Compares completed Stripe Checkout Sessions (last 7 days) against the
 * local `payments` table. Any session not matched by `reference` is logged
 * as drift. This catches missed webhooks (Stripe retries for ≤3 days, so
 * 7-day window provides overlap).
 *
 * Drift items are logged at `error` level so Sentry captures them, and
 * they appear in the JSON response for operator dashboards.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError, apiError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";

interface StripeSession {
  id: string;
  payment_status: string;
  metadata: Record<string, string>;
  amount_total: number | null;
  created: number;
}

interface StripeListResponse {
  data: StripeSession[];
  has_more: boolean;
  url: string;
}

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return apiError("STRIPE_SECRET_KEY not configured", 503);
  }

  try {
    const supabase = createAdminClient("cron");
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    // Fetch completed Stripe Checkout Sessions from the last 7 days.
    // Paginate in case there are many sessions.
    const allSessions: StripeSession[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params = new URLSearchParams({
        "created[gte]": sevenDaysAgo.toString(),
        limit: "100",
        status: "complete",
      });
      if (startingAfter) params.set("starting_after", startingAfter);

      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        logger.error("Stripe API error during reconciliation", {
          context: "cron/stripe-reconcile",
          status: res.status,
        });
        return apiInternalError("Stripe API returned an error");
      }

      const body = (await res.json()) as StripeListResponse;
      allSessions.push(...body.data);
      hasMore = body.has_more;
      if (body.data.length > 0) {
        startingAfter = body.data[body.data.length - 1].id;
      }
    }

    if (allSessions.length === 0) {
      return apiSuccess({
        message: "No Stripe sessions in the last 7 days",
        checked: 0,
        drift: 0,
      });
    }

    // Fetch all local payment references for comparison
    const sessionIds = allSessions.map((s) => s.id);
    const { data: localPayments } = await supabase
      .from("payments")
      .select("reference")
      .in("reference", sessionIds);

    const localRefs = new Set((localPayments ?? []).map((p) => p.reference).filter(Boolean));

    // Find drift: Stripe says paid, local DB has no record
    const driftSessions = allSessions.filter(
      (s) => s.payment_status === "paid" && !localRefs.has(s.id),
    );

    for (const drift of driftSessions) {
      logger.error("Stripe payment drift detected — session not in payments table", {
        context: "cron/stripe-reconcile",
        stripeSessionId: drift.id,
        amountTotal: drift.amount_total,
        clinicId: drift.metadata?.clinic_id ?? "unknown",
        created: new Date(drift.created * 1000).toISOString(),
      });
    }

    if (driftSessions.length > 0) {
      logger.warn(`Stripe reconciliation found ${driftSessions.length} unmatched sessions`, {
        context: "cron/stripe-reconcile",
        total: allSessions.length,
        drift: driftSessions.length,
      });
    }

    return apiSuccess({
      message: `Reconciliation complete: ${allSessions.length} checked, ${driftSessions.length} drift`,
      checked: allSessions.length,
      drift: driftSessions.length,
      driftSessionIds: driftSessions.map((s) => s.id),
    });
  } catch (err) {
    logger.error("Stripe reconciliation cron failed", {
      context: "cron/stripe-reconcile",
      error: err,
    });
    return apiInternalError("Failed to reconcile Stripe payments");
  }
}

export const GET = withSentryCron("stripe-reconcile-daily", "0 5 * * *", handler);
