/**
 * Clinic-type feature flags.
 *
 * Each key corresponds to a module / sidebar section that can be
 * enabled or disabled per clinic type via the `features_config` JSONB
 * column in the `clinic_types` table.
 */

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
  | "iop_tracking";

/** A features_config object as stored in the DB. */
export type FeaturesConfig = Partial<Record<ClinicFeatureKey, boolean>>;

/**
 * Check whether a single feature is enabled.
 * Returns `false` when the key is missing or explicitly set to false.
 */
export function isFeatureEnabled(
  config: FeaturesConfig | undefined | null,
  key: ClinicFeatureKey,
): boolean {
  if (!config) return false;
  return config[key] === true;
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
