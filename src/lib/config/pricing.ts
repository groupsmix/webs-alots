/**
 * Pricing UI constants — display labels, color mappings, and type definitions.
 * These are pure presentation constants, not database data.
 */

import type { SubscriptionPlan } from "@/lib/subscription-billing";
import type { SystemType as DatabaseSystemType } from "@/lib/types/database";
export type { SubscriptionPlan };

export type SystemType = DatabaseSystemType;

export type SubscriptionStatus = "active" | "trial" | "past_due" | "cancelled" | "suspended";

export const systemTypeLabels: Record<SystemType, string> = {
  doctor: "Médecin",
  dentist: "Dentiste",
  pharmacy: "Pharmacie",
};

export const tierColors: Record<SubscriptionPlan, string> = {
  free: "bg-gray-100 text-gray-700",
  starter: "bg-blue-100 text-blue-700",
  professional: "bg-purple-100 text-purple-700",
  enterprise: "bg-amber-100 text-amber-700",
};

export const statusColors: Record<SubscriptionStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  trial: "bg-blue-100 text-blue-700",
  past_due: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-100 text-gray-500",
  suspended: "bg-red-100 text-red-700",
};
