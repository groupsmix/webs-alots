/**
 * Cron Route — Trial Lifecycle Management
 *
 * Runs at 06:30 UTC daily.
 * Two operations:
 *   1. WARN  — Clinics where trial_ends_at is within 3 days and still on trial.
 *              Sends an in-app notification to clinic admins.
 *   2. EXPIRE — Clinics where trial_ends_at < NOW() and still on trial.
 *               Downgrades tier to "free" and logs to subscription_history.
 *
 * Protected by CRON_SECRET bearer token.
 */

import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";

// ── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

function untyped(client: ReturnType<typeof createAdminClient>): AnyClient {
  return client as AnyClient;
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  // nosemgrep: semgrep.tenant-scoping — service-role client for cron, scoped per-clinic below
  const supabase = createAdminClient("cron");

  const now = new Date();
  const nowIso = now.toISOString();

  // 3 days from now, in UTC
  const warnCutoff = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. WARN: trials expiring within 3 days ─────────────────────────────

  // nosemgrep: semgrep.tenant-scoping — intentional cross-tenant query for cron job
  const { data: warnClinics, error: warnError } = await untyped(supabase)
    .from("clinics")
    .select("id, name, tier, trial_ends_at")
    .eq("tier", "trial")
    .gt("trial_ends_at", nowIso) // still active (not expired)
    .lte("trial_ends_at", warnCutoff); // expiring within 3 days

  if (warnError) {
    logger.error("cron/trial-lifecycle: failed to fetch expiring trials", {
      context: "cron/trial-lifecycle",
      error: warnError.message,
    });
    return apiInternalError("Failed to fetch expiring trial clinics");
  }

  let warned = 0;

  for (const clinic of warnClinics ?? []) {
    if (!clinic.id) continue;
    try {
      assertClinicId(clinic.id, "cron/trial-lifecycle:warn");
    } catch {
      logger.warn("cron/trial-lifecycle: invalid clinic id — skipping", {
        context: "cron/trial-lifecycle",
        clinicId: clinic.id,
      });
      continue;
    }

    // Fetch clinic admin users — tenant-scoped
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinic.id) // tenant-scoped
      .eq("role", "clinic_admin");

    if (!admins?.length) continue;

    const daysLeft = Math.ceil(
      (new Date(clinic.trial_ends_at as string).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const title = `Your free trial expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    const body = `${clinic.name ?? clinic.id}: Your Oltigo Health trial ends on ${new Date(clinic.trial_ends_at as string).toLocaleDateString("fr-MA")}. Upgrade now to keep your data and continue using all features.`;

    for (const admin of admins) {
      await untyped(supabase)
        .from("notifications")
        .insert({
          clinic_id: clinic.id,
          user_id: admin.id,
          type: `trial_expiry_warning:${clinic.id}:${new Date(clinic.trial_ends_at as string).toISOString().slice(0, 10)}`,
          channel: "in_app",
          title,
          body,
          is_read: false,
          sent_at: nowIso,
        });
    }

    logger.info("cron/trial-lifecycle: trial expiry warning sent", {
      context: "cron/trial-lifecycle",
      clinicId: clinic.id,
      trialEndsAt: clinic.trial_ends_at,
      daysLeft,
    });

    warned++;
  }

  // ── 2. EXPIRE: trials that have ended ─────────────────────────────────

  // nosemgrep: semgrep.tenant-scoping — intentional cross-tenant query for cron job
  const { data: expiredClinics, error: expiredError } = await untyped(supabase)
    .from("clinics")
    .select("id, name, tier, trial_ends_at")
    .eq("tier", "trial")
    .lt("trial_ends_at", nowIso); // trial_ends_at is in the past

  if (expiredError) {
    logger.error("cron/trial-lifecycle: failed to fetch expired trials", {
      context: "cron/trial-lifecycle",
      error: expiredError.message,
    });
    return apiInternalError("Failed to fetch expired trial clinics");
  }

  let expired = 0;

  for (const clinic of expiredClinics ?? []) {
    if (!clinic.id) continue;
    try {
      assertClinicId(clinic.id, "cron/trial-lifecycle:expire");
    } catch {
      logger.warn("cron/trial-lifecycle: invalid clinic id — skipping expiry", {
        context: "cron/trial-lifecycle",
        clinicId: clinic.id,
      });
      continue;
    }

    try {
      // Downgrade tier to free — scoped to this clinic_id
      const { error: updateError } = await supabase
        .from("clinics")
        .update({ tier: "free" })
        .eq("id", clinic.id); // tenant-scoped

      if (updateError) {
        logger.error("cron/trial-lifecycle: failed to downgrade tier", {
          context: "cron/trial-lifecycle",
          clinicId: clinic.id,
          error: updateError.message,
        });
        continue;
      }

      // Log to subscription_history — always explicit fields, never spread body
      await untyped(supabase)
        .from("subscription_history")
        .insert({
          clinic_id: clinic.id,
          event_type: "trial_expired",
          from_plan_slug: "trial",
          to_plan_slug: "free",
          billing_period: null,
          amount_centimes: 0,
          currency: "MAD",
          notes: `Trial expired on ${nowIso}. Automatically downgraded to free plan.`,
          changed_by: null,
        });

      // Audit log for compliance
      await logAuditEvent({
        supabase,
        action: "trial_expired",
        type: "admin",
        clinicId: clinic.id,
        clinicName: clinic.name ?? clinic.id,
        description: `Trial expired — clinic downgraded from trial to free plan`,
        metadata: { trialEndsAt: clinic.trial_ends_at, downgradedAt: nowIso },
      });

      // Notify clinic admins — tenant-scoped
      const { data: admins } = await supabase
        .from("users")
        .select("id")
        .eq("clinic_id", clinic.id) // tenant-scoped
        .eq("role", "clinic_admin");

      const title = "Your free trial has ended";
      const body = `${clinic.name ?? clinic.id}: Your Oltigo Health trial has expired. Your account has been moved to the free plan. Upgrade to restore full access.`;

      for (const admin of admins ?? []) {
        await untyped(supabase)
          .from("notifications")
          .insert({
            clinic_id: clinic.id,
            user_id: admin.id,
            type: `trial_expired:${clinic.id}`,
            channel: "in_app",
            title,
            body,
            is_read: false,
            sent_at: nowIso,
          });
      }

      logger.info("cron/trial-lifecycle: trial expired and downgraded", {
        context: "cron/trial-lifecycle",
        clinicId: clinic.id,
        trialEndsAt: clinic.trial_ends_at,
      });

      expired++;
    } catch (err) {
      logger.error("cron/trial-lifecycle: unexpected error processing expiry", {
        context: "cron/trial-lifecycle",
        clinicId: clinic.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("cron/trial-lifecycle: completed", {
    context: "cron/trial-lifecycle",
    warned,
    expired,
  });

  return apiSuccess({ warned, expired, timestamp: nowIso });
}

export const GET = withSentryCron("trial-lifecycle", "30 6 * * *", handler);
