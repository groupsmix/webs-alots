"use client";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";
import { getLocalDateStr } from "@/lib/utils";
import type {
  BodyMeasurement,
  Exercise,
  ExerciseProgram,
  FrameCatalogItem,
  LensInventoryItem,
  MealItem,
  MealPlan,
  OpticalPrescription,
  ProgressPhoto,
  PhysioSession,
  SpeechExercise,
  SpeechProgressReport,
  SpeechSession,
  TherapyGoal,
  TherapyPlan,
  TherapySessionNote,
} from "@/lib/types/para-medical";
import { ensureLookups, fetchRows, _activeUserMap } from "./_core";

type MealSlot = "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner";

type MealDay = {
  day: string;
  breakfast: MealItem[];
  morning_snack: MealItem[];
  lunch: MealItem[];
  afternoon_snack: MealItem[];
  dinner: MealItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
};

interface ExerciseProgramRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  title: string;
  exercises: Exercise[] | null;
  frequency: string;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PhysioSessionRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  program_id: string | null;
  session_date: string;
  duration_minutes: number;
  attended: boolean;
  progress_notes: string | null;
  pain_level_before: number | null;
  pain_level_after: number | null;
  exercises_completed: string[] | null;
  created_at: string;
}

interface ProgressPhotoRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  photo_url: string;
  photo_date: string;
  category: string | null;
  notes: string | null;
  created_at: string;
}

interface MealPlanRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  nutritionist_id: string;
  title: string;
  type: string;
  daily_plans: MealDay[] | null;
  target_calories: number | null;
  notes: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface BodyMeasurementRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  measurement_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
  created_at: string;
}

interface TherapySessionNoteRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  session_date: string;
  session_number: number;
  duration_minutes: number;
  session_type: string;
  mood_rating: number | null;
  presenting_issues: string | null;
  interventions: string | null;
  observations: string | null;
  homework: string | null;
  is_confidential: boolean;
  risk_assessment: string | null;
  next_session_date: string | null;
  created_at: string;
  updated_at: string;
}

interface TherapyPlanRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  diagnosis: string | null;
  treatment_approach: string;
  goals: TherapyGoal[] | null;
  start_date: string;
  review_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SpeechExerciseRaw {
  id: string;
  clinic_id: string;
  name: string;
  category: string;
  description: string;
  difficulty: string;
  target_sounds: string[] | null;
  instructions: string;
  materials_needed: string | null;
  duration_minutes: number;
}

interface SpeechSessionRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  session_date: string;
  duration_minutes: number;
  attended: boolean;
  exercises_assigned: string[] | null;
  exercises_completed: string[] | null;
  accuracy_pct: number | null;
  notes: string | null;
  home_practice: string | null;
  created_at: string;
}

interface SpeechProgressReportRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  therapist_id: string;
  report_date: string;
  period_start: string;
  period_end: string;
  goals_summary: string;
  progress_summary: string;
  areas_of_improvement: string[] | null;
  areas_of_concern: string[] | null;
  recommendations: string;
  next_steps: string;
  overall_progress: string;
  created_at: string;
}

interface LensInventoryRaw {
  id: string;
  clinic_id: string;
  type: string;
  material: string;
  coating: string | null;
  power_range: string;
  stock_quantity: number;
  min_threshold: number;
  unit_cost: number;
  selling_price: number;
  supplier: string;
  created_at: string;
  updated_at: string;
}

interface FrameCatalogRaw {
  id: string;
  clinic_id: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  material: string;
  frame_type: string;
  gender: string;
  price: number;
  cost_price: number;
  stock_quantity: number;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface OpticalPrescriptionRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  ophthalmologist_name: string | null;
  prescription_date: string;
  expiry_date: string | null;
  right_eye: OpticalPrescription["right_eye"];
  left_eye: OpticalPrescription["left_eye"];
  notes: string | null;
  frame_id: string | null;
  lens_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function patientName(patientId: string, fallback = "Patient") {
  return _activeUserMap?.get(patientId)?.name ?? fallback;
}

function therapistName(therapistId: string, fallback = "Staff") {
  return _activeUserMap?.get(therapistId)?.name ?? fallback;
}

function recalculateMealDay(day: MealDay): MealDay {
  const slots: MealSlot[] = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"];
  const totals = slots.reduce(
    (acc, slot) => {
      for (const item of day[slot] ?? []) {
        acc.calories += item.calories ?? 0;
        acc.protein += item.protein_g ?? 0;
        acc.carbs += item.carbs_g ?? 0;
        acc.fat += item.fat_g ?? 0;
      }
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    ...day,
    total_calories: totals.calories,
    total_protein: totals.protein,
    total_carbs: totals.carbs,
    total_fat: totals.fat,
  };
}

function updateGoalProgress(goal: TherapyGoal): TherapyGoal {
  const completedMilestones = goal.milestones.filter((milestone) => milestone.completed).length;
  const milestoneProgress =
    goal.milestones.length > 0 ? Math.round((completedMilestones / goal.milestones.length) * 100) : 0;
  const progress_pct =
    goal.status === "achieved"
      ? 100
      : goal.status === "not_started"
        ? 0
        : Math.max(goal.progress_pct ?? 0, milestoneProgress, goal.status === "in_progress" ? 25 : 0);

  return { ...goal, progress_pct };
}

export async function fetchExercisePrograms(clinicId: string): Promise<ExerciseProgram[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<ExerciseProgramRaw>("exercise_programs", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: patientName(row.patient_id),
    therapist_id: row.therapist_id,
    therapist_name: therapistName(row.therapist_id),
    title: row.title,
    exercises: row.exercises ?? [],
    frequency: row.frequency,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status as ExerciseProgram["status"],
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function fetchPhysioSessions(clinicId: string): Promise<PhysioSession[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PhysioSessionRaw>("physio_sessions", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: patientName(row.patient_id),
    therapist_id: row.therapist_id,
    program_id: row.program_id,
    session_date: row.session_date,
    duration_minutes: row.duration_minutes,
    attended: row.attended,
    progress_notes: row.progress_notes,
    pain_level_before: row.pain_level_before,
    pain_level_after: row.pain_level_after,
    exercises_completed: row.exercises_completed ?? [],
    created_at: row.created_at,
  }));
}

export async function fetchProgressPhotos(clinicId: string): Promise<ProgressPhoto[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<ProgressPhotoRaw>("progress_photos", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: patientName(row.patient_id),
    photo_url: row.photo_url,
    photo_date: row.photo_date,
    category: row.category ?? "general",
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export async function fetchMealPlans(clinicId: string): Promise<MealPlan[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<MealPlanRaw>("meal_plans", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: patientName(row.patient_id),
    nutritionist_id: row.nutritionist_id,
    nutritionist_name: therapistName(row.nutritionist_id, "Nutritionist"),
    title: row.title,
    type: row.type as MealPlan["type"],
    daily_plans: row.daily_plans ?? [],
    target_calories: row.target_calories ?? 0,
    notes: row.notes,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status as MealPlan["status"],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function fetchBodyMeasurements(clinicId: string): Promise<BodyMeasurement[]> {
  const rows = await fetchRows<BodyMeasurementRaw>("body_measurements", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
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

export async function fetchTherapySessionNotes(clinicId: string): Promise<TherapySessionNote[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<TherapySessionNoteRaw>("therapy_session_notes", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: patientName(row.patient_id),
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

export async function fetchTherapyPlans(clinicId: string): Promise<TherapyPlan[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<TherapyPlanRaw>("therapy_plans", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: patientName(row.patient_id),
    therapist_id: row.therapist_id,
    therapist_name: therapistName(row.therapist_id, "Therapist"),
    diagnosis: row.diagnosis,
    treatment_approach: row.treatment_approach,
    goals: (row.goals ?? []).map(updateGoalProgress),
    start_date: row.start_date,
    review_date: row.review_date,
    status: row.status as TherapyPlan["status"],
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function fetchSpeechExercises(clinicId: string): Promise<SpeechExercise[]> {
  const rows = await fetchRows<SpeechExerciseRaw>("speech_exercises", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category as SpeechExercise["category"],
    description: row.description,
    difficulty: row.difficulty as SpeechExercise["difficulty"],
    target_sounds: row.target_sounds ?? [],
    instructions: row.instructions,
    materials_needed: row.materials_needed,
    duration_minutes: row.duration_minutes,
  }));
}

export async function fetchSpeechSessions(clinicId: string): Promise<SpeechSession[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<SpeechSessionRaw>("speech_sessions", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: patientName(row.patient_id),
    therapist_id: row.therapist_id,
    session_date: row.session_date,
    duration_minutes: row.duration_minutes,
    attended: row.attended,
    exercises_assigned: row.exercises_assigned ?? [],
    exercises_completed: row.exercises_completed ?? [],
    accuracy_pct: row.accuracy_pct,
    notes: row.notes,
    home_practice: row.home_practice,
    created_at: row.created_at,
  }));
}

export async function fetchSpeechProgressReports(clinicId: string): Promise<SpeechProgressReport[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<SpeechProgressReportRaw>("speech_progress_reports", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: patientName(row.patient_id),
    therapist_id: row.therapist_id,
    therapist_name: therapistName(row.therapist_id, "Therapist"),
    report_date: row.report_date,
    period_start: row.period_start,
    period_end: row.period_end,
    goals_summary: row.goals_summary,
    progress_summary: row.progress_summary,
    areas_of_improvement: row.areas_of_improvement ?? [],
    areas_of_concern: row.areas_of_concern ?? [],
    recommendations: row.recommendations,
    next_steps: row.next_steps,
    overall_progress: row.overall_progress as SpeechProgressReport["overall_progress"],
    created_at: row.created_at,
  }));
}

export async function fetchLensInventory(clinicId: string): Promise<LensInventoryItem[]> {
  const rows = await fetchRows<LensInventoryRaw>("lens_inventory", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    type: row.type as LensInventoryItem["type"],
    material: row.material,
    coating: row.coating,
    power_range: row.power_range,
    stock_quantity: row.stock_quantity,
    min_threshold: row.min_threshold,
    unit_cost: row.unit_cost,
    selling_price: row.selling_price,
    supplier: row.supplier,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function fetchFrameCatalog(clinicId: string): Promise<FrameCatalogItem[]> {
  const rows = await fetchRows<FrameCatalogRaw>("frame_catalog", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    brand: row.brand,
    model: row.model,
    color: row.color,
    size: row.size,
    material: row.material,
    frame_type: row.frame_type as FrameCatalogItem["frame_type"],
    gender: row.gender as FrameCatalogItem["gender"],
    price: row.price,
    cost_price: row.cost_price,
    stock_quantity: row.stock_quantity,
    photo_url: row.photo_url,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function fetchOpticalPrescriptions(clinicId: string): Promise<OpticalPrescription[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<OpticalPrescriptionRaw>("optical_prescriptions", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    patient_name: patientName(row.patient_id),
    ophthalmologist_name: row.ophthalmologist_name,
    prescription_date: row.prescription_date,
    expiry_date: row.expiry_date,
    right_eye: row.right_eye,
    left_eye: row.left_eye,
    notes: row.notes,
    frame_id: row.frame_id,
    lens_type: row.lens_type,
    status: row.status as OpticalPrescription["status"],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function updateOpticalPrescriptionStatus(
  clinicId: string,
  prescriptionId: string,
  status: OpticalPrescription["status"],
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("optical_prescriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", prescriptionId)
    .eq("clinic_id", clinicId);
  if (error) {
    logger.warn("Failed to update optical prescription", {
      context: "data/client/para-medical",
      error,
    });
    throw new Error(error.message);
  }
}

export async function addMealPlanItem(
  clinicId: string,
  planId: string,
  dayIndex: number,
  slot: MealSlot,
  item: MealItem,
): Promise<MealDay[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .select("daily_plans")
    .eq("id", planId)
    .eq("clinic_id", clinicId)
    .single();

  if (error) throw new Error(error.message);

  const next = [...(((data?.daily_plans as MealDay[] | null) ?? []) as MealDay[])];
  if (!next[dayIndex]) throw new Error("Invalid meal plan day");

  next[dayIndex] = {
    ...next[dayIndex],
    [slot]: [...(next[dayIndex][slot] ?? []), item],
  };
  next[dayIndex] = recalculateMealDay(next[dayIndex]);

  const { error: updateError } = await supabase
    .from("meal_plans")
    .update({ daily_plans: next, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("clinic_id", clinicId);

  if (updateError) throw new Error(updateError.message);
  return next;
}

export async function removeMealPlanItem(
  clinicId: string,
  planId: string,
  dayIndex: number,
  slot: MealSlot,
  itemIndex: number,
): Promise<MealDay[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .select("daily_plans")
    .eq("id", planId)
    .eq("clinic_id", clinicId)
    .single();

  if (error) throw new Error(error.message);

  const next = [...(((data?.daily_plans as MealDay[] | null) ?? []) as MealDay[])];
  if (!next[dayIndex]) throw new Error("Invalid meal plan day");

  next[dayIndex] = {
    ...next[dayIndex],
    [slot]: [...(next[dayIndex][slot] ?? [])].filter((_, index) => index !== itemIndex),
  };
  next[dayIndex] = recalculateMealDay(next[dayIndex]);

  const { error: updateError } = await supabase
    .from("meal_plans")
    .update({ daily_plans: next, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("clinic_id", clinicId);

  if (updateError) throw new Error(updateError.message);
  return next;
}

export async function addExerciseToProgram(
  clinicId: string,
  programId: string,
  exercise: Omit<Exercise, "id">,
): Promise<Exercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercise_programs")
    .select("exercises")
    .eq("id", programId)
    .eq("clinic_id", clinicId)
    .single();

  if (error) throw new Error(error.message);

  const next = [
    ...(((data?.exercises as Exercise[] | null) ?? []) as Exercise[]),
    { ...exercise, id: crypto.randomUUID() },
  ];

  const { error: updateError } = await supabase
    .from("exercise_programs")
    .update({ exercises: next, updated_at: new Date().toISOString() })
    .eq("id", programId)
    .eq("clinic_id", clinicId);

  if (updateError) throw new Error(updateError.message);
  return next;
}

export async function removeExerciseFromProgram(
  clinicId: string,
  programId: string,
  exerciseIndex: number,
): Promise<Exercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercise_programs")
    .select("exercises")
    .eq("id", programId)
    .eq("clinic_id", clinicId)
    .single();

  if (error) throw new Error(error.message);

  const next = (((data?.exercises as Exercise[] | null) ?? []) as Exercise[]).filter(
    (_, index) => index !== exerciseIndex,
  );

  const { error: updateError } = await supabase
    .from("exercise_programs")
    .update({ exercises: next, updated_at: new Date().toISOString() })
    .eq("id", programId)
    .eq("clinic_id", clinicId);

  if (updateError) throw new Error(updateError.message);
  return next;
}

export async function updateExerciseProgramStatus(
  clinicId: string,
  programId: string,
  status: ExerciseProgram["status"],
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("exercise_programs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", programId)
    .eq("clinic_id", clinicId);
  if (error) throw new Error(error.message);
}

export async function updateTherapyPlanGoalStatus(
  clinicId: string,
  planId: string,
  goalId: string,
  status: TherapyGoal["status"],
): Promise<TherapyGoal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("therapy_plans")
    .select("goals")
    .eq("id", planId)
    .eq("clinic_id", clinicId)
    .single();

  if (error) throw new Error(error.message);

  const next = (((data?.goals as TherapyGoal[] | null) ?? []) as TherapyGoal[]).map((goal) => {
    if (goal.id !== goalId) return updateGoalProgress(goal);
    const updatedGoal: TherapyGoal = {
      ...goal,
      status,
      progress_pct:
        status === "achieved"
          ? 100
          : status === "not_started"
            ? 0
            : Math.max(goal.progress_pct ?? 0, 25),
    };
    return updateGoalProgress(updatedGoal);
  });

  const { error: updateError } = await supabase
    .from("therapy_plans")
    .update({ goals: next, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("clinic_id", clinicId);

  if (updateError) throw new Error(updateError.message);
  return next;
}

export async function toggleTherapyPlanMilestone(
  clinicId: string,
  planId: string,
  goalId: string,
  milestoneIndex: number,
): Promise<TherapyGoal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("therapy_plans")
    .select("goals")
    .eq("id", planId)
    .eq("clinic_id", clinicId)
    .single();

  if (error) throw new Error(error.message);

  const today = getLocalDateStr();
  const next = (((data?.goals as TherapyGoal[] | null) ?? []) as TherapyGoal[]).map((goal) => {
    if (goal.id !== goalId) return updateGoalProgress(goal);

    const milestones = goal.milestones.map((milestone, index) => {
      if (index !== milestoneIndex) return milestone;
      const completed = !milestone.completed;
      return {
        ...milestone,
        completed,
        completed_date: completed ? today : null,
      };
    });

    const completedCount = milestones.filter((milestone) => milestone.completed).length;
    const status: TherapyGoal["status"] =
      completedCount === milestones.length && milestones.length > 0
        ? "achieved"
        : completedCount > 0
          ? "in_progress"
          : "not_started";

    return updateGoalProgress({
      ...goal,
      milestones,
      status,
      progress_pct:
        milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : goal.progress_pct,
    });
  });

  const { error: updateError } = await supabase
    .from("therapy_plans")
    .update({ goals: next, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("clinic_id", clinicId);

  if (updateError) throw new Error(updateError.message);
  return next;
}
