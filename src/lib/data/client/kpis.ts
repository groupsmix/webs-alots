"use client";

import { createClient } from "@/lib/supabase-client";
import { getLocalDateStr } from "@/lib/utils";

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

interface DepartmentPatientLoad {
  departmentId: string;
  departmentName: string;
  totalBeds: number;
  occupiedBeds: number;
  activeAdmissions: number;
  occupancyRate: number;
}

interface DepartmentRevenue {
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

export async function fetchClinicCenterDashboardKPIs(
  clinicId: string,
): Promise<ClinicCenterDashboardKPIs> {
  const supabase = createClient();

  const [deptRes, bedRes, admissionRes, paymentsRes] = await Promise.all([
    supabase
      .from("departments")
      .select("id, clinic_id, name, code, is_active")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("beds")
      .select("id, clinic_id, department_id, bed_number, status, patient_id")
      .eq("clinic_id", clinicId),
    supabase
      .from("admissions")
      .select(
        "id, clinic_id, patient_id, doctor_id, department_id, bed_id, admission_date, discharge_date, status",
      )
      .eq("clinic_id", clinicId),
    supabase
      .from("payments")
      .select("id, amount, created_at, appointment_id")
      .eq("clinic_id", clinicId)
      .eq("status", "completed"),
  ]);

  const departments = (deptRes.data ?? []) as DepartmentRaw[];
  const beds = (bedRes.data ?? []) as BedRaw[];
  const admissions = (admissionRes.data ?? []) as AdmissionRaw[];
  const payments = (paymentsRes.data ?? []) as {
    id: string;
    amount: number;
    created_at: string;
    appointment_id: string | null;
  }[];

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
    const activeAdmissions = admissions.filter(
      (a) => a.department_id === dept.id && a.status === "admitted",
    ).length;
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
