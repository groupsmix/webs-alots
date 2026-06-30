/**
 * GET   /api/super-admin/referral-credits  — List pending credits + leaderboard
 * PATCH /api/super-admin/referral-credits  — Approve or reject a credit
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError, apiRateLimited } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { apiMutationLimiter, extractClientIp } from "@/lib/rate-limit";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

const patchSchema = z.object({
  creditId: z.string().uuid("creditId must be a UUID"),
  action: z.enum(["approve", "reject"]),
});

// ─── GET ─────────────────────────────────────────────────────────────────────

async function handleGet(_request: NextRequest, _auth: AuthContext) {
  try {
    // nosemgrep: semgrep.tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    // Fetch pending credits joined with clinic name
    const { data: credits, error: creditsError } = await supabase
      .from("referral_credits")
      .select(
        "id, amount_centimes, currency, payout_type, status, created_at, applied_at, beneficiary_clinic_id, clinics!referral_credits_beneficiary_clinic_id_fkey(name)",
      )
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(200); // nosemgrep: semgrep.tenant-scoping

    if (creditsError) {
      logger.error("Failed to fetch referral credits", {
        context: "referral-credits-api",
        error: creditsError,
      });
      return apiInternalError("Failed to fetch referral credits");
    }

    // Leaderboard: top referrers by signup count
    const { data: leaderboard, error: leaderboardError } = await supabase
      .from("referral_events")
      .select(
        "referrer_clinic_id, event_type, clinics!referral_events_referrer_clinic_id_fkey(name)",
      )
      .eq("event_type", "signup") // nosemgrep: semgrep.tenant-scoping
      .limit(500);

    if (leaderboardError) {
      logger.error("Failed to fetch referral leaderboard", {
        context: "referral-credits-api",
        error: leaderboardError,
      });
      return apiInternalError("Failed to fetch referral leaderboard");
    }

    // Aggregate leaderboard by referrer clinic
    const leaderboardMap: Record<
      string,
      { clinicId: string; clinicName: string; signups: number }
    > = {};

    for (const event of leaderboard ?? []) {
      const cid = event.referrer_clinic_id as string;
      if (!leaderboardMap[cid]) {
        leaderboardMap[cid] = {
          clinicId: cid,
          clinicName:
            (event.clinics as unknown as { name: string } | null)?.name ?? "Unknown Clinic",
          signups: 0,
        };
      }
      leaderboardMap[cid].signups++;
    }

    // Fetch referral codes to enrich leaderboard with code strings
    const referrerIds = Object.keys(leaderboardMap);
    const codeMap: Record<string, string> = {};

    if (referrerIds.length > 0) {
      const { data: codes } = await supabase
        .from("referral_codes")
        .select("clinic_id, code")
        .in("clinic_id", referrerIds) // nosemgrep: semgrep.tenant-scoping
        .eq("is_active", true);

      for (const row of codes ?? []) {
        codeMap[row.clinic_id as string] = row.code as string;
      }
    }

    // Aggregate credits per clinic for total earned
    const creditTotals: Record<string, number> = {};
    for (const credit of credits ?? []) {
      const cid = credit.beneficiary_clinic_id as string;
      creditTotals[cid] = (creditTotals[cid] ?? 0) + (credit.amount_centimes as number);
    }

    const leaderboardRows = Object.values(leaderboardMap)
      .map((row) => ({
        ...row,
        code: codeMap[row.clinicId] ?? null,
        totalCreditsCentimes: creditTotals[row.clinicId] ?? 0,
      }))
      .sort((a, b) => b.signups - a.signups)
      .slice(0, 20);

    // Funnel stats
    const { data: allEvents, error: funnelError } = await supabase
      .from("referral_events")
      .select("event_type"); // nosemgrep: semgrep.tenant-scoping

    if (funnelError) {
      logger.error("Failed to fetch funnel events", {
        context: "referral-credits-api",
        error: funnelError,
      });
      return apiInternalError("Failed to fetch funnel stats");
    }

    const { data: allCodes } = await supabase.from("referral_codes").select("id"); // nosemgrep: semgrep.tenant-scoping

    const totalCodesIssued = (allCodes ?? []).length;
    const totalSignups = (allEvents ?? []).filter(
      (e: { event_type: string }) => e.event_type === "signup",
    ).length;
    const totalFirstPayments = (allEvents ?? []).filter(
      (e: { event_type: string }) => e.event_type === "first_payment",
    ).length;
    const totalRewardsTriggered = (allEvents ?? []).filter(
      (e: { event_type: string }) => e.event_type === "reward_triggered",
    ).length;

    return apiSuccess({
      credits: credits ?? [],
      leaderboard: leaderboardRows,
      funnel: {
        totalCodesIssued,
        totalSignups,
        totalFirstPayments,
        totalRewardsTriggered,
      },
    });
  } catch (err) {
    logger.error("Unexpected error in referral-credits GET", {
      context: "referral-credits-api",
      error: err,
    });
    return apiInternalError("Failed to load referral credits");
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

async function handlePatch(request: NextRequest, auth: AuthContext) {
  // Rate limit mutations
  const clientIp = extractClientIp(request);
  const allowed = await apiMutationLimiter.check(`referral-credits-patch:${clientIp}`);
  if (!allowed) {
    return apiRateLimited("Too many requests. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid request body",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { creditId, action } = parsed.data;
  const newStatus = action === "approve" ? "approved" : "rejected";
  const now = new Date().toISOString();

  try {
    // nosemgrep: semgrep.tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    // Fetch the credit to verify it exists and is pending
    const { data: credit, error: fetchError } = await supabase
      .from("referral_credits")
      .select("id, status, beneficiary_clinic_id, amount_centimes")
      .eq("id", creditId) // nosemgrep: semgrep.tenant-scoping
      .single();

    if (fetchError || !credit) {
      return apiError("Referral credit not found", 404, "NOT_FOUND");
    }

    if (credit.status !== "pending") {
      return apiError(
        `Credit is already ${credit.status as string} and cannot be modified`,
        409,
        "CONFLICT",
      );
    }

    const { error: updateError } = await supabase
      .from("referral_credits")
      .update({
        status: newStatus,
        approved_by: auth.profile.id,
        ...(newStatus === "approved" ? { applied_at: now } : {}),
      })
      .eq("id", creditId); // nosemgrep: semgrep.tenant-scoping

    if (updateError) {
      logger.error("Failed to update referral credit status", {
        context: "referral-credits-api",
        creditId,
        action,
        error: updateError,
      });
      return apiInternalError("Failed to update credit status");
    }

    // Audit log — required for all credit approvals/rejections
    await logAuditEvent({
      supabase: auth.supabase,
      action: `referral_credit_${action}d`,
      type: "admin",
      clinicId: credit.beneficiary_clinic_id as string,
      actor: auth.profile.id,
      description: `Referral credit ${action}d: ${credit.amount_centimes as number} centimes`,
      metadata: {
        creditId,
        action,
        amountCentimes: credit.amount_centimes as number,
        beneficiaryClinicId: credit.beneficiary_clinic_id as string,
      },
    });

    return apiSuccess({ creditId, status: newStatus });
  } catch (err) {
    logger.error("Unexpected error in referral-credits PATCH", {
      context: "referral-credits-api",
      creditId,
      action,
      error: err,
    });
    return apiInternalError("Failed to process credit action");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
