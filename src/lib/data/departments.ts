"use server";

import { createTenantClient } from "@/lib/supabase-server";
import { getLocalDateStr } from "@/lib/utils";

export interface DepartmentManagementView {
  id: string;
  name: string;
  nameAr: string | null;
  headDoctorName: string | null;
  floor: string | null;
  description: string | null;
  doctorCount: number;
  patientCount: number;
  isActive: boolean;
}

export interface DepartmentDashboardStatView {
  id: string;
  name: string;
  doctorCount: number;
  patientCount: number;
  totalBeds: number;
  occupiedBeds: number;
  todayAppointments: number;
  admissionsThisMonth: number;
  dischargesThisMonth: number;
}

export interface DepartmentOverviewView {
  departments: DepartmentManagementView[];
  stats: DepartmentDashboardStatView[];
}

interface DepartmentRow {
  id: string;
  clinic_id: string;
  name: string;
  name_ar: string | null;
  head_doctor_id: string | null;
  description: string | null;
  floor: string | null;
  is_active: boolean;
}

interface DoctorDepartmentRow {
  id: string;
  clinic_id: string;
  department_id: string;
  doctor_id: string;
  is_primary: boolean;
}

interface BedRow {
  id: string;
  clinic_id: string;
  room_id: string;
  department_id: string | null;
  bed_number: string;
  status: string;
  current_patient_id: string | null;
  patient_id: string | null;
  notes: string | null;
  updated_at: string | null;
}

interface AdmissionRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  bed_id: string;
  department_id: string | null;
  admission_date: string;
  discharge_date: string | null;
  status: string;
}

interface AppointmentRow {
  id: string;
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
}

interface UserRow {
  id: string;
  name: string;
}

export async function fetchDepartmentOverview(clinicId: string): Promise<DepartmentOverviewView> {
  const supabase = await createTenantClient(clinicId);
  const monthPrefix = getLocalDateStr().slice(0, 7);

  const [
    { data: departments, error: departmentsError },
    { data: doctorDepartments, error: doctorDepartmentsError },
    { data: beds, error: bedsError },
    { data: admissions, error: admissionsError },
    { data: appointments, error: appointmentsError },
    { data: users, error: usersError },
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("id, clinic_id, name, name_ar, head_doctor_id, description, floor, is_active")
      .eq("clinic_id", clinicId)
      .order("name", { ascending: true }),
    supabase
      .from("doctor_departments")
      .select("id, clinic_id, department_id, doctor_id, is_primary")
      .eq("clinic_id", clinicId),
    supabase
      .from("beds")
      .select(
        "id, clinic_id, room_id, department_id, bed_number, status, current_patient_id, patient_id, notes, updated_at",
      )
      .eq("clinic_id", clinicId),
    supabase
      .from("admissions")
      .select(
        "id, clinic_id, patient_id, bed_id, department_id, admission_date, discharge_date, status",
      )
      .eq("clinic_id", clinicId),
    supabase
      .from("appointments")
      .select("id, clinic_id, doctor_id, patient_id, appointment_date")
      .eq("clinic_id", clinicId)
      .eq("appointment_date", getLocalDateStr())
      .order("start_time", { ascending: true }),
    supabase.from("users").select("id, name").eq("clinic_id", clinicId),
  ]);

  if (
    departmentsError ||
    doctorDepartmentsError ||
    bedsError ||
    admissionsError ||
    appointmentsError ||
    usersError
  ) {
    throw new Error("Failed to load department overview");
  }

  const userMap = new Map<string, string>();
  for (const user of (users ?? []) as UserRow[]) {
    userMap.set(user.id, user.name);
  }

  const departmentsRaw = (departments ?? []) as DepartmentRow[];
  const doctorDepartmentsRaw = (doctorDepartments ?? []) as DoctorDepartmentRow[];
  const bedsRaw = (beds ?? []) as BedRow[];
  const admissionsRaw = (admissions ?? []) as AdmissionRow[];
  const appointmentsRaw = (appointments ?? []) as AppointmentRow[];

  const departmentsView: DepartmentManagementView[] = departmentsRaw.map((dept) => {
    const assignedDoctorIds = new Set(
      doctorDepartmentsRaw
        .filter((row) => row.department_id === dept.id)
        .map((row) => row.doctor_id),
    );
    if (dept.head_doctor_id) assignedDoctorIds.add(dept.head_doctor_id);

    const patientIds = new Set<string>();
    for (const admission of admissionsRaw) {
      if (admission.department_id === dept.id) patientIds.add(admission.patient_id);
    }
    for (const appointment of appointmentsRaw) {
      if (assignedDoctorIds.has(appointment.doctor_id)) patientIds.add(appointment.patient_id);
    }

    return {
      id: dept.id,
      name: dept.name,
      nameAr: dept.name_ar,
      headDoctorName: dept.head_doctor_id ? (userMap.get(dept.head_doctor_id) ?? null) : null,
      floor: dept.floor,
      description: dept.description,
      doctorCount: assignedDoctorIds.size,
      patientCount: patientIds.size,
      isActive: dept.is_active,
    } satisfies DepartmentManagementView;
  });

  const stats: DepartmentDashboardStatView[] = departmentsView.map((dept) => {
    const deptDoctorIds = new Set(
      doctorDepartmentsRaw
        .filter((row) => row.department_id === dept.id)
        .map((row) => row.doctor_id),
    );
    const deptBeds = bedsRaw.filter((bed) => bed.department_id === dept.id);
    const deptAdmissions = admissionsRaw.filter((admission) => admission.department_id === dept.id);
    const patientIds = new Set<string>(deptAdmissions.map((admission) => admission.patient_id));
    const todayAppointmentsCount = appointmentsRaw.filter((appointment) => {
      if (!deptDoctorIds.has(appointment.doctor_id)) return false;
      patientIds.add(appointment.patient_id);
      return true;
    }).length;

    return {
      id: dept.id,
      name: dept.name,
      doctorCount: dept.doctorCount,
      patientCount: patientIds.size,
      totalBeds: deptBeds.length,
      occupiedBeds: deptBeds.filter((bed) => bed.status === "occupied").length,
      todayAppointments: todayAppointmentsCount,
      admissionsThisMonth: deptAdmissions.filter((admission) =>
        admission.admission_date.startsWith(monthPrefix),
      ).length,
      dischargesThisMonth: deptAdmissions.filter(
        (admission) => admission.discharge_date?.startsWith(monthPrefix) ?? false,
      ).length,
    } satisfies DepartmentDashboardStatView;
  });

  return { departments: departmentsView, stats };
}
