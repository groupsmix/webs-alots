/**
 * Subscription Billing Automation
 *
 * Handles clinic subscription plans, auto-renewal, usage tracking,
 * and billing lifecycle management. Integrates with Stripe for
 * payment processing when configured.
 */

import { createClient } from "@/lib/supabase-server";

// ---- Types ----

export type SubscriptionPlan = "free" | "starter" | "professional" | "enterprise";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing" | "paused";
export type BillingInterval = "monthly" | "yearly";

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  maxDoctors: number;
  maxPatients: number;
  maxAppointmentsPerMonth: number;
  smsCredits: number;
  whatsappCredits: number;
  customDomain: boolean;
  videoConsultation: boolean;
  apiAccess: boolean;
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

export interface BillingEvent {
  id: string;
  clinicId: string;
  type: "payment_succeeded" | "payment_failed" | "subscription_created" | "subscription_canceled" | "subscription_renewed" | "trial_ended" | "plan_changed";
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
    features: ["Up to 2 doctors", "50 patients", "100 appointments/month", "Basic dashboard"],
    maxDoctors: 2,
    maxPatients: 50,
    maxAppointmentsPerMonth: 100,
    smsCredits: 0,
    whatsappCredits: 0,
    customDomain: false,
    videoConsultation: false,
    apiAccess: false,
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 299,
    priceYearly: 2990,
    currency: "MAD",
    features: ["Up to 5 doctors", "500 patients", "500 appointments/month", "SMS & WhatsApp (100/mo)", "CSV Export"],
    maxDoctors: 5,
    maxPatients: 500,
    maxAppointmentsPerMonth: 500,
    smsCredits: 100,
    whatsappCredits: 100,
    customDomain: false,
    videoConsultation: false,
    apiAccess: false,
  },
  {
    id: "professional",
    name: "Professional",
    priceMonthly: 599,
    priceYearly: 5990,
    currency: "MAD",
    features: ["Unlimited doctors", "Unlimited patients", "Unlimited appointments", "SMS & WhatsApp (500/mo)", "Custom domain", "Video consultations", "Full analytics"],
    maxDoctors: Infinity,
    maxPatients: Infinity,
    maxAppointmentsPerMonth: Infinity,
    smsCredits: 500,
    whatsappCredits: 500,
    customDomain: true,
    videoConsultation: true,
    apiAccess: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 999,
    priceYearly: 9990,
    currency: "MAD",
    features: ["Everything in Professional", "API access", "Priority support", "Unlimited SMS & WhatsApp", "White-label branding", "Multi-location"],
    maxDoctors: Infinity,
    maxPatients: Infinity,
    maxAppointmentsPerMonth: Infinity,
    smsCredits: Infinity,
    whatsappCredits: Infinity,
    customDomain: true,
    videoConsultation: true,
    apiAccess: true,
  },
];

// ---- Helpers ----

export function getPlanConfig(plan: SubscriptionPlan): PlanConfig {
  return SUBSCRIPTION_PLANS.find((p) => p.id === plan) ?? SUBSCRIPTION_PLANS[0];
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
  const start = new Date(currentPeriodEnd);
  const end = new Date(start);
  if (interval === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

/**
 * Check if a clinic has exceeded its plan limits.
 */
export async function checkPlanLimits(
  clinicId: string,
  plan: SubscriptionPlan,
): Promise<{ withinLimits: boolean; exceeded: string[] }> {
  const config = getPlanConfig(plan);
  const exceeded: string[] = [];
  const supabase = await createClient();

  // Run all three independent count queries in parallel
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const [doctorResult, patientResult, appointmentResult] = await Promise.all([
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("role", "doctor"),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("role", "patient"),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("appointment_date", monthStart),
  ]);

  const doctorCount = doctorResult.count ?? 0;
  const patientCount = patientResult.count ?? 0;
  const appointmentCount = appointmentResult.count ?? 0;

  if (doctorCount > config.maxDoctors) {
    exceeded.push(`Doctors: ${doctorCount}/${config.maxDoctors}`);
  }
  if (patientCount > config.maxPatients) {
    exceeded.push(`Patients: ${patientCount}/${config.maxPatients}`);
  }
  if (appointmentCount > config.maxAppointmentsPerMonth) {
    exceeded.push(`Appointments this month: ${appointmentCount}/${config.maxAppointmentsPerMonth}`);
  }

  return { withinLimits: exceeded.length === 0, exceeded };
}

// ---- Subscription Lifecycle ----

/**
 * Process subscription renewal for a clinic.
 * Called by the cron job to auto-renew active subscriptions.
 */
export async function processRenewal(
  clinicId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Fetch current subscription
  const { data: sub, error: fetchError } = await supabase
    .from("clinic_subscriptions")
    .select("*")
    .eq("clinic_id", clinicId)
    .single();

  if (fetchError || !sub) {
    return { success: false, error: "Subscription not found" };
  }

  const subscription = sub as unknown as ClinicSubscription;

  if (!needsRenewal(subscription)) {
    return { success: true }; // No renewal needed
  }

  const plan = getPlanConfig(subscription.plan);
  const amount = getPlanPrice(subscription.plan, subscription.billingInterval);

  // If Stripe is configured, charge via Stripe
  if (subscription.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
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
    } as Record<string, unknown>)
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

  const response = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      amount: String(Math.round(amount * 100)), // Stripe uses cents
      currency: currency.toLowerCase(),
      customer: customerId,
      description,
      confirm: "true",
      automatic_payment_methods: JSON.stringify({ enabled: true, allow_redirects: "never" }),
    }).toString(),
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
  const supabase = await createClient();
  await supabase.from("billing_events").insert({
    clinic_id: clinicId,
    type: event.type,
    amount: event.amount ?? 0,
    currency: event.currency ?? "MAD",
    description: event.description,
    metadata: event.metadata ?? {},
  });
}
