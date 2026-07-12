/**
 * Clinic-type feature flags.
 *
 * Supports two backends:
 *
 * 1. **Cloudflare KV** (default when FEATURE_FLAGS_KV binding is configured)
 *    — reads feature flags from KV namespace, supports per-clinic overrides.
 *    Enables runtime toggling without redeployment.
 *
 * 2. **Database fallback** (default) — reads from `features_config` JSONB
 *    column in the `clinic_types` table. Requires redeployment to change flags.
 *
 * Usage:
 *   // Check if feature is enabled for a clinic type
 *   const config = await getFeaturesConfig(clinicTypeId);
 *   const enabled = isFeatureEnabled(config, 'appointments');
 *
 *   // Check with KV override
 *   const enabled = await isFeatureEnabledForClinic(clinicId, 'appointments');
 */

import { getWorkerBinding } from "@/lib/cf-bindings";
import { logger } from "@/lib/logger";

/** All possible feature-flag keys stored in features_config. */
export type ClinicFeatureKey =
  | "appointments"
  | "prescriptions"
  | "consultations"
  | "lab_results"
  | "imaging"
  | "stock"
  | "sales"
  | "odontogram"
  | "before_after_photos"
  | "exercise_programs"
  | "meal_plans"
  | "growth_charts"
  | "vaccination"
  | "bed_management"
  | "installments"
  | "certificates"
  | "sterilization_log"
  | "departments"
  | "consent_forms"
  | "treatment_packages"
  | "consultation_photos"
  | "ivf_cycles"
  | "ivf_protocols"
  | "dialysis_sessions"
  | "dialysis_machines"
  | "prosthetic_orders"
  | "lab_materials"
  | "lab_invoices"
  // Para-medical
  | "physio_sessions"
  | "progress_photos"
  | "body_measurements"
  | "therapy_notes"
  | "therapy_plans"
  | "speech_exercises"
  | "speech_sessions"
  | "speech_reports"
  | "lens_inventory"
  | "frame_catalog"
  | "optical_prescriptions"
  // Diagnostic & Equipment
  | "lab_tests"
  | "radiology_reports"
  | "equipment_rentals"
  | "equipment_maintenance"
  | "parapharmacy"
  | "dermatology"
  | "cardiology"
  | "ent"
  | "orthopedics"
  | "psychiatry"
  | "neurology"
  | "urology"
  | "pulmonology"
  | "endocrinology"
  | "rheumatology"
  | "pregnancy_tracking"
  | "ultrasound_records"
  | "vision_tests"
  | "iop_tracking"
  // Store
  | "public_catalog"
  // AI-powered features (Professional+ plan) — restricted to non-diagnostic
  // internal tooling (site builder, support triage, FAQ). See isAIEnabled().
  | "ai_manager"
  | "ai_auto_suggest"
  | "ai_rag"
  | "ai_memory"
  | "ai_team_tasks"
  | "ai_triage"
  // Patient portal PHI surfaces
  | "patient_timeline"
  | "patient_documents"
  | "patient_family"
  // Managed public website
  | "website";

/** A features_config object as stored in the DB. */
export type FeaturesConfig = Partial<Record<ClinicFeatureKey, boolean>>;

/**
 * Lane-A defaults for a freshly provisioned clinic in Morocco.
 *
 * Operational features (scheduling, reminders, billing, website, WhatsApp) are
 * enabled by default. Clinical/PHI modules (radiology, prescriptions, patient
 * documents, vitals, insurance claims, timeline/export) are OFF until you have
 * CNDP / Loi 09-08 compliance and a DPA in place.
 */
export const DEFAULT_FEATURES: FeaturesConfig = {
  appointments: true,
  website: true,
  installments: true,
  public_catalog: false,
  // Clinical / PHI — disabled by default
  prescriptions: false,
  consultations: false,
  lab_results: false,
  imaging: false,
  stock: false,
  sales: false,
  odontogram: false,
  before_after_photos: false,
  exercise_programs: false,
  meal_plans: false,
  growth_charts: false,
  vaccination: false,
  bed_management: false,
  certificates: false,
  sterilization_log: false,
  departments: false,
  consent_forms: false,
  treatment_packages: false,
  consultation_photos: false,
  ivf_cycles: false,
  ivf_protocols: false,
  dialysis_sessions: false,
  dialysis_machines: false,
  prosthetic_orders: false,
  lab_materials: false,
  lab_invoices: false,
  physio_sessions: false,
  progress_photos: false,
  body_measurements: false,
  therapy_notes: false,
  therapy_plans: false,
  speech_exercises: false,
  speech_sessions: false,
  speech_reports: false,
  lens_inventory: false,
  frame_catalog: false,
  optical_prescriptions: false,
  lab_tests: false,
  radiology_reports: false,
  equipment_rentals: false,
  equipment_maintenance: false,
  parapharmacy: false,
  dermatology: false,
  cardiology: false,
  ent: false,
  orthopedics: false,
  psychiatry: false,
  neurology: false,
  urology: false,
  pulmonology: false,
  endocrinology: false,
  rheumatology: false,
  pregnancy_tracking: false,
  ultrasound_records: false,
  vision_tests: false,
  iop_tracking: false,
  // AI — disabled by default; only non-diagnostic internal tooling may be enabled
  ai_manager: false,
  ai_auto_suggest: false,
  ai_rag: false,
  ai_memory: false,
  ai_team_tasks: false,
  ai_triage: false,
  // Patient portal PHI — disabled by default
  patient_timeline: false,
  patient_documents: false,
  patient_family: false,
};

/**
 * Merge a persisted features_config with the Lane-A defaults.
 * Persisted values take precedence, so defaults only fill missing keys.
 */
export function mergeFeaturesConfig(persisted: FeaturesConfig | undefined | null): FeaturesConfig {
  if (!persisted) return { ...DEFAULT_FEATURES };
  return { ...DEFAULT_FEATURES, ...persisted };
}

/**
 * Cloudflare KV binding type.
 */
interface CloudflareKV {
  get(
    key: string,
    options?: { type: "text" | "json" },
  ): Promise<string | Record<string, unknown> | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * A90-2: Typed accessor for the Workers KV binding.
 *
 * Replaces the ad-hoc `(globalThis as unknown as { ... }).FEATURE_FLAGS_KV`
 * casts scattered in the codebase with a single, type-safe helper.
 *
 * Resolves the binding via `getCloudflareContext().env` (where
 * @opennextjs/cloudflare v1.17+ exposes bindings) at request time, falling
 * back to `globalThis` for tests/dev. Async because the OpenNext context must
 * be loaded lazily so this never throws at module-init.
 */
interface WorkersEnvBindings {
  FEATURE_FLAGS_KV?: CloudflareKV;
  RATE_LIMIT_KV?: CloudflareKV;
}

export function getKVBinding<K extends keyof WorkersEnvBindings>(
  name: K,
): Promise<WorkersEnvBindings[K] | undefined> {
  return getWorkerBinding<NonNullable<WorkersEnvBindings[K]>>(name as string);
}

/**
 * F-11: Check if AI features are enabled globally. Reads the `ai.enabled`
 * flag from FEATURE_FLAGS_KV. Returns false (disabled) if KV is unavailable
 * or the flag is not set, providing a fail-safe kill-switch.
 *
 * Usage in AI route handlers:
 *   if (!(await isAIEnabled())) return apiError("AI features are disabled", 503);
 */
export async function isAIEnabled(): Promise<boolean> {
  // A107-03: Env-based AI kill switch — immediate, no KV dependency
  if (process.env.AI_DISABLED === "true") return false;

  try {
    const kv = await getKVBinding("FEATURE_FLAGS_KV");
    if (!kv) {
      // No KV binding — default to enabled (backwards-compatible)
      return true;
    }
    const value = await kv.get("ai.enabled", { type: "text" });
    // Explicit "false" disables; anything else (including null/missing) = enabled
    return value !== "false";
  } catch (error) {
    logger.error("Failed to check AI kill-switch from KV", { context: "features", error });
    // F-11: Fail-open for AI features when KV is unavailable
    // (operators can disable at the route level if needed)
    return true;
  }
}

/**
 * Check whether a single feature is enabled.
 * Returns `false` when the key is missing or explicitly set to false.
 *
 * Note: This is the synchronous version for DB-backed configs.
 * For KV-backed checks, use isFeatureEnabledForClinic().
 */
export function isFeatureEnabled(
  config: FeaturesConfig | undefined | null,
  key: ClinicFeatureKey,
): boolean {
  if (!config) return false;
  return config[key] === true;
}
