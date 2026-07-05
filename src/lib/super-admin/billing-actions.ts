import { logger } from "@/lib/logger";
import { invalidateSubdomainCache } from "@/lib/subdomain-cache";
import { getPlanConfig } from "@/lib/subscription-billing";
import { createClient } from "@/lib/supabase-server";
import {
  buildPaymentsByClinic,
  mapBillingRecord,
  mapClientSubscription,
  resolveClinicSubscriptionPlan,
} from "@/lib/super-admin/helpers";
import type { BillingRecord, ClientSubscription, RevenueStats } from "@/lib/super-admin/types";

type SuperAdminClient = Awaited<ReturnType<typeof createClient>>;

type ClinicSubscriptionRow = {
  id: string;
  name: string;
  type: string;
  tier: string | null;
  status: string | null;
  subdomain: string | null;
  config: Record<string, unknown> | null;
  created_at: string | null;
};

export async function updateSubscriptionStatusImpl(
  supabase: SuperAdminClient,
  clinicId: string,
  action: "activate" | "suspend" | "cancel",
): Promise<void> {
  const STATUS_BY_ACTION = {
    activate: "active",
    suspend: "suspended",
    cancel: "inactive",
  } as const;
  const AUDIT_BY_ACTION = {
    activate: { action: "subscription_activated", verb: "activated" },
    suspend: { action: "subscription_suspended", verb: "suspended" },
    cancel: { action: "subscription_cancelled", verb: "cancelled" },
  } as const;

  const status = STATUS_BY_ACTION[action];

  const { data: clinic } = await supabase
    .from("clinics") // nosemgrep: semgrep.tenant-scoping — super-admin updates a specific clinic by id
    .select("id, name, subdomain")
    .eq("id", clinicId)
    .single();

  const { error } = await supabase
    .from("clinics") // nosemgrep: semgrep.tenant-scoping — super-admin updates a specific clinic by id
    .update({ status })
    .eq("id", clinicId);

  if (error) throw new Error(`Failed to update subscription status: ${error.message}`);

  if (clinic?.subdomain) {
    invalidateSubdomainCache(clinic.subdomain);
  }

  try {
    await supabase.from("activity_logs").insert({
      action: AUDIT_BY_ACTION[action].action,
      description: `Subscription for "${clinic?.name ?? clinicId}" ${AUDIT_BY_ACTION[action].verb}`,
      clinic_id: clinicId,
      clinic_name: clinic?.name ?? null,
      type: "billing",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", {
      context: "super-admin-actions",
      clinicId,
      error: err,
    });
  }
}

export async function fetchBillingRecordsImpl(
  supabase: SuperAdminClient,
): Promise<BillingRecord[]> {
  const [paymentsRes, clinicsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, clinic_id, amount, status, payment_type, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("clinics").select("id, name, tier, config"),
  ]);

  const payments = (paymentsRes.data ?? []) as {
    id: string;
    clinic_id: string;
    amount: number;
    status: string;
    payment_type: string | null;
    created_at: string;
  }[];
  const clinics = (clinicsRes.data ?? []) as {
    id: string;
    name: string;
    tier: string | null;
    config: Record<string, unknown> | null;
  }[];
  const clinicMap = new Map(clinics.map((clinic) => [clinic.id, clinic]));

  return payments.map((payment) => mapBillingRecord(payment, clinicMap.get(payment.clinic_id)));
}

export async function fetchRevenueStatsImpl(supabase: SuperAdminClient): Promise<RevenueStats> {
  const { data: clinics } = await supabase.from("clinics").select("id, config, created_at");

  const planBreakdown: Record<string, number> = {
    free: 0,
    starter: 0,
    professional: 0,
    enterprise: 0,
  };

  if (clinics) {
    for (const clinic of clinics) {
      const plan = resolveClinicSubscriptionPlan({
        config: clinic.config as Record<string, unknown> | null,
      });
      if (planBreakdown[plan] !== undefined) {
        planBreakdown[plan]++;
      } else {
        planBreakdown.free++;
      }
    }
  }

  const activePaidClinics =
    (planBreakdown.starter ?? 0) +
    (planBreakdown.professional ?? 0) +
    (planBreakdown.enterprise ?? 0);

  const mrr =
    (planBreakdown.starter ?? 0) * getPlanConfig("starter").priceMonthly +
    (planBreakdown.professional ?? 0) * getPlanConfig("professional").priceMonthly +
    (planBreakdown.enterprise ?? 0) * getPlanConfig("enterprise").priceMonthly;

  return {
    mrr,
    arr: mrr * 12,
    totalClinics: clinics?.length ?? 0,
    activePaidClinics,
    churnedThisMonth: 0,
    churnRate: 0,
    planBreakdown,
    revenueByMonth: [],
  };
}

export async function fetchClientSubscriptionsImpl(
  supabase: SuperAdminClient,
): Promise<ClientSubscription[]> {
  const [clinicsRes, paymentsRes] = await Promise.all([
    supabase.from("clinics").select("id, name, type, tier, status, subdomain, config, created_at"),
    supabase
      .from("payments")
      .select("id, clinic_id, amount, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const clinics = (clinicsRes.data ?? []) as ClinicSubscriptionRow[];
  const payments = (paymentsRes.data ?? []) as {
    id: string;
    clinic_id: string;
    amount: number;
    status: string;
    created_at: string;
  }[];

  const paymentsByClinic = buildPaymentsByClinic(payments);

  return clinics.map((clinic) =>
    mapClientSubscription(clinic, paymentsByClinic.get(clinic.id) ?? []),
  );
}
