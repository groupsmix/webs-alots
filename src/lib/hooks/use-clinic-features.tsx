"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { FeaturesConfig, ClinicFeatureKey } from "@/lib/features";
import { isFeatureEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";

/**
 * Specialty to feature mapping
 * Defines which features are relevant for each medical specialty
 */
export const SPECIALTY_FEATURES: Record<string, ClinicFeatureKey[]> = {
  // General Practitioner - core features only
  gp: [
    "appointments",
    "prescriptions",
    "consultations",
    "departments",
    "consent_forms",
    "certificates",
  ],
  // Dentist - dental-specific features
  dentist: [
    "appointments",
    "prescriptions",
    "consultations",
    "odontogram",
    "treatment_packages",
    "before_after_photos",
    "appointments",
    "prescriptions",
    "consultations",
    "departments",
    "consent_forms",
    "certificates",
  ],
  // Pediatrician
  pediatrician: [
    "appointments",
    "prescriptions",
    "consultations",
    "vaccination",
    "growth_charts",
    "departments",
    "consent_forms",
  ],
  // Gynecologist
  gynecologist: [
    "appointments",
    "prescriptions",
    "consultations",
    "pregnancy_tracking",
    "ultrasound_records",
    "departments",
    "consent_forms",
  ],
  // Ophthalmologist
  ophthalmologist: [
    "appointments",
    "prescriptions",
    "consultations",
    "vision_tests",
    "iop_tracking",
    "departments",
    "consent_forms",
  ],
  // Cardiologist
  cardiologist: [
    "appointments",
    "prescriptions",
    "consultations",
    "cardiology",
    "departments",
    "consent_forms",
  ],
  // Dermatologist
  dermatologist: [
    "appointments",
    "prescriptions",
    "consultations",
    "dermatology",
    "before_after_photos",
    "departments",
    "consent_forms",
  ],
  // Orthopedist
  orthopedist: [
    "appointments",
    "prescriptions",
    "consultations",
    "orthopedics",
    "departments",
    "consent_forms",
  ],
  // Neurologist
  neurologist: [
    "appointments",
    "prescriptions",
    "consultations",
    "neurology",
    "departments",
    "consent_forms",
  ],
  // Psychiatrist
  psychiatrist: [
    "appointments",
    "prescriptions",
    "consultations",
    "psychiatry",
    "departments",
    "consent_forms",
    "certificates",
  ],
  // Physiotherapist
  physiotherapist: [
    "appointments",
    "prescriptions",
    "consultations",
    "physio_sessions",
    "progress_photos",
    "body_measurements",
    "therapy_notes",
    "therapy_plans",
    "departments",
    "consent_forms",
  ],
  // Radiologist
  radiologist: [
    "appointments",
    "prescriptions",
    "consultations",
    "radiology_reports",
    "imaging",
    "lab_results",
    "departments",
    "consent_forms",
  ],
  // Lab technician
  lab_tech: [
    "lab_results",
    "lab_tests",
    "lab_materials",
    "lab_invoices",
  ],
  // Pharmacist
  pharmacist: [
    "prescriptions",
    "stock",
    "sales",
    "parapharmacy",
  ],
  // Optician
  optician: [
    "optical_prescriptions",
    "lens_inventory",
    "frame_catalog",
    "stock",
    "sales",
  ],
  // Nutritionist
  nutritionist: [
    "appointments",
    "prescriptions",
    "consultations",
    "meal_plans",
    "exercise_programs",
    "growth_charts",
    "departments",
    "consent_forms",
  ],
  // IVF Specialist
  ivf_specialist: [
    "appointments",
    "prescriptions",
    "consultations",
    "ivf_cycles",
    "ivf_protocols",
    "departments",
    "consent_forms",
  ],
  // Dialysis Specialist
  dialysis_specialist: [
    "appointments",
    "prescriptions",
    "consultations",
    "dialysis_sessions",
    "dialysis_machines",
    "departments",
    "consent_forms",
  ],
};

/**
 * Get the user's specialty from their profile
 * This could be extended to read from user metadata or a profile table
 */
function _getUserSpecialty(): string | null {
  // In a real implementation, this would read from the user's session/profile
  // For now, we'll return null to fall back to clinic features only
  // The sidebar can be enhanced to accept a specialty prop from the user context
  return null;
}

interface ClinicFeaturesContextValue {
  /** The raw features_config object (may be null while loading). */
  config: FeaturesConfig | null;
  /** Whether the config has been loaded. */
  loaded: boolean;
  /** Convenience: check a single feature flag. */
  hasFeature: (key: ClinicFeatureKey) => boolean;
  /** Check if a feature is enabled for a specific specialty */
  hasFeatureForSpecialty: (key: ClinicFeatureKey, specialty: string | null) => boolean;
}

const ClinicFeaturesContext = createContext<ClinicFeaturesContextValue>({
  config: null,
  loaded: false,
  hasFeature: () => true, // default: show everything until loaded
  hasFeatureForSpecialty: () => true,
});

/**
 * Provider that loads the clinic's features_config once and
 * exposes it to the component tree.
 *
 * Accepts either:
 *  - a pre-fetched `initialConfig` (SSR / server component), or
 *  - a `clinicTypeKey` to fetch from the API at mount time.
 *
 * When neither is supplied, all features are enabled by default.
 */
export function ClinicFeaturesProvider({
  children,
  initialConfig,
  clinicTypeKey,
}: {
  children: ReactNode;
  initialConfig?: FeaturesConfig | null;
  clinicTypeKey?: string | null;
}) {
  const [config, setConfig] = useState<FeaturesConfig | null>(
    initialConfig ?? null,
  );
  const [loaded, setLoaded] = useState(!!initialConfig);

  useEffect(() => {
    if (initialConfig || !clinicTypeKey) {
      setLoaded(true);
      return;
    }

    let cancelled = false;

    async function fetchConfig() {
      try {
        const res = await fetch(
          `/api/clinic-features?type_key=${encodeURIComponent(clinicTypeKey!)}`,
        );
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { features_config: FeaturesConfig };
        if (!cancelled) {
          setConfig(data.features_config);
          setLoaded(true);
        }
      } catch (err) {
        logger.warn("Failed to fetch clinic features, enabling all", { context: "clinic-features", error: err });
        if (!cancelled) {
          setConfig(null);
          setLoaded(true);
        }
      }
    }

    void fetchConfig();
    return () => {
      cancelled = true;
    };
  }, [initialConfig, clinicTypeKey]);

  const hasFeature = (key: ClinicFeatureKey) =>
    !loaded || isFeatureEnabled(config, key);

  /**
   * Check if a feature is enabled, considering both clinic config AND user specialty
   * This provides cognitive load reduction by filtering features based on specialty
   */
  const hasFeatureForSpecialty = (key: ClinicFeatureKey, specialty: string | null) => {
    // If no specialty provided, fall back to clinic features only
    if (!specialty) {
      return hasFeature(key);
    }

    // Get the features allowed for this specialty
    const specialtyFeatureKeys = SPECIALTY_FEATURES[specialty.toLowerCase()] ?? [];
    
    // If the feature is not in the specialty's list, don't show it
    if (specialtyFeatureKeys.length > 0 && !specialtyFeatureKeys.includes(key)) {
      return false;
    }

    // Also check clinic config
    return hasFeature(key);
  };

  return (
    <ClinicFeaturesContext.Provider value={{ config, loaded, hasFeature, hasFeatureForSpecialty }}>
      {children}
    </ClinicFeaturesContext.Provider>
  );
}

/** Access clinic feature flags from any client component. */
export function useClinicFeatures() {
  return useContext(ClinicFeaturesContext);
}
