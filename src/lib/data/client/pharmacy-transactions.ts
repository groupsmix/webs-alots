"use client";

import { ensureLookups, fetchRows, _activeUserMap } from "./_core";

// ─────────────────────────────────────────────
// Pharmacy / Parapharmacy: Daily Sales
//
// Both modules write to the canonical `sales` table (with the
// `is_parapharmacy` flag set to true for parapharmacy transactions).
// Previously this function was reading from `pharmacy_sales` (a
// non-existent table name used as a TypeScript cast), which meant
// reads always returned an empty array while writes persisted fine.
// ─────────────────────────────────────────────

interface DailySaleItemView {
  productName: string;
  quantity: number;
  price: number;
}

export interface DailySaleView {
  id: string;
  date: string;
  time: string;
  patientName: string;
  items: DailySaleItemView[];
  total: number;
  currency: string;
  paymentMethod: "cash" | "card" | "insurance";
  hasPrescription: boolean;
  loyaltyPointsEarned: number;
}

interface SaleRaw {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  patient_name: string | null;
  items: DailySaleItemView[] | null;
  total: number | null;
  currency: string;
  payment_method: string;
  has_prescription: boolean | null;
  loyalty_points_earned: number | null;
  date: string;
  time: string;
}

export async function fetchDailySales(
  clinicId: string,
  options?: { parapharmacyOnly?: boolean },
): Promise<DailySaleView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (options?.parapharmacyOnly) eq.push(["is_parapharmacy", true]);
  const rows = await fetchRows<SaleRaw>("sales", {
    eq,
    order: ["date", { ascending: false }],
    tenantClinicId: clinicId,
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date ?? "",
    time: typeof r.time === "string" ? r.time.slice(0, 5) : "",
    patientName:
      r.patient_name ??
      (r.patient_id ? (_activeUserMap?.get(r.patient_id)?.name ?? "Patient") : "Walk-in"),
    items: r.items ?? [],
    total: r.total ?? 0,
    currency: r.currency ?? "MAD",
    paymentMethod: (r.payment_method as "cash" | "card" | "insurance") ?? "cash",
    hasPrescription: r.has_prescription ?? false,
    loyaltyPointsEarned: r.loyalty_points_earned ?? 0,
  }));
}

// ─────────────────────────────────────────────
// Pharmacy: Loyalty Transactions
// ─────────────────────────────────────────────

export interface LoyaltyTransactionView {
  id: string;
  memberId: string;
  type: "earned" | "redeemed" | "birthday_bonus" | "referral_bonus" | "expired";
  points: number;
  description: string;
  date: string;
  saleId?: string;
}

interface LoyaltyTransactionRaw {
  id: string;
  member_id: string;
  clinic_id: string;
  type: string;
  points: number;
  description: string | null;
  sale_id?: string | null;
  created_at: string;
}

export async function fetchLoyaltyTransactions(
  clinicId: string,
): Promise<LoyaltyTransactionView[]> {
  const rows = await fetchRows<LoyaltyTransactionRaw>("loyalty_transactions", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    type: (r.type as LoyaltyTransactionView["type"]) ?? "earned",
    points: r.points,
    description: r.description ?? "",
    date: r.created_at?.split("T")[0] ?? "",
    saleId: r.sale_id ?? undefined,
  }));
}

// ─────────────────────────────────────────────
