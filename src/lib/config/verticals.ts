/**
 * Vertical identifiers and scope-enforcement matrix.
 *
 * This module defines which verticals exist and — critically — which API groups,
 * dashboards, and feature flags each vertical gates. It is the single source of
 * truth for ADR 0013 (operations-first scope enforcement).
 */

import type { ClinicFeatureKey } from "@/lib/features";

/** Vertical ID — each business vertical has a unique string identifier. */
export type VerticalId = "healthcare" | "beauty" | "restaurant" | "fitness" | "veterinary";

/**
 * Scope group identifiers for gated API route groups.
 *
 * Some of these route directories are currently deleted, but the groups remain
 * modeled here so ADR-0013 scope tests and CI guards fail if they reappear
 * without explicit gating.
 */
export type ScopedApiGroup =
  | "prescriptions"
  | "vitals"
  | "radiology"
  | "insurance-claims"
  | "admissions"
  | "pets"
  | "menus"
  | "restaurant-orders"
  | "restaurant-tables";

/** Scope group identifiers for gated dashboard/page route groups. */
export type ScopedDashboard =
  | "admin/departments"
  | "admin/beds"
  | "admin/machines"
  | "admin/lab-materials"
  | "admin/lab-invoices"
  | "doctor/before-after"
  | "doctor/cardiology"
  | "doctor/child-info"
  | "doctor/consultation-photos"
  | "doctor/departments"
  | "doctor/dermatology"
  | "doctor/dialysis-machines"
  | "doctor/dialysis-sessions"
  | "doctor/endocrinology"
  | "doctor/ent"
  | "doctor/growth-charts"
  | "doctor/iop-tracking"
  | "doctor/ivf-cycles"
  | "doctor/ivf-protocols"
  | "doctor/lab-invoices"
  | "doctor/lab-materials"
  | "doctor/neurology"
  | "doctor/odontogram"
  | "doctor/orthopedics"
  | "doctor/pregnancies"
  | "doctor/prosthetic-orders"
  | "doctor/psychiatry"
  | "doctor/pulmonology"
  | "doctor/rheumatology"
  | "doctor/sterilization"
  | "doctor/treatment-packages"
  | "doctor/treatment-plans"
  | "doctor/ultrasounds"
  | "doctor/urology"
  | "doctor/vaccinations"
  | "doctor/vision-tests"
  | "equipment"
  | "nutritionist"
  | "optician"
  | "parapharmacy"
  | "pharmacist"
  | "physiotherapist"
  | "psychologist"
  | "radiology-dashboard"
  | "speech-therapist"
  | "restaurant"
  | "veterinary";

/**
 * Per-dashboard feature requirements.
 *
 * Each entry is OFF by default for a freshly provisioned clinic. A dashboard is
 * enabled when at least one listed feature is true for the clinic.
 */
const DASHBOARD_FEATURE_REQUIREMENTS: Record<ScopedDashboard, ClinicFeatureKey[]> = {
  "admin/departments": ["departments"],
  "admin/beds": ["bed_management"],
  "admin/machines": ["dialysis_machines"],
  "admin/lab-materials": ["lab_materials"],
  "admin/lab-invoices": ["lab_invoices"],
  "doctor/before-after": ["before_after_photos"],
  "doctor/cardiology": ["cardiology"],
  "doctor/child-info": ["growth_charts", "vaccination"],
  "doctor/consultation-photos": ["consultation_photos"],
  "doctor/departments": ["departments"],
  "doctor/dermatology": ["dermatology"],
  "doctor/dialysis-machines": ["dialysis_machines"],
  "doctor/dialysis-sessions": ["dialysis_sessions"],
  "doctor/endocrinology": ["endocrinology"],
  "doctor/ent": ["ent"],
  "doctor/growth-charts": ["growth_charts"],
  "doctor/iop-tracking": ["iop_tracking"],
  "doctor/ivf-cycles": ["ivf_cycles"],
  "doctor/ivf-protocols": ["ivf_protocols"],
  "doctor/lab-invoices": ["lab_invoices"],
  "doctor/lab-materials": ["lab_materials"],
  "doctor/neurology": ["neurology"],
  "doctor/odontogram": ["odontogram"],
  "doctor/orthopedics": ["orthopedics"],
  "doctor/pregnancies": ["pregnancy_tracking"],
  "doctor/prosthetic-orders": ["prosthetic_orders"],
  "doctor/psychiatry": ["psychiatry"],
  "doctor/pulmonology": ["pulmonology"],
  "doctor/rheumatology": ["rheumatology"],
  "doctor/sterilization": ["sterilization_log"],
  "doctor/treatment-packages": ["treatment_packages"],
  "doctor/treatment-plans": ["consultations"],
  "doctor/ultrasounds": ["ultrasound_records"],
  "doctor/urology": ["urology"],
  "doctor/vaccinations": ["vaccination"],
  "doctor/vision-tests": ["vision_tests"],
  equipment: ["equipment_rentals", "equipment_maintenance"],
  nutritionist: ["meal_plans", "body_measurements"],
  optician: ["lens_inventory", "frame_catalog", "optical_prescriptions"],
  parapharmacy: ["parapharmacy"],
  pharmacist: ["prescriptions", "stock", "sales", "parapharmacy"],
  physiotherapist: ["physio_sessions", "exercise_programs", "progress_photos"],
  psychologist: ["therapy_notes", "therapy_plans"],
  "radiology-dashboard": ["radiology_reports", "imaging"],
  "speech-therapist": ["speech_sessions", "speech_exercises", "speech_reports"],
  restaurant: ["menu_management", "table_management", "qr_ordering", "reservations"],
  veterinary: ["pet_profiles"],
};

/** Defines the scope for a single vertical. */
export interface VerticalScope {
  id: VerticalId | "clinical" | "adt";
  label: string;
  /** API route groups gated by this vertical (directories under src/app/api/) */
  enabledApiGroups: ScopedApiGroup[];
  /** Dashboard route groups gated by this vertical */
  enabledDashboards: ScopedDashboard[];
  /** Feature flags that must be ON for this vertical to be active */
  enabledFlags: ClinicFeatureKey[];
}

const CLINICAL_DASHBOARDS = [
  "admin/departments",
  "admin/beds",
  "admin/machines",
  "admin/lab-materials",
  "admin/lab-invoices",
  "doctor/before-after",
  "doctor/cardiology",
  "doctor/child-info",
  "doctor/consultation-photos",
  "doctor/departments",
  "doctor/dermatology",
  "doctor/dialysis-machines",
  "doctor/dialysis-sessions",
  "doctor/endocrinology",
  "doctor/ent",
  "doctor/growth-charts",
  "doctor/iop-tracking",
  "doctor/ivf-cycles",
  "doctor/ivf-protocols",
  "doctor/lab-invoices",
  "doctor/lab-materials",
  "doctor/neurology",
  "doctor/odontogram",
  "doctor/orthopedics",
  "doctor/pregnancies",
  "doctor/prosthetic-orders",
  "doctor/psychiatry",
  "doctor/pulmonology",
  "doctor/rheumatology",
  "doctor/sterilization",
  "doctor/treatment-packages",
  "doctor/treatment-plans",
  "doctor/ultrasounds",
  "doctor/urology",
  "doctor/vaccinations",
  "doctor/vision-tests",
  "equipment",
  "nutritionist",
  "optician",
  "parapharmacy",
  "pharmacist",
  "physiotherapist",
  "psychologist",
  "radiology-dashboard",
  "speech-therapist",
] satisfies ScopedDashboard[];

/**
 * The master scope matrix. Every Architecture-B surface is listed here with its
 * gating vertical. A freshly-provisioned clinic sees none of these unless
 * explicitly enabled.
 */
export const VERTICAL_SCOPES: VerticalScope[] = [
  {
    id: "clinical",
    label: "Clinical / PHI",
    enabledApiGroups: ["prescriptions", "vitals", "radiology", "insurance-claims"],
    enabledDashboards: [...CLINICAL_DASHBOARDS],
    enabledFlags: [
      ...new Set(
        CLINICAL_DASHBOARDS.flatMap((dashboard) => DASHBOARD_FEATURE_REQUIREMENTS[dashboard]),
      ),
      "prescriptions",
      "lab_results",
      "imaging",
      "radiology_reports",
      "lab_tests",
    ],
  },
  {
    id: "adt",
    label: "Admissions / Discharge / Transfer",
    enabledApiGroups: ["admissions"],
    enabledDashboards: ["admin/beds"],
    enabledFlags: ["bed_management"],
  },
  {
    id: "veterinary",
    label: "Veterinary",
    enabledApiGroups: ["pets"],
    enabledDashboards: ["veterinary"],
    enabledFlags: ["pet_profiles"],
  },
  {
    id: "restaurant",
    label: "Restaurant",
    enabledApiGroups: ["menus", "restaurant-orders", "restaurant-tables"],
    enabledDashboards: ["restaurant"],
    enabledFlags: ["menu_management", "table_management", "qr_ordering", "reservations"],
  },
];

/** All API groups that are gated (Architecture-B surfaces). */
export const ALL_GATED_API_GROUPS: ScopedApiGroup[] = [
  ...new Set(VERTICAL_SCOPES.flatMap((v) => v.enabledApiGroups)),
];

/** All dashboard/page groups that are gated (Architecture-B surfaces). */
export const ALL_GATED_DASHBOARDS: ScopedDashboard[] = [
  ...new Set(VERTICAL_SCOPES.flatMap((v) => v.enabledDashboards)),
];

/** All feature flags that gate Architecture-B surfaces. */
export const ALL_GATED_FLAGS: ClinicFeatureKey[] = [
  ...new Set([
    ...VERTICAL_SCOPES.flatMap((v) => v.enabledFlags),
    ...Object.values(DASHBOARD_FEATURE_REQUIREMENTS).flat(),
  ]),
];

/** Look up which vertical scope an API group belongs to. */
export function getVerticalForApiGroup(apiGroup: string): VerticalScope | undefined {
  return VERTICAL_SCOPES.find((v) => v.enabledApiGroups.includes(apiGroup as ScopedApiGroup));
}

/** Required flags for a dashboard group. Undefined means operational/ungated. */
export function getDashboardRequiredFlags(dashboard: string): ClinicFeatureKey[] | undefined {
  return DASHBOARD_FEATURE_REQUIREMENTS[dashboard as ScopedDashboard];
}

/** Derive a scoped dashboard key from a pathname, when the pathname is gated. */
export function getScopedDashboardForPathname(pathname: string): ScopedDashboard | undefined {
  const [first, second] = pathname.split("/").filter(Boolean);
  if (!first) return undefined;

  if ((first === "admin" || first === "doctor") && second) {
    const candidate = `${first}/${second}` as ScopedDashboard;
    return DASHBOARD_FEATURE_REQUIREMENTS[candidate] ? candidate : undefined;
  }

  if (first === "radiology") return "radiology-dashboard";
  const candidate = first as ScopedDashboard;
  return DASHBOARD_FEATURE_REQUIREMENTS[candidate] ? candidate : undefined;
}

/** Check whether enabled flags satisfy a gated API group. */
export function isApiGroupEnabled(
  apiGroup: string,
  enabledFlags: Partial<Record<ClinicFeatureKey, boolean>> | null | undefined,
): boolean {
  const vertical = getVerticalForApiGroup(apiGroup);
  if (!vertical) return true;
  if (!enabledFlags) return false;
  return vertical.enabledFlags.some((flag) => enabledFlags[flag] === true);
}

/** Check whether enabled flags satisfy a gated dashboard/page group. */
export function isDashboardEnabled(
  dashboard: string,
  enabledFlags: Partial<Record<ClinicFeatureKey, boolean>> | null | undefined,
): boolean {
  const requiredFlags = getDashboardRequiredFlags(dashboard);
  if (!requiredFlags) return true;
  if (!enabledFlags) return false;
  return requiredFlags.some((flag) => enabledFlags[flag] === true);
}
