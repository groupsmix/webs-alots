/**
 * GET  /api/admin/referral-program  — Get or create referral code + stats
 * POST /api/admin/referral-program  — Apply a referral code { action: "apply", code: string }
 *
 * Requires clinic_admin role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError, apiRateLimited } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { apiMutationLimiter, extractClientIp } from "@/lib/rate-limit";
import {
  getOrCreateReferralCode,
  applyReferralCode,
} from "@/lib/referral-program";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["clinic_admin"];

// POST body schema
const applyCodeSchema = z.object({
  action: z.literal("apply"),
  code: z.string().min(1).max(50),
});

// ─── GET ─────────────────────────────────────────────────────────────────────

async function handleGet(_request: NextRequest, auth: AuthContext) {
  const { profile } = auth;
  const clinicId = profile.clinic_id;

  if (!clinicId) {
    return apiError("No clinic associated with this account", 400, "NO_CLINIC");
  }

  try {
    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    const referralData = await getOrCreateReferralCode(supabase, clinicId, profile.id);

    // Fetch event counts scoped to this clinic
    const { data: events, error: eventsError } = await supabase
      .from("referral_events")
      .select("event_type")
      .eq("referrer_clinic_id", clinicId); // nosemgrep: semgrep.tenant-scoping

    if (eventsError) {
      logger.error("Failed to fetch referral events", {
        context: "referral-program-api",
        clinicId,
        error: eventsError,
      });
      return apiInternalError("Failed to fetch referral stats");
    }

    const signups = (events ?? []).filter((e: { event_type: string }) => e.event_type === "signup")
      .length;
    const firstPayments = (events ?? []).filter(
      (e: { event_type: string }) => e.event_type === "first_payment",
    ).length;

    // Fetch credits scoped to this clinic
    const { data: credits, error: creditsError } = await supabase
      .from("referral_credits")
      .select("id, amount_centimes, currency, payout_type, status, created_at")
      .eq("beneficiary_clinic_id", clinicId) // nosemgrep: semgrep.tenant-scoping
      .order("created_at", { ascending: false });

    if (creditsError) {
      logger.error("Failed to fetch referral credits", {
        context: "referral-program-api",
        clinicId,
        error: creditsError,
      });
      return apiInternalError("Failed to fetch referral credits");
    }

    // nosemgrep: semgrep.env-access
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const referralUrl = `${siteUrl}/register?ref=${referralData.code}`;

    return apiSuccess({
      code: referralData.code,
      codeId: referralData.id,
      discountPct: referralData.discountPct,
      discountMonths: referralData.discountMonths,
      referralUrl,
      stats: {
        signups,
        firstPayments,
      },
      credits: credits ?? [],
    });
  } catch (err) {
    logger.error("Unexpected error in referral-program GET", {
      context: "referral-program-api",
      clinicId,
      error: err,
    });
    return apiInternalError("Failed to load referral program data");
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

async function handlePost(request: NextRequest, auth: AuthContext) {
  const { profile } = auth;
  const clinicId = profile.clinic_id;

  if (!clinicId) {
    return apiError("No clinic associated with this account", 400, "NO_CLINIC");
  }

  // Rate limit mutations
  const clientIp = extractClientIp(request);
  const allowed = await apiMutationLimiter.check(`referral-apply:${clientIp}`);
  if (!allowed) {
    return apiRateLimited("Too many requests. Please try again later.");
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const parsed = applyCodeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid request body", 422, "VALIDATION_ERROR");
  }

  const { code } = parsed.data;

  try {
    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    const result = await applyReferralCode(supabase, code, clinicId);

    if (!result) {
      return apiError(
        "Referral code is invalid, expired, or has already been used",
        400,
        "INVALID_CODE",
      );
    }

    return apiSuccess({
      discountPct: result.discountPct,
      discountMonths: result.discountMonths,
      referrerClinicId: result.referrerClinicId,
    });
  } catch (err) {
    logger.error("Unexpected error applying referral code", {
      context: "referral-program-api",
      clinicId,
      error: err,
    });
    return apiInternalError("Failed to apply referral code");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
