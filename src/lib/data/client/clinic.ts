"use client";

import { fetchRows, ensureLookups, _activeUserMap, type TableName } from "./_core";
import { fetchTodayAppointments } from "./appointments";

// ─────────────────────────────────────────────
// Clinic Holidays
// ─────────────────────────────────────────────

export interface HolidayView {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
}

export async function fetchHolidays(clinicId: string): Promise<HolidayView[]> {
  const rows = await fetchRows<{
    id: string;
    title: string;
    start_date: string;
    end_date: string;
  }>("clinic_holidays", {
    eq: [["clinic_id", clinicId]],
    order: ["start_date", { ascending: true }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.start_date,
    endDate: r.end_date,
  }));
}

// ─────────────────────────────────────────────
// Blog Posts (stored in clinic config or static)
// ─────────────────────────────────────────────

export interface BlogPostView {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
}

// Blog posts aren't in the DB schema — they may be stored in clinic config
// For now we return empty; pages will fall back to demo data if empty
export async function fetchBlogPosts(_clinicId: string): Promise<BlogPostView[]> {
  return [];
}

// ─────────────────────────────────────────────
// Waiting Room (derived from today's appointments)
// ─────────────────────────────────────────────

export interface WaitingRoomEntry {
  id: string;
  patientName: string;
  scheduledTime: string;
  serviceName: string;
  status: string;
  priority: string;
  checkedInAt?: string;
  arrivedAt?: string;
}

export async function fetchWaitingRoom(clinicId: string): Promise<WaitingRoomEntry[]> {
  const todayAppts = await fetchTodayAppointments(clinicId);
  return todayAppts
    .filter((a) => a.status === "confirmed" || a.status === "checked-in" || a.status === "checked_in")
    .map((a) => ({
      id: a.id,
      patientName: a.patientName,
      scheduledTime: a.time,
      serviceName: a.serviceName,
      status: "waiting",
      priority: a.isEmergency ? "urgent" : "normal",
    }));
}

// ─────────────────────────────────────────────
// Emergency Slots
// ─────────────────────────────────────────────

export interface EmergencySlotView {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  isBooked: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Installment Plans (grouped view)
// ─────────────────────────────────────────────

export interface InstallmentPaymentView {
  id: string;
  installmentPlanId: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: "pending" | "paid" | "overdue";
  receiptId: string | null;
}

export interface InstallmentPlanView {
  id: string;
  patientId: string;
  patientName: string;
  treatmentPlanId: string;
  treatmentTitle: string;
  totalAmount: number;
  currency: string;
  downPayment: number;
  numberOfInstallments: number;
  installments: InstallmentPaymentView[];
  createdAt: string;
  status: "active" | "completed" | "defaulted";
  whatsappReminderEnabled: boolean;
}

interface InstallmentPlanRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  treatment_plan_id: string;
  total_amount: number;
  currency: string | null;
  down_payment: number | null;
  status: string;
  whatsapp_reminder: boolean;
  created_at: string;
}

interface InstallmentItemRaw {
  id: string;
  plan_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  receipt_id: string | null;
}

export async function fetchInstallmentPlans(clinicId: string): Promise<InstallmentPlanView[]> {
  await ensureLookups(clinicId);

  const plans = await fetchRows<InstallmentPlanRaw>("installment_plans" as TableName, {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });

  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);
  const items = await fetchRows<InstallmentItemRaw>("installments", {
    inFilter: ["plan_id", planIds],
    order: ["due_date", { ascending: true }],
  });

  const itemsByPlan = new Map<string, InstallmentItemRaw[]>();
  for (const item of items) {
    const arr = itemsByPlan.get(item.plan_id) ?? [];
    arr.push(item);
    itemsByPlan.set(item.plan_id, arr);
  }

  // Fetch treatment plan titles
  const tpIds = [...new Set(plans.map((p) => p.treatment_plan_id))];
  const tpRows = await fetchRows<{ id: string; title: string }>("treatment_plans", {
    select: "id, title",
    inFilter: ["id", tpIds],
  });
  const tpMap = new Map(tpRows.map((t) => [t.id, t.title]));

  return plans.map((p) => {
    const planItems = itemsByPlan.get(p.id) ?? [];
    return {
      id: p.id,
      patientId: p.patient_id,
      patientName: _activeUserMap?.get(p.patient_id)?.name ?? "Patient",
      treatmentPlanId: p.treatment_plan_id,
      treatmentTitle: tpMap.get(p.treatment_plan_id) ?? "Treatment Plan",
      totalAmount: p.total_amount,
      currency: p.currency ?? "MAD",
      downPayment: p.down_payment ?? 0,
      numberOfInstallments: planItems.length,
      installments: planItems.map((i) => ({
        id: i.id,
        installmentPlanId: i.plan_id,
        amount: i.amount,
        dueDate: i.due_date,
        paidDate: i.paid_date,
        status: i.status as "pending" | "paid" | "overdue",
        receiptId: i.receipt_id,
      })),
      createdAt: p.created_at?.split("T")[0] ?? "",
      status: p.status as "active" | "completed" | "defaulted",
      whatsappReminderEnabled: p.whatsapp_reminder ?? false,
    };
  });
}

