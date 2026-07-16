"use server";

import { createTenantClient } from "@/lib/supabase-server";

export interface WorkingHoursDoctor {
  id: string;
  name: string;
}

export interface DaySchedule {
  open: string;
  close: string;
  enabled: boolean;
}

export type DoctorSchedules = Record<string, Record<string, DaySchedule>>;

export async function fetchWorkingHoursData(
  clinicId: string,
): Promise<{ doctors: WorkingHoursDoctor[]; doctorSchedules: DoctorSchedules }> {
  const supabase = await createTenantClient(clinicId);

  const [{ data: users, error: usersError }, { data: clinic, error: clinicError }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, name, role")
        .eq("clinic_id", clinicId)
        .eq("role", "doctor")
        .order("name", { ascending: true }),
      supabase.from("clinics").select("config").eq("id", clinicId).single(),
    ]);

  if (usersError) throw new Error(`Failed to load doctors: ${usersError.message}`);
  if (clinicError) throw new Error(`Failed to load clinic config: ${clinicError.message}`);

  const doctors = ((users ?? []) as { id: string; name: string }[]).map((u) => ({
    id: u.id,
    name: u.name,
  }));

  const cfg = (clinic?.config ?? {}) as Record<string, unknown>;
  const doctorSchedules = (cfg.doctorSchedules ?? {}) as DoctorSchedules;

  return { doctors, doctorSchedules };
}
