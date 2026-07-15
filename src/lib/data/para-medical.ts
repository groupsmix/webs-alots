import { fetchUserNameMap } from "@/lib/data/users";
import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";
import type {
  BodyMeasurement,
  PhysioSession,
  ProgressPhoto,
  SpeechProgressReport,
  SpeechSession,
  TherapySessionNote,
} from "@/lib/types/para-medical";

export async function fetchBodyMeasurements(clinicId: string): Promise<BodyMeasurement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("measurement_date", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load body measurements: ${error.message}`);
  }

  return (data ?? []).map((row: Tables<"body_measurements">) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    measurement_date: row.measurement_date,
    weight_kg: row.weight_kg,
    height_cm: row.height_cm,
    bmi: row.bmi,
    body_fat_pct: row.body_fat_pct,
    waist_cm: row.waist_cm,
    hip_cm: row.hip_cm,
    chest_cm: row.chest_cm,
    arm_cm: row.arm_cm,
    thigh_cm: row.thigh_cm,
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export async function fetchPhysioSessions(clinicId: string): Promise<PhysioSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("physio_sessions")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("session_date", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load physio sessions: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"physio_sessions">[];
  const nameMap = await fetchUserNameMap(
    supabase,
    clinicId,
    rows.flatMap((r) => [r.patient_id, r.therapist_id]),
  );

  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: nameMap.get(row.patient_id) ?? "Inconnu",
    therapist_id: row.therapist_id,
    program_id: row.program_id,
    session_date: row.session_date,
    duration_minutes: row.duration_minutes,
    attended: row.attended,
    progress_notes: row.progress_notes,
    pain_level_before: row.pain_level_before,
    pain_level_after: row.pain_level_after,
    exercises_completed: (row.exercises_completed as string[] | null) ?? [],
    created_at: row.created_at,
  }));
}

export async function fetchProgressPhotos(clinicId: string): Promise<ProgressPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("progress_photos")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("photo_date", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load progress photos: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"progress_photos">[];
  const nameMap = await fetchUserNameMap(
    supabase,
    clinicId,
    rows.map((r) => r.patient_id),
  );

  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: nameMap.get(row.patient_id) ?? "Inconnu",
    photo_url: row.photo_url,
    photo_date: row.photo_date,
    category: row.category ?? "general",
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export async function fetchTherapySessionNotes(clinicId: string): Promise<TherapySessionNote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("therapy_session_notes")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("session_date", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load therapy session notes: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"therapy_session_notes">[];
  const nameMap = await fetchUserNameMap(
    supabase,
    clinicId,
    rows.flatMap((r) => [r.patient_id, r.therapist_id]),
  );

  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: nameMap.get(row.patient_id) ?? "Inconnu",
    therapist_id: row.therapist_id,
    session_date: row.session_date,
    session_number: row.session_number,
    duration_minutes: row.duration_minutes,
    session_type: row.session_type as TherapySessionNote["session_type"],
    mood_rating: row.mood_rating,
    presenting_issues: row.presenting_issues,
    interventions: row.interventions,
    observations: row.observations,
    homework: row.homework,
    is_confidential: row.is_confidential,
    risk_assessment: row.risk_assessment as TherapySessionNote["risk_assessment"],
    next_session_date: row.next_session_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function fetchSpeechProgressReports(
  clinicId: string,
): Promise<SpeechProgressReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("speech_progress_reports")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("report_date", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load speech progress reports: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"speech_progress_reports">[];
  const nameMap = await fetchUserNameMap(
    supabase,
    clinicId,
    rows.flatMap((r) => [r.patient_id, r.therapist_id]),
  );

  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: nameMap.get(row.patient_id) ?? "Inconnu",
    therapist_id: row.therapist_id,
    therapist_name: nameMap.get(row.therapist_id) ?? "Inconnu",
    report_date: row.report_date,
    period_start: row.period_start,
    period_end: row.period_end,
    goals_summary: row.goals_summary,
    progress_summary: row.progress_summary,
    areas_of_improvement: (row.areas_of_improvement as string[] | null) ?? [],
    areas_of_concern: (row.areas_of_concern as string[] | null) ?? [],
    recommendations: row.recommendations,
    next_steps: row.next_steps,
    overall_progress: row.overall_progress as SpeechProgressReport["overall_progress"],
    created_at: row.created_at,
  }));
}

export async function fetchSpeechSessions(clinicId: string): Promise<SpeechSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("speech_sessions")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("session_date", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load speech sessions: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"speech_sessions">[];
  const nameMap = await fetchUserNameMap(
    supabase,
    clinicId,
    rows.map((r) => r.patient_id),
  );

  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: nameMap.get(row.patient_id) ?? "Inconnu",
    therapist_id: row.therapist_id,
    session_date: row.session_date,
    duration_minutes: row.duration_minutes,
    attended: row.attended,
    exercises_assigned: (row.exercises_assigned as string[] | null) ?? [],
    exercises_completed: (row.exercises_completed as string[] | null) ?? [],
    accuracy_pct: row.accuracy_pct,
    notes: row.notes,
    home_practice: row.home_practice,
    created_at: row.created_at,
  }));
}
