/**
 * Vertical identifiers and scope-enforcement matrix.
 *
 * This module defines which verticals exist and — critically — which API groups,
 * dashboards, and feature flags each vertical gates. It is the single source of
 * truth for ADR 0013 (operations-first scope enforcement).
 *
 * Adding a new vertical:
 * 1. Add its id to the `VerticalId` union below.
 * 2. Add a `VerticalScope` entry to `VERTICAL_SCOPES`.
 * 3. Wire up its vertical-specific config in the files that key off `VerticalId`:
 *    `src/lib/template-presets.ts`, `src/lib/config/clinic-types.ts`,
 *    `src/lib/config/default-services.ts`, and `src/lib/features.ts`.
 */

import type { ClinicFeatureKey } from "@/lib/features";

/** Vertical ID — each business vertical has a unique string identifier. */
export type VerticalId = "healthcare" | "beauty" | "restaurant" | "fitness" | "veterinary";

/**
 * Scope group identifiers for gated API route groups.
 * Each maps to one or more `src/app/api/<group>/` directories.
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

/**
 * Scope group identifiers for gated dashboard route groups.
 */
type ScopedDashboard =
  | "radiology"
  | "dialysis"
  | "ivf"
  | "restaurant"
  | "veterinary"
  | "polyclinic"
  | "para-medical";

/**
 * Defines the scope for a single vertical: which API groups, dashboards,
 * and feature flags it controls. All surfaces listed here ship flag-OFF
 * by default and require explicit super-admin enablement per clinic.
 */
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

/**
 * The master scope matrix. Every "Architecture B" surface (clinical PHI +
 * non-healthcare verticals) is listed here with its gating vertical.
 *
 * A freshly-provisioned clinic sees NONE of these unless explicitly enabled.
 * Enabling is an audit-logged super-admin action.
 *
 * @see docs/adr/0013-operations-first-scope.md
 */
export const VERTICAL_SCOPES: VerticalScope[] = [
  {
    id: "clinical",
    label: "Clinical / PHI",
    enabledApiGroups: ["prescriptions", "vitals", "radiology", "insurance-claims"],
    enabledDashboards: ["radiology", "dialysis", "ivf", "polyclinic", "para-medical"],
    enabledFlags: [
      "prescriptions",
      "lab_results",
      "imaging",
      "radiology_reports",
      "lab_tests",
      "consultations",
      "ivf_cycles",
      "ivf_protocols",
      "dialysis_sessions",
      "dialysis_machines",
      "bed_management",
    ],
  },
  {
    id: "adt",
    label: "Admissions / Discharge / Transfer",
    enabledApiGroups: ["admissions"],
    enabledDashboards: [],
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

/**
 * All API groups that are gated (Architecture B surfaces).
 * Used by CI guard and middleware to verify gating is in place.
 */
export const ALL_GATED_API_GROUPS: ScopedApiGroup[] = VERTICAL_SCOPES.flatMap(
  (v) => v.enabledApiGroups,
);

/**
 * All feature flags that gate Architecture B surfaces.
 */
export const ALL_GATED_FLAGS: ClinicFeatureKey[] = [
  ...new Set(VERTICAL_SCOPES.flatMap((v) => v.enabledFlags)),
];

/**
 * Look up which vertical scope an API group belongs to.
 * Returns undefined if the API group is operational (not gated).
 */
export function getVerticalForApiGroup(apiGroup: string): VerticalScope | undefined {
  return VERTICAL_SCOPES.find((v) => v.enabledApiGroups.includes(apiGroup as ScopedApiGroup));
}

/**
 * Check whether a given set of enabled flags satisfies the requirements
 * for accessing a specific API group.
 */
export function isApiGroupEnabled(
  apiGroup: string,
  enabledFlags: Partial<Record<ClinicFeatureKey, boolean>> | null | undefined,
): boolean {
  const vertical = getVerticalForApiGroup(apiGroup);
  // Not a gated group — always enabled (operational surface)
  if (!vertical) return true;
  // No flags configured — gated groups are OFF by default
  if (!enabledFlags) return false;
  // At least one of the vertical's flags must be enabled
  return vertical.enabledFlags.some((flag) => enabledFlags[flag] === true);
}
