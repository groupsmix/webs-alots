/**
 * Vertical Registry — Auto-discovery and lookup for business verticals.
 *
 * Imports all vertical definitions and provides lookup functions.
 * Used by:
 * - Onboarding flow to show available verticals
 * - Feature flags to auto-enable vertical-specific features
 * - Templates to filter presets by vertical
 */

import type { VerticalDefinition, VerticalId } from "@/lib/config/verticals";
import { beautyVertical } from "@/lib/config/verticals/beauty";
import { fitnessVertical } from "@/lib/config/verticals/fitness";
import { healthcareVertical } from "@/lib/config/verticals/healthcare";
import { restaurantVertical } from "@/lib/config/verticals/restaurant";
import { veterinaryVertical } from "@/lib/config/verticals/veterinary";
import type { ClinicTypeCategory } from "@/lib/types/database";

/** All registered verticals, keyed by ID. */
const VERTICALS: Record<VerticalId, VerticalDefinition> = {
  healthcare: healthcareVertical,
  beauty: beautyVertical,
  restaurant: restaurantVertical,
  fitness: fitnessVertical,
  veterinary: veterinaryVertical,
};

/**
 * Get a vertical definition by its ID.
 * Returns undefined if the vertical is not registered.
 */
export function getVertical(id: string): VerticalDefinition | undefined {
  return VERTICALS[id as VerticalId];
}

/**
 * List all registered verticals.
 * Returns an array of VerticalDefinition objects.
 */
export function listVerticals(): VerticalDefinition[] {
  return Object.values(VERTICALS);
}

/**
 * Find the vertical that owns a given clinic type category.
 *
 * Searches through all verticals' `categories` arrays to find
 * the one that contains the given category. Returns undefined
 * if no vertical claims the category.
 *
 * Note: Healthcare is the fallback vertical since it owns the
 * most categories. If a category is not found in any vertical,
 * this returns undefined and the caller should default to healthcare.
 */
export function getVerticalForClinicType(
  category: ClinicTypeCategory,
): VerticalDefinition | undefined {
  for (const vertical of Object.values(VERTICALS)) {
    if (vertical.categories.includes(category)) {
      return vertical;
    }
  }
  return undefined;
}

/**
 * Get all vertical IDs as a simple string array.
 * Useful for dropdown menus and validation.
 */
export function getVerticalIds(): VerticalId[] {
  return Object.keys(VERTICALS) as VerticalId[];
}
