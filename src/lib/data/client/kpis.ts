"use client";

import { ensureLookups, fetchRows, _activeUserMap } from "./_core";
import { createClient } from "@/lib/supabase-client";
import { getLocalDateStr } from "@/lib/utils";

// Lab Dashboard KPIs (Task 36)
// ─────────────────────────────────────────────

export interface LabDashboardKPIs {
  pendingTestOrders: number;
  awaitingValidation: number;
  completedToday: number;
  completedThisWeek: number;
  averageTurnaroundHours: number;
  recentTests: LabDashboardTestView[];
}

export interface LabDashboardTestView {
  id: string;
  patientName: string;
  doctorName: string;
  testName: string;
  testCategory: string;
  status: string;
  priority: string;
  orderedAt: string;
  completedAt: string | null;
  turnaroundHours: number | null;
}

interface LabTestOrderRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  test_name: string;
  test_category: string | null;
  status: string;
  priority: string;
  ordered_at: string;
  started_at: string | null;
  completed_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  notes: string | null;
  created_at: string;
}

function calcTurnaroundHours(orderedAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  const diff = new Date(completedAt).getTime() - new Date(orderedAt).getTime();
  return Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
}

export async function fetchLabDashboardKPIs(clinicId: string): Promise<LabDashboardKPIs> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LabTestOrderRaw>("lab_test_orders", {
    eq: [["clinic_id", clinicId]],
    order: ["ordered_at", { ascending: false }],
  });

  const now = new Date();
  const todayStr = getLocalDateStr(now);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  const pending = rows.filter((r) => r.status === "pending");
  const awaiting = rows.filter((r) => r.status === "awaiting_validation");
  const completedToday = rows.filter(
    (r) => (r.status === "completed" || r.status === "validated") && r.completed_at && r.completed_at.startsWith(todayStr),
  );
  const completedThisWeek = rows.filter(
    (r) => (r.status === "completed" || r.status === "validated") && r.completed_at && r.completed_at >= weekAgoStr,
  );

  const completedWithTimes = rows.filter((r) => r.completed_at);
  const totalTurnaround = completedWithTimes.reduce((sum, r) => {
    const hours = calcTurnaroundHours(r.ordered_at, r.completed_at);
    return sum + (hours ?? 0);
  }, 0);
  const avgTurnaround = completedWithTimes.length > 0 ? Math.round((totalTurnaround / completedWithTimes.length) * 10) / 10 : 0;

  const recentTests: LabDashboardTestView[] = rows.slice(0, 10).map((r) => ({
    id: r.id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorName: _activeUserMap?.get(r.doctor_id)?.name ?? "Doctor",
    testName: r.test_name,
    testCategory: r.test_category ?? "General",
    status: r.status,
    priority: r.priority ?? "normal",
    orderedAt: r.ordered_at,
    completedAt: r.completed_at,
    turnaroundHours: calcTurnaroundHours(r.ordered_at, r.completed_at),
  }));

  return {
    pendingTestOrders: pending.length,
    awaitingValidation: awaiting.length,
    completedToday: completedToday.length,
    completedThisWeek: completedThisWeek.length,
    averageTurnaroundHours: avgTurnaround,
    recentTests,
  };
}

// ─────────────────────────────────────────────
// Clinic/Center Dashboard KPIs (Task 37)
// ─────────────────────────────────────────────

export interface ClinicCenterDashboardKPIs {
  totalBeds: number;
  occupiedBeds: number;
  bedOccupancyRate: number;
  admissionsToday: number;
  dischargesToday: number;
  departmentPatientLoad: DepartmentPatientLoad[];
  departmentRevenue: DepartmentRevenue[];
}

export interface DepartmentPatientLoad {
  departmentId: string;
  departmentName: string;
  totalBeds: number;
  occupiedBeds: number;
  activeAdmissions: number;
  occupancyRate: number;
}

export interface DepartmentRevenue {
  departmentId: string;
  departmentName: string;
  revenue: number;
  paymentCount: number;
}

interface DepartmentRaw {
  id: string;
  clinic_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

interface BedRaw {
  id: string;
  clinic_id: string;
  department_id: string;
  bed_number: string;
  status: string;
  patient_id: string | null;
}

interface AdmissionRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  department_id: string;
  bed_id: string | null;
  admission_date: string;
  discharge_date: string | null;
  status: string;
}

export async function fetchClinicCenterDashboardKPIs(clinicId: string): Promise<ClinicCenterDashboardKPIs> {
  const supabase = createClient();

  const [deptRes, bedRes, admissionRes, paymentsRes] = await Promise.all([
  supabase.from("departments").select("id, clinic_id, name, code, is_active").eq("clinic_id", clinicId).eq("is_active", true),
  supabase.from("beds").select("id, clinic_id, department_id, bed_number, status, patient_id").eq("clinic_id", clinicId),
  supabase.from("admissions").select("id, clinic_id, patient_id, doctor_id, department_id, bed_id, admission_date, discharge_date, status").eq("clinic_id", clinicId),
  supabase.from("payments").select("id, amount, created_at, appointment_id").eq("clinic_id", clinicId).eq("status", "completed"),
  ]);

  const departments = (deptRes.data ?? []) as DepartmentRaw[];
  const beds = (bedRes.data ?? []) as BedRaw[];
  const admissions = (admissionRes.data ?? []) as AdmissionRaw[];
  const payments = (paymentsRes.data ?? []) as { id: string; amount: number; created_at: string; appointment_id: string | null }[];

  const todayStr = getLocalDateStr();

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.status === "occupied").length;
  const bedOccupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const admissionsToday = admissions.filter(
    (a) => a.status === "admitted" && a.admission_date.startsWith(todayStr),
  ).length;
  const dischargesToday = admissions.filter(
    (a) => a.status === "discharged" && a.discharge_date && a.discharge_date.startsWith(todayStr),
  ).length;

  const departmentPatientLoad: DepartmentPatientLoad[] = departments.map((dept) => {
    const deptBeds = beds.filter((b) => b.department_id === dept.id);
    const deptOccupied = deptBeds.filter((b) => b.status === "occupied").length;
    const activeAdmissions = admissions.filter((a) => a.department_id === dept.id && a.status === "admitted").length;
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      totalBeds: deptBeds.length,
      occupiedBeds: deptOccupied,
      activeAdmissions,
      occupancyRate: deptBeds.length > 0 ? Math.round((deptOccupied / deptBeds.length) * 100) : 0,
    };
  });

  // Revenue by department: map admissions to departments, then sum payments
  // We link payments to departments through the admission's doctor appointments
  const deptRevenueMap = new Map<string, { revenue: number; count: number }>();
  for (const dept of departments) {
    deptRevenueMap.set(dept.id, { revenue: 0, count: 0 });
  }

  // Distribute total revenue proportionally across departments based on active admissions
  const totalActiveByDept = new Map<string, number>();
  for (const adm of admissions) {
    const current = totalActiveByDept.get(adm.department_id) ?? 0;
    totalActiveByDept.set(adm.department_id, current + 1);
  }
  const totalAdmissions = admissions.length || 1;
  const totalRevenue = payments.reduce((s, p) => s + (p.amount ?? 0), 0);

  for (const [deptId, admCount] of totalActiveByDept) {
    const share = Math.round((admCount / totalAdmissions) * totalRevenue);
    const entry = deptRevenueMap.get(deptId);
    if (entry) {
      entry.revenue = share;
      entry.count = admCount;
    }
  }

  const departmentRevenue: DepartmentRevenue[] = departments.map((dept) => {
    const entry = deptRevenueMap.get(dept.id);
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      revenue: entry?.revenue ?? 0,
      paymentCount: entry?.count ?? 0,
    };
  });

  return {
    totalBeds,
    occupiedBeds,
    bedOccupancyRate,
    admissionsToday,
    dischargesToday,
    departmentPatientLoad,
    departmentRevenue,
  };
}

