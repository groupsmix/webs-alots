"use client";

import { fetchRows } from "./_core";

// ─────────────────────────────────────────────
// Users / Doctors / Patients
// ─────────────────────────────────────────────

export interface DoctorView {
  id: string;
  name: string;
  specialtyId: string;
  specialty: string;
  phone: string;
  email: string;
  avatar?: string;
  consultationFee: number;
  languages: string[];
}

export interface PatientView {
  id: string;
  name: string;
  phone: string;
  email: string;
  age: number;
  gender: "M" | "F";
  dateOfBirth: string;
  allergies?: string[];
  insurance?: string;
  registeredAt: string;
}

interface UserRaw {
  id: string;
  auth_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  clinic_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mapDoctor(raw: UserRaw): DoctorView {
  const meta = raw.metadata ?? {};
  return {
    id: raw.id,
    name: raw.name,
    specialtyId: (meta.specialty_id as string) ?? "",
    specialty: (meta.specialty as string) ?? "",
    phone: raw.phone ?? "",
    email: raw.email ?? "",
    avatar: raw.avatar_url ?? undefined,
    consultationFee: (meta.consultation_fee as number) ?? 0,
    languages: (meta.languages as string[]) ?? [],
  };
}

function mapPatient(raw: UserRaw): PatientView {
  const meta = raw.metadata ?? {};
  const dob = (meta.date_of_birth as string) ?? "";
  let age = 0;
  if (dob) {
    const diff = Date.now() - new Date(dob).getTime();
    age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  }
  return {
    id: raw.id,
    name: raw.name,
    phone: raw.phone ?? "",
    email: raw.email ?? "",
    age: (meta.age as number) ?? age,
    gender: ((meta.gender as string) ?? "M") as "M" | "F",
    dateOfBirth: dob,
    allergies: (meta.allergies as string[]) ?? undefined,
    insurance: (meta.insurance as string) ?? undefined,
    registeredAt: raw.created_at?.split("T")[0] ?? "",
  };
}

export async function fetchDoctors(clinicId: string): Promise<DoctorView[]> {
  const rows = await fetchRows<UserRaw>("users", {
    eq: [["clinic_id", clinicId], ["role", "doctor"]],
    order: ["name", { ascending: true }],
    tenantClinicId: clinicId,
  });
  return rows.map(mapDoctor);
}

export async function fetchPatients(clinicId: string): Promise<PatientView[]> {
  const rows = await fetchRows<UserRaw>("users", {
    eq: [["clinic_id", clinicId], ["role", "patient"]],
    order: ["name", { ascending: true }],
  });
  return rows.map(mapPatient);
}

export async function fetchReceptionists(clinicId: string): Promise<UserRaw[]> {
  return fetchRows<UserRaw>("users", {
    eq: [["clinic_id", clinicId], ["role", "receptionist"]],
    order: ["name", { ascending: true }],
  });
}

