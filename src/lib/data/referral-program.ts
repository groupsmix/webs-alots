"use server";

import { getSiteUrl } from "@/lib/env-getters-core";
import { getOrCreateReferralCode } from "@/lib/referral-program";
import { createUntypedAdminClient } from "@/lib/supabase-server";

export interface ReferralCredit {
  id: string;
  amount_centimes: number;
  currency: string;
  payout_type: string;
  status: "pending" | "approved" | "applied" | "rejected";
  created_at: string;
  applied_at: string | null;
}

export interface ReferralProgramView {
  code: string;
  codeId: string;
  discountPct: number;
  discountMonths: number;
  referralUrl: string;
  stats: {
    signups: number;
    firstPayments: number;
  };
  credits: ReferralCredit[];
}

interface ReferralEventRow {
  event_type: string;
}

interface ReferralCreditRow {
  id: string;
  amount_centimes: number;
  currency: string;
  payout_type: string;
  status: string;
  created_at: string;
  applied_at: string | null;
}

export async function fetchReferralProgram(
  clinicId: string,
  userId: string,
): Promise<ReferralProgramView> {
  const supabase = createUntypedAdminClient("referral-program");

  const referralData = await getOrCreateReferralCode(supabase, clinicId, userId);

  const [{ data: events, error: eventsError }, { data: credits, error: creditsError }] =
    await Promise.all([
      // nosemgrep: semgrep.tenant-scoping
      // Referral events are scoped by referrer_clinic_id, not clinic_id.
      supabase.from("referral_events").select("event_type").eq("referrer_clinic_id", clinicId),
      // nosemgrep: semgrep.tenant-scoping
      // Referral credits are scoped by beneficiary_clinic_id, not clinic_id.
      supabase
        .from("referral_credits")
        .select("id, amount_centimes, currency, payout_type, status, created_at, applied_at")
        .eq("beneficiary_clinic_id", clinicId)
        .order("created_at", { ascending: false }),
    ]);

  if (eventsError) throw new Error(`Failed to load referral events: ${eventsError.message}`);
  if (creditsError) throw new Error(`Failed to load referral credits: ${creditsError.message}`);

  const eventRows = (events ?? []) as unknown as ReferralEventRow[];
  const signups = eventRows.filter((e) => e.event_type === "signup").length;
  const firstPayments = eventRows.filter((e) => e.event_type === "first_payment").length;

  const siteUrl = getSiteUrl();

  return {
    code: referralData.code,
    codeId: referralData.id,
    discountPct: referralData.discountPct,
    discountMonths: referralData.discountMonths,
    referralUrl: `${siteUrl}/register?ref=${referralData.code}`,
    stats: { signups, firstPayments },
    credits: ((credits ?? []) as unknown as ReferralCreditRow[]).map((row) => ({
      id: row.id,
      amount_centimes: row.amount_centimes,
      currency: row.currency,
      payout_type: row.payout_type,
      status: row.status as ReferralCredit["status"],
      created_at: row.created_at,
      applied_at: row.applied_at,
    })),
  };
}
