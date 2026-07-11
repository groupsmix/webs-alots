/**
 * Subscription Billing Automation
 *
 * Handles clinic subscription plans, auto-renewal, usage tracking,
 * and billing lifecycle management. Integrates with Stripe for
 * payment processing when configured.
 */

import { assertClinicId } from "@/lib/assert-tenant";
import { safeFetch } from "@/lib/fetch-wrapper";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { logTenantContext } from "@/lib/tenant-context";
import type { SubscriptionPlan as DatabaseSubscriptionPlan } from "@/lib/types/database";
import { getLocalDateStr } from "@/lib/utils";

// ---- Types ----

export type SubscriptionPlan = DatabaseSubscriptionPlan;
type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing" | "paused";
export type BillingInterval = "monthly" | "yearly";

type AiChatbotLevel = false | "basic" | "smart" | "advanced";

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  stripePriceId: string | null;
  features: string[];
  maxDoctors: number;
  maxPatients: number;
  maxAppointmentsPerMonth: number;
  smsCredits: number;
  whatsappCredits: number;
  customDomain: boolean;
  apiAccess: boolean;
  aiChatbot: AiChatbotLevel;
  storageGB: number;
  multiLocation: boolean;
  popular?: boolean;
}

export interface ClinicSubscription {
  id: string;
  clinicId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEnd?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  nextPaymentDate?: string;
  nextPaymentAmount?: number;
}

interface BillingEvent {
  id: string;
  clinicId: string;
  type:
    | "payment_succeeded"
    | "payment_failed"
    | "subscription_created"
    | "subscription_canceled"
    | "subscription_renewed"
    | "trial_ended"
    | "plan_changed";
  amount?: number;
  currency?: string;
  description: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

// ---- Plan Definitions ----

export const SUBSCRIPTION_PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "MAD",
    stripePriceId: null,
    features: ["basic_booking", "website", "5_appointments_per_month"],
    maxDoctors: 1,
    maxPatients: 50,
    maxAppointmentsPerMonth: 5,
    smsCredits: 0,
    whatsappCredits: 0,
    customDomain: false,
    apiAccess: false,
    aiChatbot: false,
    storageGB: 1,
    multiLocation: false,
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 199,
    priceYearly: 1990,
    currency: "MAD",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
    features: [
      "booking",
      "website",
      "whatsapp_reminders",
      "50_appointments",
      "email_notifications",
    ],
    maxDoctors: 3,
    maxPatients: 500,
    maxAppointmentsPerMonth: 50,
    smsCredits: 100,
    whatsappCredits: 100,
    customDomain: false,
    apiAccess: false,
    aiChatbot: "basic",
    storageGB: 5,
    multiLocation: false,
    popular: true,
  },
  {
    id: "professional",
    name: "Professional",
    priceMonthly: 599,
    priceYearly: 5990,
    currency: "MAD",
    stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL || null,
    features: [
      "everything_starter",
      "ai_receptionist",
      "analytics",
      "unlimited_appointments",
      "custom_domain",
      "priority_support",
    ],
    maxDoctors: 10,
    maxPatients: -1,
    maxAppointmentsPerMonth: -1,
    smsCredits: 500,
    whatsappCredits: 500,
    customDomain: true,
    apiAccess: false,
    aiChatbot: "smart",
    storageGB: 25,
    multiLocation: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 999,
    priceYearly: 9990,
    currency: "MAD",
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || null,
    features: [
      "everything_pro",
      "multi_location",
      "api_access",
      "priority_support",
      "white_label",
      "dedicated_account_manager",
    ],
    maxDoctors: -1,
    maxPatients: -1,
    maxAppointmentsPerMonth: -1,
    smsCredits: -1,
    whatsappCredits: -1,
    customDomain: true,
    apiAccess: true,
    aiChatbot: "advanced",
    storageGB: 100,
    multiLocation: true,
  },
];

/** Feature labels for display in the billing UI (French). */
export const FEATURE_LABELS: Record<string, string> = {
  basic_booking: "Réservation basique",
  booking: "Réservation en ligne",
  website: "Site web vitrine",
  whatsapp_reminders: "Rappels WhatsApp",
  email_notifications: "Notifications email",
  "5_appointments_per_month": "5 RDV / mois",
  "50_appointments": "50 RDV / mois",
  everything_starter: "Tout le plan Starter",
  ai_receptionist: "Réceptionniste IA",
  analytics: "Tableau de bord analytique",
  unlimited_appointments: "RDV illimités",
  custom_domain: "Domaine personnalisé",
  priority_support: "Support prioritaire",
  everything_pro: "Tout le plan Professional",
  multi_location: "Multi-établissements",
  api_access: "Accès API",
  white_label: "Marque blanche",
  dedicated_account_manager: "Account manager dédié",
};

/** Get a plan by its Stripe Price ID. */
export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.stripePriceId === priceId);
}

/** All plan slugs in upgrade order. */
export const PLAN_ORDER: SubscriptionPlan[] = ["free", "starter", "professional", "enterprise"];

/**
 * Deep-Dive P1/P2: maps legacy Moroccan tier slugs (`vitrine`, `cabinet`,
 * `pro`, `premium`, `saas`, `saas-monthly` — still present on older
 * `clinics.tier` rows) onto the canonical `SubscriptionPlan` model used by
 * checkout, webhooks, and revenue reporting. This is the single source of
 * truth for that mapping — every caller that resolves a raw stored value
 * (from `clinics.tier`, `clinics.config.subscription_plan`, or
 * `clinic_subscriptions.plan`) into a `SubscriptionPlan` MUST go through
 * `normalizeSubscriptionPlan` instead of casting the raw value and calling
 * `getPlanConfig` directly — the latter throws on legacy/unknown slugs.
 */
const LEGACY_TIER_TO_PLAN: Record<string, SubscriptionPlan> = {
  free: "free",
  starter: "starter",
  professional: "professional",
  enterprise: "enterprise",
  vitrine: "free",
  cabinet: "starter",
  pro: "professional",
  premium: "enterprise",
  saas: "enterprise",
  "saas-monthly": "enterprise",
};

/**
 * Normalize any raw stored plan/tier value (canonical or legacy, any case)
 * into a valid `SubscriptionPlan`. Unknown/missing values fall back to
 * `"free"` rather than throwing, so this is always safe to call on
 * untrusted/legacy data before passing the result to `getPlanConfig`.
 */
export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return LEGACY_TIER_TO_PLAN[normalized] ?? "free";
}

// ---- Helpers ----

export function getPlanConfig(plan: SubscriptionPlan): PlanConfig {
  const config = SUBSCRIPTION_PLANS.find((p) => p.id === plan);
  if (!config) {
    throw new Error(
      `Unknown subscription plan: "${plan}". Valid plans: ${SUBSCRIPTION_PLANS.map((p) => p.id).join(", ")}`,
    );
  }
  return config;
}

export function getPlanPrice(plan: SubscriptionPlan, interval: BillingInterval): number {
  const config = getPlanConfig(plan);
  return interval === "yearly" ? config.priceYearly : config.priceMonthly;
}

export function getYearlySavings(plan: SubscriptionPlan): number {
  const config = getPlanConfig(plan);
  return config.priceMonthly * 12 - config.priceYearly;
}

/**
 * Check if a subscription needs renewal (period has ended).
 */
export function needsRenewal(subscription: ClinicSubscription): boolean {
  if (subscription.status !== "active" && subscription.status !== "past_due") return false;
  if (subscription.cancelAtPeriodEnd) return false;
  const now = new Date();
  const periodEnd = new Date(subscription.currentPeriodEnd);
  return now >= periodEnd;
}

/**
 * Calculate the next billing period dates based on the current period and interval.
 */
export function calculateNextPeriod(
  currentPeriodEnd: string,
  interval: BillingInterval,
): { start: string; end: string } {
  // FIX (MED-01): Use UTC methods consistently to avoid DST-related
  // date shifts when the server's local timezone observes DST.
  const start = new Date(currentPeriodEnd);
  const end = new Date(start);
  if (interval === "yearly") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    // Clamp to last day of target month to prevent overflow
    // (e.g. Jan 31 + 1 month → Feb 28, not Mar 3)
    const dayOfMonth = end.getUTCDate();
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const lastDayOfTargetMonth = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
    ).getUTCDate();
    end.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  }
  return {
    start: getLocalDateStr(start),
    end: getLocalDateStr(end),
  };
}

// ---- Subscription Lifecycle ----

/**
 * Process subscription renewal for a clinic.
 * Called by the cron job to auto-renew active subscriptions.
 */
export async function processRenewal(
  clinicId: string,
): Promise<{ success: boolean; error?: string }> {
  // SAFETY ASSERTION: Block execution if clinic_id is missing or invalid
  // to prevent cross-tenant operations in the billing pipeline.
  try {
    assertClinicId(clinicId, "subscription-billing:processRenewal");
  } catch (err) {
    logger.warn("clinic_id assertion failed in processRenewal", {
      context: "subscription-billing",
      clinicId,
      error: err,
    });
    return { success: false, error: "Missing or invalid clinic_id — blocked for tenant safety" };
  }

  logTenantContext(clinicId, "subscription-billing:processRenewal");
  const supabase = await createTenantClient(clinicId);

  // Fetch current subscription
  const { data: sub, error: fetchError } = await supabase
    .from("clinic_subscriptions")
    .select(
      "id, clinic_id, plan, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, trial_end",
    )
    .eq("clinic_id", clinicId)
    .single();

  if (fetchError || !sub) {
    return { success: false, error: "Subscription not found" };
  }

  const subscription: ClinicSubscription = {
    id: sub.id,
    clinicId: sub.clinic_id,
    plan: sub.plan as SubscriptionPlan,
    status: sub.status as SubscriptionStatus,
    billingInterval: (sub.billing_interval ?? "monthly") as BillingInterval,
    currentPeriodStart: sub.current_period_start ?? "",
    currentPeriodEnd: sub.current_period_end ?? "",
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    stripeCustomerId: sub.stripe_customer_id ?? undefined,
    stripeSubscriptionId: sub.stripe_subscription_id ?? undefined,
    trialEnd: sub.trial_end ?? undefined,
  };

  if (!needsRenewal(subscription)) {
    return { success: true }; // No renewal needed
  }

  const plan = getPlanConfig(subscription.plan);
  const amount = getPlanPrice(subscription.plan, subscription.billingInterval);

  // Free plans renew without payment; paid plans require Stripe
  if (amount > 0) {
    if (!subscription.stripeCustomerId || !process.env.STRIPE_SECRET_KEY) {
      // Paid plan but no payment method configured — cannot renew silently
      await supabase
        .from("clinic_subscriptions")
        .update({ status: "past_due" })
        .eq("clinic_id", clinicId);

      await logBillingEvent(clinicId, {
        type: "payment_failed",
        amount,
        currency: plan.currency,
        description: `Renewal blocked for ${plan.name} plan: no payment method configured`,
      });

      return { success: false, error: "No payment method configured for paid plan renewal" };
    }

    try {
      const stripeResult = await chargeViaStripe(
        subscription.stripeCustomerId,
        amount,
        plan.currency,
        `${plan.name} plan renewal - ${subscription.billingInterval}`,
      );

      if (!stripeResult.success) {
        // Mark as past_due
        await supabase
          .from("clinic_subscriptions")
          .update({ status: "past_due" })
          .eq("clinic_id", clinicId);

        await logBillingEvent(clinicId, {
          type: "payment_failed",
          amount,
          currency: plan.currency,
          description: `Payment failed for ${plan.name} plan renewal: ${stripeResult.error}`,
        });

        return { success: false, error: stripeResult.error };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe charge failed";
      logger.error("Stripe charge failed during subscription renewal", {
        context: "subscription-billing",
        error: err,
        clinicId,
      });
      return { success: false, error: message };
    }
  }

  // Calculate next period
  const nextPeriod = calculateNextPeriod(
    subscription.currentPeriodEnd,
    subscription.billingInterval,
  );

  // Update subscription
  await supabase
    .from("clinic_subscriptions")
    .update({
      status: "active",
      current_period_start: nextPeriod.start,
      current_period_end: nextPeriod.end,
    })
    .eq("clinic_id", clinicId);

  // Log the event
  await logBillingEvent(clinicId, {
    type: "subscription_renewed",
    amount,
    currency: plan.currency,
    description: `${plan.name} plan renewed for ${subscription.billingInterval} period`,
  });

  return { success: true };
}

/**
 * Charge a customer via Stripe API.
 */
async function chargeViaStripe(
  customerId: string,
  amount: number,
  currency: string,
  description: string,
): Promise<{ success: boolean; chargeId?: string; error?: string }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { success: false, error: "Stripe not configured" };
  }

  // HIGH-02: Add idempotency key to prevent duplicate charges on retry.
  // The key is scoped to the customer + current date to ensure that a
  // failed cron retry on the same day does not create a second charge.
  const idempotencyKey = `renewal-${customerId}-${getLocalDateStr()}`;

  const response = await safeFetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body: new URLSearchParams({
      amount: String(Math.round(amount * 100)), // Stripe uses cents
      currency: currency.toLowerCase(),
      customer: customerId,
      description,
      confirm: "true",
      automatic_payment_methods: JSON.stringify({ enabled: true, allow_redirects: "never" }),
    }).toString(),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await response.json();
  if (response.ok && data.status === "succeeded") {
    return { success: true, chargeId: data.id };
  }

  return { success: false, error: data.error?.message || "Payment failed" };
}

/**
 * Log a billing event to the database.
 */
async function logBillingEvent(
  clinicId: string,
  event: Omit<BillingEvent, "id" | "clinicId" | "createdAt">,
): Promise<void> {
  const supabase = await createTenantClient(clinicId);
  await supabase.from("billing_events").insert({
    clinic_id: clinicId,
    type: event.type,
    amount: event.amount ?? 0,
    currency: event.currency ?? "MAD",
    description: event.description,
    metadata: event.metadata ?? {},
  });
}

// ── Usage-Based Billing ──

/**
 * Calculate usage-based bill for a clinic for the current month.
 * Combines fixed plan price + metered usage from tenant_usage_log.
 */
