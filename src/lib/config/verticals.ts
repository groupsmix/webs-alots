/**
 * Vertical identifiers for the supported business verticals
 * (healthcare, beauty, restaurant, fitness, veterinary).
 *
 * This module is intentionally just the `VerticalId` union — the single source
 * of truth for which verticals exist. There is no `VerticalDefinition` type,
 * no `src/lib/config/verticals/` directory, and no `vertical-registry.ts`.
 *
 * Adding a new vertical:
 * 1. Add its id to the `VerticalId` union below.
 * 2. Wire up its vertical-specific config in the files that key off `VerticalId`:
 *    `src/lib/template-presets.ts`, `src/lib/config/clinic-types.ts`,
 *    `src/lib/config/default-services.ts`, and `src/lib/features.ts`.
 */

/** Vertical ID — each business vertical has a unique string identifier. */
export type VerticalId = "healthcare" | "beauty" | "restaurant" | "fitness" | "veterinary";
