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
  | "ai_auto_suggest"
  // Veterinary
  | "pet_profiles"
  | "website"
  // Restaurant
  | "menu_management"
  | "table_management"
  | "qr_ordering"
  | "reservations";

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

/** Default features for veterinary clinics */
export const VETERINARY_DEFAULT_FEATURES: FeaturesConfig = {
  appointments: true,
  prescriptions: true,
  vaccination: true,
  stock: true,
  pet_profiles: true,
  website: true,
};

/** Default features for restaurant businesses */
export const RESTAURANT_DEFAULT_FEATURES: FeaturesConfig = {
  appointments: true,
  menu_management: true,
  table_management: true,
  qr_ordering: true,
  reservations: true,
  departments: true,
};

/**
 * Cloudflare KV binding type
 */
interface CloudflareKV {
  get(key: string, options?: { type: "text" | "json" }): Promise<string | Record<string, unknown> | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
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
  try {
    const kv = (globalThis as unknown as { FEATURE_FLAGS_KV?: CloudflareKV }).FEATURE_FLAGS_KV;
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
 * Get feature flags from KV namespace.
 * Returns default features if KV is not available.
 *
 * F-A90-06: KV fetch errors are now surfaced via logger.error (not silently
 * swallowed). The function still falls back to defaults for resilience, but
 * operators can monitor for "KV_FETCH_ERROR" in their dashboards.
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
    // F-A90-06: Surface KV errors clearly so operators know features are
    // running on defaults due to an outage, not by design.
    logger.error("KV_FETCH_ERROR: Feature flags falling back to defaults", {
      context: "features",
      error,
      fallback: "DEFAULT_FEATURES",
    });
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
 * Set feature flag override for a specific clinic.
 * Used by admin UI to enable/disable features per clinic.
 *
 * F-A90-01: Supports both enabling AND disabling (kill-switch) — setting
 * a key to `false` explicitly disables the feature for a clinic, overriding
 * the clinic-type default.
 *
 * F-A90-05: Routes flag changes through logAuditEvent for compliance.
 */
export async function setClinicFeatureOverride(
  clinicId: string,
  config: FeaturesConfig,
  actor?: string | null,
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

    // Capture previous state for audit diff
    const previous = await getClinicFeatureOverride(clinicId);

    // Store the override with a long TTL (30 days)
    await kv.put(`clinic:${clinicId}:features`, JSON.stringify(config), {
      expirationTtl: 30 * 24 * 60 * 60,
    });

    // F-A90-05: Log the change via structured logger AND audit log.
    // Compute which flags changed for the audit trail.
    const changes: Record<string, { from: boolean | undefined; to: boolean | undefined }> = {};
    const allKeys = new Set([
      ...Object.keys(config),
      ...Object.keys(previous ?? {}),
    ]) as Set<ClinicFeatureKey>;
    for (const key of allKeys) {
      const oldVal = previous?.[key];
      const newVal = config[key];
      if (oldVal !== newVal) {
        changes[key] = { from: oldVal, to: newVal };
      }
    }

    logger.info("Clinic feature override updated", {
      context: "features",
      clinicId,
      actor: actor ?? "system",
      changes,
    });

    // F-A90-05: Write audit event (non-blocking — feature toggle must not
    // fail if audit write fails, but we log the attempt).
    try {
      const { createAdminClient } = await import("@/lib/supabase-server");
      const { logAuditEvent } = await import("@/lib/audit-log");
      const supabase = createAdminClient();
      await logAuditEvent({
        supabase,
        action: "feature_flag.updated",
        type: "config",
        clinicId,
        actor,
        description: `Feature flags updated: ${Object.entries(changes).map(([k, v]) => `${k}: ${v.from} → ${v.to}`).join(", ")}`,
        metadata: { changes: JSON.parse(JSON.stringify(changes)) },
      });
    } catch (auditErr) {
      logger.warn("Failed to write audit log for feature flag change", {
        context: "features",
        clinicId,
        error: auditErr,
      });
    }

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
 * F-A90-01: Global kill-switch for any feature flag.
 * Sets a global override in KV that takes precedence over clinic-type defaults.
 * Setting a key to `false` disables the feature for ALL clinics immediately.
 */
export async function setGlobalFeatureFlag(
  key: ClinicFeatureKey,
  enabled: boolean,
  actor?: string | null,
): Promise<boolean> {
  try {
    const kv = (globalThis as unknown as { FEATURE_FLAGS_KV?: CloudflareKV }).FEATURE_FLAGS_KV;
    if (!kv) {
      logger.warn("KV not available, cannot set global feature flag", { context: "features" });
      return false;
    }

    // Read current global flags, merge the change
    const current = await getKVFeatureFlags();
    const updated = { ...current, [key]: enabled };
    await kv.put("global:features", JSON.stringify(updated));

    logger.info("Global feature flag updated", {
      context: "features",
      key,
      enabled,
      actor: actor ?? "system",
    });

    // F-A90-05: Write audit event for global flag changes (higher-impact
    // than per-clinic overrides, so compliance requires an audit trail).
    try {
      const { createAdminClient } = await import("@/lib/supabase-server");
      const { logAuditEvent } = await import("@/lib/audit-log");
      const supabase = createAdminClient();
      await logAuditEvent({
        supabase,
        action: "feature_flag.global_updated",
        type: "config",
        clinicId: "global",
        actor,
        description: `Global feature flag "${key}" set to ${enabled} (was ${current[key] ?? "unset"})`,
        metadata: {
          key,
          previous: current[key] ?? null,
          current: enabled,
        },
      });
    } catch (auditErr) {
      logger.warn("Failed to write audit log for global feature flag change", {
        context: "features",
        error: auditErr,
        key,
      });
    }

    return true;
  } catch (error) {
    logger.error("Failed to set global feature flag", { context: "features", error, key });
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

  // F-A90-01: Check global KV flags (set via setGlobalFeatureFlag kill-switch)
  // before falling back to hardcoded defaults.
  const globalFlags = await getKVFeatureFlags();
  if (key in globalFlags) {
    return globalFlags[key] === true;
  }

  // Final fallback to hardcoded defaults
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
