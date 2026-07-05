import type { SuperAdminClient } from "@/lib/super-admin/base";
import type { CreateServiceInput, ServiceRow, TimeSlotRow } from "@/lib/super-admin/models";

export async function createServiceImpl(
  supabase: SuperAdminClient,
  input: CreateServiceInput,
): Promise<ServiceRow> {
  const { data, error } = await supabase
    .from("services")
    .insert({
      clinic_id: input.clinic_id,
      name: input.name,
      price: input.price ?? null,
      duration_minutes: input.duration_minutes,
      category: input.category ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create service: ${error.message}`);
  return data as ServiceRow;
}

export async function createTimeSlotsForDoctorImpl(
  supabase: SuperAdminClient,
  doctorId: string,
  clinicId: string,
  slots: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    max_capacity?: number;
    buffer_minutes?: number;
  }[],
): Promise<TimeSlotRow[]> {
  const rows = slots.map((slot) => ({
    doctor_id: doctorId,
    clinic_id: clinicId,
    day_of_week: slot.day_of_week,
    start_time: slot.start_time,
    end_time: slot.end_time,
    is_available: true,
    max_capacity: slot.max_capacity ?? 1,
    buffer_minutes: slot.buffer_minutes ?? 10,
  }));

  const { data, error } = await supabase.from("time_slots").insert(rows).select();

  if (error) throw new Error(`Failed to create time slots: ${error.message}`);
  return (data ?? []) as TimeSlotRow[];
}
