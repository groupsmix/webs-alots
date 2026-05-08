/**
 * Subscription plan definitions for auto-billing.
 *
 * Each plan maps to a Stripe Price ID (set in Stripe Dashboard).
 * The `limits` object is enforced by `src/lib/subscription-guard.ts`.
 */

export type PlanSlug = "free" | "starter" | "professional" | "enterprise";

export type AiChatbotLevel = false | "basic" | "smart" | "advanced";

export interface PlanLimits {
  appointmentsPerMonth: number;
  staffMembers: number;
  aiChatbot: AiChatbotLevel;
  storageGB: number;
  customDomain: boolean;
  apiAccess: boolean;
  multiLocation: boolean;
}

export interface SubscriptionPlan {
  name: string;
  slug: PlanSlug;
  price: number;
  currency: string;
  stripePriceId: string | null;
  features: string[];
  limits: PlanLimits;
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: Record<PlanSlug, SubscriptionPlan> = {
  free: {
    name: "Gratuit",
    slug: "free",
    price: 0,
    currency: "MAD",
    stripePriceId: null,
    features: [
      "basic_booking",
      "website",
      "5_appointments_per_month",
    ],
    limits: {
      appointmentsPerMonth: 5,
      staffMembers: 1,
      aiChatbot: false,
      storageGB: 1,
      customDomain: false,
      apiAccess: false,
      multiLocation: false,
    },
  },
  starter: {
    name: "Starter",
    slug: "starter",
    price: 199,
    currency: "MAD",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
    features: [
      "booking",
      "website",
      "whatsapp_reminders",
      "50_appointments",
      "email_notifications",
    ],
    limits: {
      appointmentsPerMonth: 50,
      staffMembers: 3,
      aiChatbot: "basic",
      storageGB: 5,
      customDomain: false,
      apiAccess: false,
      multiLocation: false,
    },
    popular: true,
  },
  professional: {
    name: "Professional",
    slug: "professional",
    price: 499,
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
    limits: {
      appointmentsPerMonth: -1,
      staffMembers: 10,
      aiChatbot: "smart",
      storageGB: 25,
      customDomain: true,
      apiAccess: false,
      multiLocation: false,
    },
  },
  enterprise: {
    name: "Enterprise",
    slug: "enterprise",
    price: 999,
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
    limits: {
      appointmentsPerMonth: -1,
      staffMembers: -1,
      aiChatbot: "advanced",
      storageGB: 100,
      customDomain: true,
      apiAccess: true,
      multiLocation: true,
    },
  },
};

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
export function getPlanByPriceId(priceId: string): SubscriptionPlan | undefined {
  return Object.values(SUBSCRIPTION_PLANS).find(
    (plan) => plan.stripePriceId === priceId,
  );
}

/** Get a plan by its slug. */
export function getPlanBySlug(slug: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS[slug as PlanSlug];
}

/** All plan slugs in upgrade order. */
export const PLAN_ORDER: PlanSlug[] = ["free", "starter", "professional", "enterprise"];
