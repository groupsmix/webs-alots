"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTenantClient } from "@/lib/supabase-server";

export interface HolidayView {
  id: string;
  name: string;
  date: string;
  type: "national" | "clinic" | "doctor";
  recurring: boolean;
}

interface HolidayRow {
  id: string;
  clinic_id: string;
  title: string;
  start_date: string;
  type: string;
  recurring: boolean;
}

export async function fetchHolidays(clinicId: string): Promise<HolidayView[]> {
  const supabase = await createTenantClient(clinicId);
  // clinic_holidays.{type,recurring} columns (migration 00192) are not yet in
  // the generated DB types. Query through the untyped client shape.
  const untyped = supabase as unknown as SupabaseClient;

  const { data, error } = await untyped
    .from("clinic_holidays")
    .select("id, clinic_id, title, start_date, type, recurring")
    .eq("clinic_id", clinicId)
    .order("start_date", { ascending: true });

  if (error) throw new Error(`Failed to load holidays: ${error.message}`);

  return ((data ?? []) as HolidayRow[]).map((row) => ({
    id: row.id,
    name: row.title,
    date: row.start_date,
    type: (row.type ?? "clinic") as HolidayView["type"],
    recurring: row.recurring ?? false,
  }));
}

export async function createHoliday(
  clinicId: string,
  data: { name: string; date: string; type: string; recurring: boolean },
): Promise<{ id: string }> {
  const supabase = await createTenantClient(clinicId);
  const untyped = supabase as unknown as SupabaseClient;

  const { data: row, error } = await untyped
    .from("clinic_holidays")
    .insert({
      clinic_id: clinicId,
      title: data.name,
      start_date: data.date,
      end_date: data.date,
      type: data.type,
      recurring: data.recurring,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create holiday: ${error.message}`);
  return { id: (row as { id: string }).id };
}

export async function deleteHoliday(clinicId: string, id: string): Promise<void> {
  const supabase = await createTenantClient(clinicId);

  const { error } = await supabase
    .from("clinic_holidays")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to delete holiday: ${error.message}`);
}
