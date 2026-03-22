/**
 * Cron Route — Subscription Billing Renewal
 *
 * Called daily (e.g., via Cloudflare Cron Trigger at 2am UTC) to process
 * subscription renewals for all active clinics.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { processRenewal } from "@/lib/subscription-billing";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Fetch all active subscriptions that may need renewal
  const today = new Date().toISOString().split("T")[0];
  const { data: subscriptions, error } = await supabase
    .from("clinic_subscriptions")
    .select("clinic_id, current_period_end, status")
    .in("status", ["active", "past_due"])
    .lte("current_period_end", today);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch subscriptions", details: error.message },
      { status: 500 },
    );
  }

  const results: { clinicId: string; success: boolean; error?: string }[] = [];
  const BATCH_SIZE = 10;
  const subs = subscriptions ?? [];

  for (let i = 0; i < subs.length; i += BATCH_SIZE) {
    const batch = subs.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((sub) => processRenewal(sub.clinic_id)),
    );
    for (let j = 0; j < batch.length; j++) {
      const outcome = settled[j];
      if (outcome.status === "fulfilled") {
        results.push({
          clinicId: batch[j].clinic_id,
          success: outcome.value.success,
          error: outcome.value.error,
        });
      } else {
        results.push({
          clinicId: batch[j].clinic_id,
          success: false,
          error: outcome.reason instanceof Error ? outcome.reason.message : "Unknown error",
        });
      }
    }
  }

  const renewed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    processed: results.length,
    renewed,
    failed,
    results,
    timestamp: new Date().toISOString(),
  });
}
