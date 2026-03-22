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
      { error: "Failed to fetch subscriptions" },
      { status: 500 },
    );
  }

  const results: { clinicId: string; success: boolean; error?: string }[] = [];
  const subs = subscriptions ?? [];

  // Process all renewals concurrently with a concurrency limit to avoid
  // overwhelming the database while still being faster than sequential batches.
  const CONCURRENCY = 10;
  const queue = [...subs];

  async function worker() {
    while (queue.length > 0) {
      const sub = queue.shift();
      if (!sub) break;
      try {
        const result = await processRenewal(sub.clinic_id);
        results.push({
          clinicId: sub.clinic_id,
          success: result.success,
          error: result.error,
        });
      } catch (err) {
        results.push({
          clinicId: sub.clinic_id,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  // Spawn workers up to the concurrency limit
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, subs.length) }, () => worker()));

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
