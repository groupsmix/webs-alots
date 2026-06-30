/**
 * Usage overage alert system.
 *
 * Sends in-app notifications when a clinic reaches 80% or 100% of their
 * plan limits for whatsapp messages, AI token calls, and monthly appointments.
 *
 * Also provides snapshotDailyUsage() which writes a daily aggregate row to
 * the usage_snapshots table for historical trend analysis.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { getQuotaLimits } from "@/lib/quota-enforcement";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-billing";
import { getMonthlyUnitCount } from "@/lib/tenant-metering";

// ── Types ────────────────────────────────────────────────────────────────────

export type AlertThreshold = 80 | 100;

interface UsageCheck {
  key: string;
  label: string;
  current: number;
  limit: number;
  templateAt80: string;
  templateAt100: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a clinic tier string to a QuotaPlan key. */
function normalizeTier(tier: string): "free" | "starter" | "professional" | "enterprise" {
  const t = (tier ?? "free").toLowerCase().trim();
  if (t === "free" || t === "starter" || t === "professional" || t === "enterprise") {
    return t;
  }
  // trial or unknown → treat as free (safe default)
  return "free";
}

/** Return YYYY-MM string for the current UTC month (used as dedup key). */
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Build the notification type string that encodes the alert identity.
 * Stored in the `type` column of the notifications table for deduplication.
 */
function alertTypeKey(clinicId: string, resourceKey: string, threshold: AlertThreshold): string {
  return `usage_alert:${clinicId}:${resourceKey}:${threshold}:${currentMonthKey()}`;
}

/** Cast the Supabase client to any so we can query tables not in the Database type schema. */
function untyped(client: SupabaseClient): AnyClient {
  return client as AnyClient;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check a clinic's usage against its plan limits and send in-app notifications
 * when the clinic is at 80% or 100% of a resource limit.
 *
 * Deduplication: each (clinic, resource, threshold, month) combination triggers
 * at most one notification row per calendar month. The dedup key is stored in
 * the `type` column of the notifications table.
 *
 * @returns Number of new alert notifications inserted.
 */
export async function checkAndSendUsageAlerts(
  supabase: SupabaseClient,
  clinicId: string,
  clinicName: string,
): Promise<{ alertsSent: number }> {
  let alertsSent = 0;

  // 1. Fetch clinic tier — scoped to this clinic
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("tier")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) {
    logger.error("usage-alerts: failed to fetch clinic tier", {
      context: "usage-alerts",
      clinicId,
      error: clinicError?.message,
    });
    return { alertsSent: 0 };
  }

  const tier = normalizeTier((clinic as { tier: string }).tier ?? "free");
  const quotaLimits = getQuotaLimits(tier);
  const planConfig = SUBSCRIPTION_PLANS.find((p) => p.id === tier) ?? SUBSCRIPTION_PLANS[0];

  // 2. Measure current month usage for monitored resources
  const [whatsappCurrent, aiTokensCurrent] = await Promise.all([
    getMonthlyUnitCount(supabase, clinicId, "whatsapp"),
    getMonthlyUnitCount(supabase, clinicId, "ai_tokens"),
  ]);

  // Count appointments this month — tenant-scoped
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const { count: apptCount } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId) // tenant-scoped
    .gte("appointment_date", monthStart);

  const appointmentsCurrent = apptCount ?? 0;

  // 3. Build checks array
  const checks: UsageCheck[] = [
    {
      key: "whatsapp",
      label: "WhatsApp messages",
      current: whatsappCurrent,
      limit: quotaLimits.whatsapp,
      templateAt80: `${clinicName}: You've used 80% of your monthly WhatsApp quota (${whatsappCurrent}/${quotaLimits.whatsapp}). Upgrade your plan to avoid service interruption.`,
      templateAt100: `${clinicName}: You've reached 100% of your monthly WhatsApp quota (${whatsappCurrent}/${quotaLimits.whatsapp}). WhatsApp messaging is now paused until next month or you upgrade.`,
    },
    {
      key: "ai_tokens",
      label: "AI tokens",
      current: aiTokensCurrent,
      limit: quotaLimits.ai_tokens,
      templateAt80: `${clinicName}: You've used 80% of your monthly AI token quota (${aiTokensCurrent}/${quotaLimits.ai_tokens}). Upgrade your plan to continue using AI features.`,
      templateAt100: `${clinicName}: You've reached 100% of your monthly AI token quota. AI features are paused until next month or you upgrade.`,
    },
    {
      key: "appointments",
      label: "Monthly appointments",
      current: appointmentsCurrent,
      limit: planConfig.maxAppointmentsPerMonth,
      templateAt80: `${clinicName}: You've used 80% of your monthly appointment quota (${appointmentsCurrent}/${planConfig.maxAppointmentsPerMonth}). Upgrade your plan to book more appointments.`,
      templateAt100: `${clinicName}: You've reached 100% of your monthly appointment quota. New appointments are blocked until next month or you upgrade.`,
    },
  ];

  // 4. Get clinic admin users to notify — tenant-scoped
  const { data: admins, error: adminsError } = await supabase
    .from("users")
    .select("id")
    .eq("clinic_id", clinicId) // tenant-scoped
    .eq("role", "clinic_admin");

  if (adminsError) {
    logger.error("usage-alerts: failed to fetch clinic admins", {
      context: "usage-alerts",
      clinicId,
      error: adminsError.message,
    });
    return { alertsSent: 0 };
  }

  const adminIds = ((admins ?? []) as Array<{ id: string }>).map((a) => a.id);
  if (adminIds.length === 0) {
    logger.warn("usage-alerts: no clinic admins found — skipping alerts", {
      context: "usage-alerts",
      clinicId,
    });
    return { alertsSent: 0 };
  }

  // 5. For each check, determine threshold and send if not already sent
  const sentAt = new Date().toISOString();
  const monthStartTs = new Date();
  monthStartTs.setUTCDate(1);
  monthStartTs.setUTCHours(0, 0, 0, 0);

  for (const check of checks) {
    // Skip unlimited resources (-1) or zero-quota plans (no limit configured)
    if (check.limit <= 0) continue;

    const ratio = check.current / check.limit;
    if (ratio < 0.8) continue;

    const threshold: AlertThreshold = ratio >= 1 ? 100 : 80;
    const typeKey = alertTypeKey(clinicId, check.key, threshold);

    // Check dedup: has an alert already been sent this month for this resource+threshold?
    // Uses type column which encodes the full dedup identity.
    // nosemgrep: semgrep.tenant-scoping — notifications already scoped via typeKey which includes clinicId
    const { data: existing } = await untyped(supabase)
      .from("notifications")
      .select("id")
      .eq("type", typeKey)
      .gte("sent_at", monthStartTs.toISOString())
      .limit(1);

    if (existing && (existing as unknown[]).length > 0) {
      // Alert already sent this month for this resource + threshold
      continue;
    }

    const message = threshold === 100 ? check.templateAt100 : check.templateAt80;
    const title =
      threshold === 100
        ? `\u26a0\ufe0f Usage limit reached: ${check.label}`
        : `\ud83d\udcca Usage warning: ${check.label} at 80%`;

    // Insert a notification row for each clinic admin
    for (const adminId of adminIds) {
      const { error: insertError } = await untyped(supabase).from("notifications").insert({
        clinic_id: clinicId,
        user_id: adminId,
        // type encodes dedup key: usage_alert:clinicId:resource:threshold:YYYY-MM
        type: typeKey,
        channel: "in_app",
        title,
        body: message,
        is_read: false,
        sent_at: sentAt,
      });

      if (insertError) {
        logger.error("usage-alerts: failed to insert notification", {
          context: "usage-alerts",
          clinicId,
          adminId,
          resourceKey: check.key,
          threshold,
          error: (insertError as { message: string }).message,
        });
      } else {
        alertsSent++;
      }
    }

    logger.info("usage-alerts: alert sent", {
      context: "usage-alerts",
      clinicId,
      resourceKey: check.key,
      threshold,
      current: check.current,
      limit: check.limit,
    });
  }

  return { alertsSent };
}

/**
 * Snapshot a clinic's daily usage into the usage_snapshots table.
 *
 * Collects counts from appointments, tenant_usage_log, ai_cost_log, and users
 * for the given date, then upserts a single row into usage_snapshots.
 *
 * @param supabase - Admin Supabase client (bypasses RLS for cross-table reads)
 * @param clinicId - Clinic to snapshot
 * @param dateStr  - Date to snapshot in YYYY-MM-DD format
 */
export async function snapshotDailyUsage(
  supabase: SupabaseClient,
  clinicId: string,
  dateStr: string, // YYYY-MM-DD
): Promise<void> {
  // Build UTC timestamp range for the date
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const nextDate = new Date(`${dateStr}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const dayEnd = nextDate.toISOString();

  // Run all count/select queries in parallel — all scoped to this clinic_id
  const [apptResult, whatsappResult, storageResult, doctorResult] = await Promise.all([
    // Appointments for this date — tenant-scoped
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId) // tenant-scoped
      .eq("appointment_date", dateStr),

    // WhatsApp messages sent on this date — tenant-scoped
    supabase
      .from("tenant_usage_log")
      .select("unit_count")
      .eq("clinic_id", clinicId) // tenant-scoped
      .eq("resource_type", "whatsapp")
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),

    // R2 storage bytes delta for this date — tenant-scoped
    supabase
      .from("tenant_usage_log")
      .select("unit_count")
      .eq("clinic_id", clinicId) // tenant-scoped
      .eq("resource_type", "r2_storage")
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),

    // Active doctors (point-in-time count) — tenant-scoped
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId) // tenant-scoped
      .eq("role", "doctor"),
  ]);

  // AI calls on this date — counted from ai_traces (clinic-scoped, written by
  // the AI router on every request). AUDIT P1-7: previously this counted
  // ai_cost_log, a table that was NEVER written to (its logAICost helper had
  // zero callers), so AI usage in snapshots was always zero.
  const aiResult = (await untyped(supabase)
    .from("ai_traces")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId) // tenant-scoped
    .gte("created_at", dayStart)
    .lt("created_at", dayEnd)) as { count: number | null; error: { message: string } | null };

  if (aiResult.error) {
    logger.warn("usage-alerts: failed to count AI calls for snapshot", {
      context: "usage-alerts",
      clinicId,
      dateStr,
      error: aiResult.error.message,
    });
  }

  // Aggregate unit_count rows into sums
  const whatsappSent = ((whatsappResult.data ?? []) as Array<{ unit_count: number | null }>).reduce(
    (sum, row) => sum + (Number(row.unit_count) || 0),
    0,
  );
  const storageBytes = ((storageResult.data ?? []) as Array<{ unit_count: number | null }>).reduce(
    (sum, row) => sum + (Number(row.unit_count) || 0),
    0,
  );

  const row = {
    clinic_id: clinicId,
    snapshot_date: dateStr,
    appointments_count: apptResult.count ?? 0,
    whatsapp_sent: whatsappSent,
    ai_calls: aiResult.count ?? 0,
    storage_bytes: storageBytes,
    active_doctors: doctorResult.count ?? 0,
  };

  // Upsert — idempotent if the cron fires more than once for the same date
  const { error: upsertError } = await untyped(supabase)
    .from("usage_snapshots")
    .upsert(row, { onConflict: "clinic_id,snapshot_date" });

  if (upsertError) {
    logger.error("usage-alerts: failed to upsert usage snapshot", {
      context: "usage-alerts",
      clinicId,
      dateStr,
      error: (upsertError as { message: string }).message,
    });
  } else {
    logger.debug("usage-alerts: snapshot saved", {
      context: "usage-alerts",
      clinicId,
      dateStr,
      appointments: row.appointments_count,
      whatsapp: row.whatsapp_sent,
      aiCalls: row.ai_calls,
    });
  }
}
