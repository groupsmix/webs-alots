/**
 * Para-Medical type definitions.
 *
 * Covers: Physiotherapist, Nutritionist, Psychologist, Speech Therapist, Optician
 */

// ========== Physiotherapist (Kinésithérapeute) ==========

export interface Exercise {
  id: string;
  name: string;
  category: string;
  description: string;
  sets: number;
  reps: number;
  duration_seconds: number | null;
  rest_seconds: number;
  notes: string | null;
  image_url: string | null;
}

export interface ExerciseProgram {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  therapist_id: string;
  therapist_name: string;
  title: string;
  exercises: Exercise[];
  frequency: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "paused";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhysioSession {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  therapist_id: string;
  program_id: string | null;
  session_date: string;
  duration_minutes: number;
  attended: boolean;
  progress_notes: string | null;
  pain_level_before: number | null;
  pain_level_after: number | null;
  exercises_completed: string[];
  created_at: string;
}

export interface ProgressPhoto {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  photo_url: string;
  photo_date: string;
  category: string;
  notes: string | null;
  created_at: string;
}

// ========== Nutritionist (Nutritionniste) ==========

export interface MealItem {
  name: string;
  quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface DailyMealPlan {
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
}

export interface MealPlan {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  nutritionist_id: string;
  nutritionist_name: string;
  title: string;
  type: "daily" | "weekly";
  daily_plans: DailyMealPlan[];
  target_calories: number;
  notes: string | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "draft";
  created_at: string;
  updated_at: string;
}

export interface BodyMeasurement {
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

// ========== Psychologist (Psychologue) ==========

export interface TherapySessionNote {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  therapist_id: string;
  session_date: string;
  session_number: number;
  duration_minutes: number;
  session_type: "individual" | "couple" | "family" | "group";
  mood_rating: number | null;
  presenting_issues: string | null;
  interventions: string | null;
  observations: string | null;
  homework: string | null;
  is_confidential: boolean;
  risk_assessment: "none" | "low" | "moderate" | "high" | null;
  next_session_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TherapyGoal {
  id: string;
  description: string;
  target_date: string | null;
  status: "not_started" | "in_progress" | "achieved" | "revised";
  progress_pct: number;
  milestones: TherapyMilestone[];
}

export interface TherapyMilestone {
  description: string;
  target_date: string | null;
  completed: boolean;
  completed_date: string | null;
}

export interface TherapyPlan {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  therapist_id: string;
  therapist_name: string;
  diagnosis: string | null;
  treatment_approach: string;
  goals: TherapyGoal[];
  start_date: string;
  review_date: string | null;
  status: "active" | "completed" | "on_hold";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ========== Speech Therapist (Orthophoniste) ==========

export interface SpeechExercise {
  id: string;
  name: string;
  category: "articulation" | "fluency" | "language" | "voice" | "pragmatics" | "phonology";
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  target_sounds: string[];
  instructions: string;
  materials_needed: string | null;
  duration_minutes: number;
}

export interface SpeechSession {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  therapist_id: string;
  session_date: string;
  duration_minutes: number;
  attended: boolean;
  exercises_assigned: string[];
  exercises_completed: string[];
  accuracy_pct: number | null;
  notes: string | null;
  home_practice: string | null;
  created_at: string;
}

export interface SpeechProgressReport {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  therapist_id: string;
  therapist_name: string;
  report_date: string;
  period_start: string;
  period_end: string;
  goals_summary: string;
  progress_summary: string;
  areas_of_improvement: string[];
  areas_of_concern: string[];
  recommendations: string;
  next_steps: string;
  overall_progress: "significant" | "moderate" | "minimal" | "regression";
  created_at: string;
}

// ========== Optician (Opticien) ==========

export interface LensInventoryItem {
  id: string;
  clinic_id: string;
  type: "single_vision" | "bifocal" | "progressive" | "contact" | "sunglasses";
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

export interface FrameCatalogItem {
  id: string;
  clinic_id: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  material: string;
  frame_type: "full_rim" | "semi_rimless" | "rimless";
  gender: "men" | "women" | "unisex" | "kids";
  price: number;
  cost_price: number;
  stock_quantity: number;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpticalPrescription {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  ophthalmologist_name: string | null;
  prescription_date: string;
  expiry_date: string | null;
  right_eye: {
    sphere: number | null;
    cylinder: number | null;
    axis: number | null;
    add: number | null;
    pd: number | null;
  };
  left_eye: {
    sphere: number | null;
    cylinder: number | null;
    axis: number | null;
    add: number | null;
    pd: number | null;
  };
  notes: string | null;
  frame_id: string | null;
  lens_type: string | null;
  status: "pending" | "in_progress" | "ready" | "delivered";
  created_at: string;
  updated_at: string;
}
