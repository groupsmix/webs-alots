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

/** Vertical ID — each business vertical has a unique string identifier. */
export type VerticalId = "healthcare" | "beauty" | "restaurant" | "fitness" | "veterinary";
