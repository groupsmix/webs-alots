/**
 * Backward-compatible re-export.
 *
 * The validation schemas have been split into domain-specific modules under
 * `src/lib/validations/`. This file re-exports everything so that existing
 * `import { ... } from "@/lib/validations"` statements continue to work.
 *
 * New code should import from the specific module, e.g.:
 *   import { bookingCancelSchema } from "@/lib/validations/booking";
 */
export * from "./validations/index";
