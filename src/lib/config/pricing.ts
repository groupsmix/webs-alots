/**
 * Pricing UI constants — display labels, color mappings, and type definitions.
 * These are pure presentation constants, not database data.
 */

export type SystemType = "doctor" | "dentist" | "pharmacy";
export type TierSlug = "vitrine" | "cabinet" | "pro" | "premium" | "saas-monthly";

export type SubscriptionStatus = "active" | "trial" | "past_due" | "cancelled" | "suspended";

export const systemTypeLabels: Record<SystemType, string> = {
  doctor: "Médecin",
  dentist: "Dentiste",
  pharmacy: "Pharmacie",
};

export const tierColors: Record<TierSlug, string> = {
  vitrine: "bg-gray-100 text-gray-700",
  cabinet: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  premium: "bg-amber-100 text-amber-700",
  "saas-monthly": "bg-emerald-100 text-emerald-700",
};

export const statusColors: Record<SubscriptionStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  trial: "bg-blue-100 text-blue-700",
  past_due: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-100 text-gray-500",
  suspended: "bg-red-100 text-red-700",
};

export interface PricingFeature {
  key: string;
  label: string;
  included: boolean;
  limit?: string;
}

export interface TierLimits {
  maxDoctors: number;
  maxPatients: number;
  maxAppointmentsPerMonth: number;
  storageGB: number;
  customDomain: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
}

export interface PricingTier {
  id: string;
  slug: TierSlug;
  name: string;
  description: string;
  popular?: boolean;
  pricing: Record<SystemType, { monthly: number; yearly: number }>;
  features: PricingFeature[];
  limits: TierLimits;
}

export interface FeatureToggle {
  id: string;
  key: string;
  label: string;
  description: string;
  category: "core" | "communication" | "integration" | "advanced" | "pharmacy";
  systemTypes: SystemType[];
  tiers: TierSlug[];
  enabled: boolean;
}

export interface ClientInvoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "refunded";
  paidDate?: string;
  downloadUrl?: string;
}
