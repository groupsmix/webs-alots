"use server";

import { createTenantClient } from "@/lib/supabase-server";

export interface BedManagementBedView {
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

interface DepartmentRow {
  id: string;
  clinic_id: string;
  name: string;
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

interface UserRow {
  id: string;
  clinic_id: string;
  name: string;
}

function byNumericOrText(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export async function fetchBedManagementRooms(clinicId: string): Promise<BedManagementRoomView[]> {
  const supabase = await createTenantClient(clinicId);

  const [
    { data: rooms, error: roomsError },
    { data: beds, error: bedsError },
    { data: departments, error: departmentsError },
    { data: admissions, error: admissionsError },
    { data: users, error: usersError },
  ] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, clinic_id, department_id, room_number, room_type, floor, total_beds, is_active")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("beds")
      .select(
        "id, clinic_id, room_id, department_id, bed_number, status, current_patient_id, patient_id, notes, updated_at",
      )
      .eq("clinic_id", clinicId),
    supabase.from("departments").select("id, clinic_id, name").eq("clinic_id", clinicId),
    supabase
      .from("admissions")
      .select(
        "id, clinic_id, patient_id, bed_id, department_id, admission_date, discharge_date, status",
      )
      .eq("clinic_id", clinicId),
    supabase.from("users").select("id, clinic_id, name").eq("clinic_id", clinicId),
  ]);

  if (roomsError || bedsError || departmentsError || admissionsError || usersError) {
    throw new Error("Failed to load bed management data");
  }

  const departmentMap = new Map<string, string>();
  for (const department of (departments ?? []) as DepartmentRow[]) {
    departmentMap.set(department.id, department.name);
  }

  const userMap = new Map<string, string>();
  for (const user of (users ?? []) as UserRow[]) {
    userMap.set(user.id, user.name);
  }

  const activeAdmissionByBed = new Map<string, AdmissionRow>();
  for (const admission of [...((admissions ?? []) as AdmissionRow[])].sort((a, b) =>
    b.admission_date.localeCompare(a.admission_date),
  )) {
    if (activeAdmissionByBed.has(admission.bed_id)) continue;
    if (admission.status === "discharged") continue;
    activeAdmissionByBed.set(admission.bed_id, admission);
  }

  return [...((rooms ?? []) as RoomRow[])]
    .sort((a, b) => byNumericOrText(a.room_number, b.room_number))
    .map((room) => {
      const roomBeds = ((beds as BedRow[]) ?? [])
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
            patientName: patientId ? (userMap.get(patientId) ?? null) : null,
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
