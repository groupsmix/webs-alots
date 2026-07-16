"use server";

import { createTenantClient } from "@/lib/supabase-server";

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
  active: boolean;
}

interface UserRow {
  id: string;
  clinic_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export async function fetchDoctors(clinicId: string): Promise<DoctorView[]> {
  const supabase = await createTenantClient(clinicId);

  const { data, error } = await supabase
    .from("users")
    .select("id, clinic_id, name, phone, email, avatar_url, is_active, metadata")
    .eq("clinic_id", clinicId)
    .eq("role", "doctor")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load doctors: ${error.message}`);

  return ((data ?? []) as unknown as UserRow[]).map((row) => {
    const meta = row.metadata ?? {};
    return {
      id: row.id,
      name: row.name,
      specialtyId: (meta.specialty_id as string) ?? "",
      specialty: (meta.specialty as string) ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      avatar: row.avatar_url ?? undefined,
      consultationFee: (meta.consultation_fee as number) ?? 0,
      languages: (meta.languages as string[]) ?? [],
      active: row.is_active ?? true,
    };
  });
}
