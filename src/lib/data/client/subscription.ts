"use client";

import { createClient } from "@/lib/supabase-client";
import { getLocalDateStr } from "@/lib/utils";

// Clinic Subscription (for admin billing page)
// ─────────────────────────────────────────────

export interface ClinicSubscriptionView {
  id: string;
  clinicId: string;
  tierSlug: string;
  tierName: string;
  status: "active" | "trial" | "past_due" | "cancelled" | "suspended";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  paymentMethod: string;
  autoRenew: boolean;
  systemType: string;
  invoices: {
    id: string;
    date: string;
    amount: number;
    status: "paid" | "pending" | "overdue" | "refunded";
    paidDate?: string;
  }[];
  tier: {
    slug: string;
    name: string;
    description: string;
    features: { key: string; label: string; included: boolean; limit?: string }[];
    limits: {
      maxDoctors: number;
      maxPatients: number;
      maxAppointmentsPerMonth: number;
      storageGB: number;
      customDomain: boolean;
      apiAccess: boolean;
      whiteLabel: boolean;
    };
    pricing: Record<string, { monthly: number; yearly: number }>;
  } | null;
}

const TIER_NAMES: Record<string, string> = {
  vitrine: "Vitrine",
  cabinet: "Cabinet",
  pro: "Pro",
  premium: "Premium",
  "saas-monthly": "SaaS Mensuel",
};

export async function fetchClinicSubscription(clinicId: string): Promise<ClinicSubscriptionView | null> {
  const supabase = createClient();

  // Fetch the clinic to get tier and type info
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id, name, type, tier, status")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) return null;

  const tierSlug = clinic.tier ?? "vitrine";
  const systemType = clinic.type ?? "doctor";

  // Fetch pricing tier details
  const { data: tierData } = await supabase
    .from("pricing_tiers")
    .select("id, slug, name, description, features, limits, pricing")
    .eq("slug", tierSlug)
    .single();

  // Fetch recent payments as invoices
  const { data: paymentsData } = await supabase
    .from("payments")
    .select("id, amount, status, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(10);

  const payments = (paymentsData ?? []) as { id: string; amount: number; status: string; created_at: string }[];
  const invoices = payments.map((p) => ({
    id: p.id,
    date: p.created_at?.split("T")[0] ?? "",
    amount: p.amount ?? 0,
    status: (p.status === "completed" ? "paid" : p.status === "pending" ? "pending" : "overdue") as "paid" | "pending" | "overdue" | "refunded",
    paidDate: p.status === "completed" ? p.created_at?.split("T")[0] : undefined,
  }));

  const subStatus: ClinicSubscriptionView["status"] =
    clinic.status === "active" ? "active"
      : clinic.status === "suspended" ? "suspended"
      : clinic.status === "trial" ? "trial"
      : "cancelled";

  const now = new Date();
  const monthStart = getLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = getLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const latestPayment = payments[0];
  const amount = latestPayment?.amount ?? 0;

  return {
    id: `sub-${clinic.id}`,
    clinicId: clinic.id,
    tierSlug,
    tierName: TIER_NAMES[tierSlug] ?? tierSlug,
    status: subStatus,
    currentPeriodStart: monthStart,
    currentPeriodEnd: monthEnd,
    billingCycle: "monthly",
    amount,
    currency: "MAD",
    paymentMethod: "Carte bancaire",
    autoRenew: clinic.status === "active",
    systemType,
    invoices,
    tier: tierData ? {
      slug: tierData.slug ?? "",
      name: tierData.name ?? "",
      description: tierData.description ?? "",
      features: (tierData.features as { key: string; label: string; included: boolean; limit?: string }[]) ?? [],
      limits: (tierData.limits as NonNullable<ClinicSubscriptionView["tier"]>["limits"]) ?? {
        maxDoctors: 1, maxPatients: 0, maxAppointmentsPerMonth: 0,
        storageGB: 1, customDomain: false, apiAccess: false, whiteLabel: false,
      },
      pricing: (tierData.pricing as Record<string, { monthly: number; yearly: number }>) ?? {},
    } : null,
  };
}

// ─────────────────────────────────────────────
