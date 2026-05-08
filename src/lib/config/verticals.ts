/**
 * Vertical Definitions — Plugin architecture for business verticals.
 *
 * Each vertical (healthcare, beauty, restaurant, fitness, veterinary)
 * defines its own config in ONE place: terminology, default features,
 * default services, template presets, and category mappings.
 *
 * Adding a new vertical is a 15-minute config task:
 * 1. Create a new file in src/lib/config/verticals/
 * 2. Export a VerticalDefinition
 * 3. Import it in vertical-registry.ts
 */

import type { DefaultService } from "@/lib/config/default-services";
import type { ClinicFeatureKey } from "@/lib/features";
import type { ClinicTypeCategory } from "@/lib/types/database";

/** Vertical ID — each business vertical has a unique string identifier. */
export type VerticalId =
  | "healthcare"
  | "beauty"
  | "restaurant"
  | "fitness"
  | "veterinary";

/** Terminology mapping — adapts UI labels per vertical. */
export interface VerticalTerminology {
  /** What to call the end-user: "patient" | "client" | "member" | "guest" */
  client: string;
  /** What to call the service provider: "doctor" | "stylist" | "trainer" | "chef" */
  provider: string;
  /** What to call a booking: "appointment" | "reservation" | "session" | "booking" */
  appointment: string;
  /** What to call the business location: "clinic" | "salon" | "gym" | "restaurant" */
  location: string;
}

/**
 * Full vertical definition — everything needed to configure
 * a business vertical in one place.
 */
export interface VerticalDefinition {
  /** Unique identifier for this vertical */
  id: VerticalId;
  /** Display name in English */
  nameEn: string;
  /** Display name in French */
  nameFr: string;
  /** Display name in Arabic */
  nameAr: string;
  /** Lucide icon name for UI display */
  icon: string;
  /** Which clinic type categories belong to this vertical */
  categories: ClinicTypeCategory[];
  /** Feature flags enabled by default for this vertical */
  defaultFeatures: ClinicFeatureKey[];
  /** Default services seeded during onboarding */
  defaultServices: DefaultService[];
  /** UI terminology for this vertical */
  terminology: VerticalTerminology;
  /** Template preset IDs recommended for this vertical */
  templatePresets: string[];
  /** Extra database tables needed (e.g., "menus" for restaurant) */
  requiredDbTables?: string[];
}
