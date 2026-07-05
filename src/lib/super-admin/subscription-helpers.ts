import type { SystemType } from "@/lib/config/pricing";
import {
  getPlanConfig,
  normalizeSubscriptionPlan,
  type SubscriptionPlan,
} from "@/lib/subscription-billing";
import type { BillingRecord, ClientInvoice, ClientSubscription } from "@/lib/super-admin/types";
import { getLocalDateStr } from "@/lib/utils";
import { isKnownJunkSubdomain } from "@/lib/validations/known-junk-tenants";

export function resolveClinicSubscriptionPlan(clinic: {
  tier?: string | null;
  config?: Record<string, unknown> | null;
}): SubscriptionPlan {
  return normalizeSubscriptionPlan(clinic.config?.subscription_plan ?? clinic.tier ?? "free");
}

function getSubscriptionPlanLabel(plan: SubscriptionPlan): string {
  return getPlanConfig(plan).name;
}

type BillingPaymentRow = {
  id: string;
  clinic_id: string;
  amount: number;
  status: string;
  payment_type: string | null;
  created_at: string;
};

type BillingClinicRow = {
  id: string;
  name: string;
  tier: string | null;
  config: Record<string, unknown> | null;
};

export function mapBillingRecord(
  payment: BillingPaymentRow,
  clinic: BillingClinicRow | undefined,
): BillingRecord {
  const createdDate = payment.created_at?.split("T")[0] ?? "";
  const isPaid = payment.status === "completed";
  const plan = resolveClinicSubscriptionPlan(clinic ?? {});

  return {
    id: payment.id,
    clinicId: payment.clinic_id,
    clinicName: clinic?.name ?? "Unknown Clinic",
    plan: getSubscriptionPlanLabel(plan),
    amountDue: payment.amount ?? 0,
    amountPaid: isPaid ? (payment.amount ?? 0) : 0,
    currency: "MAD",
    status: (isPaid
      ? "paid"
      : payment.status === "pending"
        ? "pending"
        : "overdue") as BillingRecord["status"],
    invoiceDate: createdDate,
    dueDate: createdDate,
    paidDate: isPaid ? createdDate : undefined,
    paymentMethod: payment.payment_type ?? undefined,
  };
}

type ClientPaymentRow = {
  id: string;
  clinic_id: string;
  amount: number;
  status: string;
  created_at: string;
};

export function buildPaymentsByClinic(
  payments: ClientPaymentRow[],
): Map<string, ClientPaymentRow[]> {
  const paymentsByClinic = new Map<string, ClientPaymentRow[]>();
  for (const payment of payments) {
    const list = paymentsByClinic.get(payment.clinic_id) ?? [];
    list.push(payment);
    paymentsByClinic.set(payment.clinic_id, list);
  }
  return paymentsByClinic;
}

function mapClientInvoices(payments: ClientPaymentRow[]): ClientInvoice[] {
  return payments.slice(0, 5).map((payment) => ({
    id: payment.id,
    date: payment.created_at?.split("T")[0] ?? "",
    amount: payment.amount ?? 0,
    status: (payment.status === "completed"
      ? "paid"
      : payment.status === "pending"
        ? "pending"
        : "overdue") as ClientInvoice["status"],
    paidDate: payment.status === "completed" ? payment.created_at?.split("T")[0] : undefined,
  }));
}

export function mapClientSubscription(
  clinic: {
    id: string;
    name: string;
    type: string;
    tier: string | null;
    status: string | null;
    subdomain: string | null;
    config: Record<string, unknown> | null;
  },
  clinicPayments: ClientPaymentRow[],
): ClientSubscription {
  const subscriptionPlan = resolveClinicSubscriptionPlan(clinic);
  const subStatus: ClientSubscription["status"] =
    clinic.status === "active"
      ? "active"
      : clinic.status === "suspended"
        ? "suspended"
        : clinic.status === "trial"
          ? "trial"
          : "cancelled";

  const now = new Date();
  const monthStart = getLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = getLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const latestPayment = clinicPayments[0];
  const amount =
    latestPayment?.amount != null && latestPayment.amount > 0
      ? latestPayment.amount
      : getPlanConfig(subscriptionPlan).priceMonthly;

  return {
    id: `sub-${clinic.id}`,
    clinicId: clinic.id,
    clinicName: clinic.name,
    systemType: (clinic.type ?? "doctor") as SystemType,
    SubscriptionPlan: subscriptionPlan,
    tierName: getSubscriptionPlanLabel(subscriptionPlan),
    status: subStatus,
    currentPeriodStart: monthStart,
    currentPeriodEnd: monthEnd,
    billingCycle: "monthly",
    amount,
    currency: "MAD",
    paymentMethod: "Carte bancaire",
    autoRenew: clinic.status === "active",
    invoices: mapClientInvoices(clinicPayments),
    isQuarantinedJunk: isKnownJunkSubdomain(clinic.subdomain),
  };
}
