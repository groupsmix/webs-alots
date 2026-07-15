import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import type { Database } from "@/lib/types/database";
import type { SpeechSession } from "@/lib/types/para-medical";

type SpeechSessionRow = Database["public"]["Tables"]["speech_sessions"]["Row"];

export async function getSpeechSessions(clinicId: string): Promise<SpeechSession[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("speech_sessions")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("session_date", { ascending: false })
    .limit(1000);

  if (error) {
    throw error;
  }

  const userIds = new Set<string>();
  for (const row of rows ?? []) {
    userIds.add(row.patient_id);
    if (row.therapist_id) userIds.add(row.therapist_id);
  }

  const userMap = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .in("id", Array.from(userIds));
    if (userError) {
      logger.warn("Failed to load user names for speech sessions", {
        context: "speech-therapy/data",
        clinicId,
        error: userError,
      });
    } else {
      for (const user of users ?? []) {
        userMap.set(user.id, user.name ?? "");
      }
    }
  }

  return (rows ?? []).map((row: SpeechSessionRow) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: userMap.get(row.patient_id) ?? "",
    therapist_id: row.therapist_id,
    session_date: row.session_date,
    duration_minutes: row.duration_minutes,
    attended: row.attended,
    exercises_assigned: (row.exercises_assigned ?? []) as string[],
    exercises_completed: (row.exercises_completed ?? []) as string[],
    accuracy_pct: row.accuracy_pct,
    notes: row.notes,
    home_practice: row.home_practice,
    created_at: row.created_at,
  }));
}
