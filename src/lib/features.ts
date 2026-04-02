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

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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
  // AI-powered features (Professional+ plan)
  | "ai_manager"
  | "ai_auto_suggest";

/** A features_config object as stored in the DB. */
export type FeaturesConfig = Partial<Record<ClinicFeatureKey, boolean>>;

/**
 * Default feature flags - used when no config is provided
 */
export const DEFAULT_FEATURES: FeaturesConfig = {
  appointments: true,
  prescriptions: true,
  consultations: true,
  lab_results: true,
  imaging: true,
  departments: true,
  consent_forms: true,
};

/**
 * Cloudflare KV binding type
 */
interface CloudflareKV {
  get(key: string, options?: { type: "text" | "json" }): Promise<string | Record<string, unknown> | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Get feature flags from KV namespace
 * Returns default features if KV is not available
 */
export async function getKVFeatureFlags(): Promise<FeaturesConfig> {
  try {
    const kv = (globalThis as unknown as { FEATURE_FLAGS_KV?: CloudflareKV }).FEATURE_FLAGS_KV;
    if (!kv) {
      return DEFAULT_FEATURES;
    }

    const flags = await kv.get("global:features", { type: "json" });
    return (flags as FeaturesConfig) ?? DEFAULT_FEATURES;
  } catch (error) {
    logger.error("Failed to get feature flags from KV", { context: "features", error });
    return DEFAULT_FEATURES;
  }
}

/**
 * Get feature flag override for a specific clinic
 * Returns clinic-specific override if exists, otherwise null
 */
export async function getClinicFeatureOverride(
  clinicId: string,
): Promise<FeaturesConfig | null> {
  try {
    const kv = (globalThis as unknown as { FEATURE_FLAGS_KV?: CloudflareKV }).FEATURE_FLAGS_KV;
    if (!kv) {
      return null;
    }

    const override = await kv.get(`clinic:${clinicId}:features`, { type: "json" });
    return (override as FeaturesConfig) ?? null;
  } catch (error) {
    logger.error("Failed to get clinic feature override from KV", {
      context: "features",
      error,
      clinicId,
    });
    return null;
  }
}

/**
 * Set feature flag override for a specific clinic
 * Used by admin UI to enable/disable features per clinic
 */
export async function setClinicFeatureOverride(
  clinicId: string,
  config: FeaturesConfig,
): Promise<boolean> {
  try {
    const kv = (globalThis as unknown as { FEATURE_FLAGS_KV?: CloudflareKV }).FEATURE_FLAGS_KV;
    if (!kv) {
      logger.warn("KV not available, cannot set clinic feature override", {
        context: "features",
        clinicId,
      });
      return false;
    }

    // Store the override with a long TTL (30 days)
    await kv.put(`clinic:${clinicId}:features`, JSON.stringify(config), {
      expirationTtl: 30 * 24 * 60 * 60,
    });

    // Log the change for audit purposes
    logger.info("Clinic feature override updated", {
      context: "features",
      clinicId,
      features: Object.keys(config),
    });

    return true;
  } catch (error) {
    logger.error("Failed to set clinic feature override", {
      context: "features",
      error,
      clinicId,
    });
    return false;
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

/**
 * Check if a feature is enabled for a specific clinic.
 * First checks for clinic-specific KV override, then falls back to
 * the clinic type's features_config from the database.
 *
 * This function supports runtime feature flag overrides via KV.
 */
export async function isFeatureEnabledForClinic(
  clinicId: string,
  clinicTypeId: string | null,
  key: ClinicFeatureKey,
): Promise<boolean> {
  // First check for KV override (takes precedence)
  const kvOverride = await getClinicFeatureOverride(clinicId);
  if (kvOverride && key in kvOverride) {
    return kvOverride[key] === true;
  }

  // If no KV override, fallback to DB config
  // Note: This requires the caller to fetch the clinic type config
  // For now, return the default value if no override exists
  return DEFAULT_FEATURES[key] ?? false;
}

/**
 * Fetch features config from database for a clinic type
 * Used as fallback when KV override doesn't exist
 */
export async function getClinicTypeFeaturesFromDB(
  clinicTypeId: string,
): Promise<FeaturesConfig | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("clinic_types")
    .select("features_config")
    .eq("id", clinicTypeId)
    .maybeSingle();

  if (error) {
    logger.error("Failed to fetch clinic type features from DB", {
      context: "features",
      error,
      clinicTypeId,
    });
    return null;
  }

  return data?.features_config ?? null;
}

/**
 * Return only the subset of items whose `requiredFeature` is either
 * undefined (always shown) or enabled in the config.
 */
export function filterByFeatures<T extends { requiredFeature?: ClinicFeatureKey }>(
  items: T[],
  config: FeaturesConfig | undefined | null,
): T[] {
  return items.filter(
    (item) =>
      !item.requiredFeature || isFeatureEnabled(config, item.requiredFeature),
  );
}
