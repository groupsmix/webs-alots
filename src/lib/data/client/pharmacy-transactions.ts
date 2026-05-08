"use client";

import { ensureLookups, fetchRows, _activeUserMap, type TableName } from "./_core";

// ─────────────────────────────────────────────
// Pharmacy: Daily Sales
// ─────────────────────────────────────────────

export interface DailySaleItemView {
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

interface PharmacySaleRaw {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  items: DailySaleItemView[] | null;
  total: number | null;
  payment_method: string | null;
  has_prescription?: boolean;
  loyalty_points_earned?: number | null;
  created_at: string;
}

export async function fetchDailySales(clinicId: string): Promise<DailySaleView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PharmacySaleRaw>("pharmacy_sales" as TableName, {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => {
    const dt = r.created_at ?? "";
    return {
      id: r.id,
      date: dt.split("T")[0] ?? "",
      time: dt.split("T")[1]?.slice(0, 5) ?? "",
      patientName: r.patient_id ? (_activeUserMap?.get(r.patient_id)?.name ?? "Patient") : "Walk-in",
      items: r.items ?? [],
      total: r.total ?? 0,
      currency: "MAD",
      paymentMethod: (r.payment_method as "cash" | "card" | "insurance") ?? "cash",
      hasPrescription: r.has_prescription ?? false,
      loyaltyPointsEarned: r.loyalty_points_earned ?? 0,
    };
  });
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

export async function fetchLoyaltyTransactions(clinicId: string): Promise<LoyaltyTransactionView[]> {
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
