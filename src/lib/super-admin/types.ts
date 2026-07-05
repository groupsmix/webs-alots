import type { SystemType } from "@/lib/config/pricing";
import type { SubscriptionPlan } from "@/lib/subscription-billing";

export interface PromotionRow {
  id: string;
  name: string;
  discount: number;
  tiers: string[];
  startDate: string;
  endDate: string;
  enabled: boolean;
}

export interface BillingRecord {
  id: string;
  clinicId: string;
  clinicName: string;
  plan: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: "paid" | "pending" | "overdue" | "cancelled";
  invoiceDate: string;
  dueDate: string;
  paidDate?: string;
  paymentMethod?: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  description: string;
  clinicId?: string;
  clinicName?: string;
  timestamp: string;
  actor: string;
  type: "clinic" | "billing" | "feature" | "announcement" | "template" | "auth";
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "critical";
  target: string;
  targetLabel: string;
  publishedAt: string;
  expiresAt?: string;
  active: boolean;
  createdBy: string;
}

export interface AnnouncementInput {
  title: string;
  message: string;
  type: Announcement["type"];
  target: string;
  targetLabel: string;
  publishedAt?: string;
  expiresAt?: string;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  key: string;
  category: "core" | "communication" | "integration" | "advanced";
  availableTiers: string[];
  globalEnabled: boolean;
}

export interface PricingTierRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  popular: boolean;
  pricing: Record<string, { monthly: number; yearly: number }>;
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
}

export interface ClientInvoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "refunded";
  paidDate?: string;
}

export interface ClientSubscription {
  id: string;
  clinicId: string;
  clinicName: string;
  systemType: SystemType;
  SubscriptionPlan: SubscriptionPlan;
  tierName: string;
  status: "active" | "trial" | "past_due" | "cancelled" | "suspended";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  paymentMethod: string;
  autoRenew: boolean;
  trialEndsAt?: string;
  cancelledAt?: string;
  invoices: ClientInvoice[];
  isQuarantinedJunk?: boolean;
}

export interface RevenueStats {
  mrr: number;
  arr: number;
  totalClinics: number;
  activePaidClinics: number;
  churnedThisMonth: number;
  churnRate: number;
  planBreakdown: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
}

export interface PriceHistoryEntry {
  date: string;
  system: string;
  cycle: string;
  oldPrice: number;
  newPrice: number;
}

export interface FeatureToggleRow {
  id: string;
  key: string;
  label: string;
  description: string;
  category: "core" | "communication" | "integration" | "advanced" | "pharmacy";
  systemTypes: string[];
  tiers: string[];
  enabled: boolean;
}
