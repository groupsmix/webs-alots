"use server";

import { createTenantClient } from "@/lib/supabase-server";

export interface ReceptionistView {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

interface UserRow {
  id: string;
  clinic_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export async function fetchReceptionists(clinicId: string): Promise<ReceptionistView[]> {
  const supabase = await createTenantClient(clinicId);

  const { data, error } = await supabase
    .from("users")
    .select("id, clinic_id, name, phone, email, is_active, created_at")
    .eq("clinic_id", clinicId)
    .eq("role", "receptionist")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load receptionists: ${error.message}`);

  return ((data ?? []) as unknown as UserRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    active: row.is_active ?? true,
    createdAt: row.created_at?.split("T")[0] ?? "",
  }));
}
