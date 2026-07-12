"use client";

import { getLocalDateStr } from "@/lib/utils";
import { ensureLookups, fetchRows, _activeUserMap } from "./_core";
import { fetchTodayAppointments } from "./appointments";

interface DepartmentManagementView {
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

interface DepartmentDashboardStatView {
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

interface BedManagementBedView {
  id: string;
  bedNumber: string;
  status: "available" | "occupied" | "maintenance" | "reserved";
  patientName: string | null;
  admissionDate: string | null;
}

export interface BedManagementRoomView {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: string | null;
  departmentName: string | null;
  totalBeds: number;
  beds: BedManagementBedView[];
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

interface RoomRow {
  id: string;
  clinic_id: string;
  department_id: string | null;
  room_number: string;
  room_type: string;
  floor: string | null;
  total_beds: number;
  is_active: boolean;
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

function byNumericOrText(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export async function fetchDepartmentOverview(clinicId: string): Promise<DepartmentOverviewView> {
  await ensureLookups(clinicId);

  const monthPrefix = getLocalDateStr().slice(0, 7);
  const [departments, doctorDepartments, beds, admissions, todayAppointments] = await Promise.all([
    fetchRows<DepartmentRow>("departments", {
      eq: [["clinic_id", clinicId]],
      order: ["name", { ascending: true }],
      tenantClinicId: clinicId,
    }),
    fetchRows<DoctorDepartmentRow>("doctor_departments", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<BedRow>("beds", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<AdmissionRow>("admissions", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchTodayAppointments(clinicId),
  ]);

  const departmentsView = departments.map((dept) => {
    const assignedDoctorIds = new Set(
      doctorDepartments.filter((row) => row.department_id === dept.id).map((row) => row.doctor_id),
    );
    if (dept.head_doctor_id) assignedDoctorIds.add(dept.head_doctor_id);

    const patientIds = new Set<string>();
    for (const admission of admissions) {
      if (admission.department_id === dept.id) patientIds.add(admission.patient_id);
    }
    for (const appointment of todayAppointments) {
      if (assignedDoctorIds.has(appointment.doctorId)) patientIds.add(appointment.patientId);
    }

    return {
      id: dept.id,
      name: dept.name,
      nameAr: dept.name_ar,
      headDoctorName: dept.head_doctor_id
        ? (_activeUserMap?.get(dept.head_doctor_id)?.name ?? null)
        : null,
      floor: dept.floor,
      description: dept.description,
      doctorCount: assignedDoctorIds.size,
      patientCount: patientIds.size,
      isActive: dept.is_active,
    } satisfies DepartmentManagementView;
  });

  const stats = departmentsView.map((dept) => {
    const deptDoctorIds = new Set(
      doctorDepartments.filter((row) => row.department_id === dept.id).map((row) => row.doctor_id),
    );
    const deptBeds = beds.filter((bed) => bed.department_id === dept.id);
    const deptAdmissions = admissions.filter((admission) => admission.department_id === dept.id);
    const patientIds = new Set<string>(deptAdmissions.map((admission) => admission.patient_id));
    const todayAppointmentsCount = todayAppointments.filter((appointment) => {
      if (!deptDoctorIds.has(appointment.doctorId)) return false;
      patientIds.add(appointment.patientId);
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

export async function fetchBedManagementRooms(clinicId: string): Promise<BedManagementRoomView[]> {
  await ensureLookups(clinicId);
  const [rooms, beds, departments, admissions] = await Promise.all([
    fetchRows<RoomRow>("rooms", {
      eq: [
        ["clinic_id", clinicId],
        ["is_active", true],
      ],
      tenantClinicId: clinicId,
    }),
    fetchRows<BedRow>("beds", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<DepartmentRow>("departments", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<AdmissionRow>("admissions", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
  ]);

  const departmentMap = new Map(departments.map((department) => [department.id, department.name]));
  const activeAdmissionByBed = new Map<string, AdmissionRow>();
  for (const admission of [...admissions].sort((a, b) =>
    b.admission_date.localeCompare(a.admission_date),
  )) {
    if (activeAdmissionByBed.has(admission.bed_id)) continue;
    if (admission.status === "discharged") continue;
    activeAdmissionByBed.set(admission.bed_id, admission);
  }

  return [...rooms]
    .sort((a, b) => byNumericOrText(a.room_number, b.room_number))
    .map((room) => {
      const roomBeds = beds
        .filter((bed) => bed.room_id === room.id)
        .sort((a, b) => byNumericOrText(a.bed_number, b.bed_number))
        .map((bed) => {
          const activeAdmission = activeAdmissionByBed.get(bed.id);
          const patientId =
            bed.current_patient_id ?? bed.patient_id ?? activeAdmission?.patient_id ?? null;
          return {
            id: bed.id,
            bedNumber: bed.bed_number,
            status: (bed.status ?? "available") as BedManagementBedView["status"],
            patientName: patientId ? (_activeUserMap?.get(patientId)?.name ?? null) : null,
            admissionDate: activeAdmission?.admission_date?.split("T")[0] ?? null,
          } satisfies BedManagementBedView;
        });

      return {
        id: room.id,
        roomNumber: room.room_number,
        roomType: room.room_type,
        floor: room.floor,
        departmentName: room.department_id ? (departmentMap.get(room.department_id) ?? null) : null,
        totalBeds: room.total_beds,
        beds: roomBeds,
      } satisfies BedManagementRoomView;
    });
}
