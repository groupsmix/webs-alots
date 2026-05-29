/**
 * CDSS (Clinical Decision Support System) — Barrel Export
 *
 * Pure-function library adapted from ECC healthcare-cdss-patterns.
 * Input clinical data, output alerts. Zero side effects.
 */

export { checkInteractions, INTERACTION_PAIRS, CROSS_REACTIVITY } from "./drug-interactions";
export { validateDose } from "./dose-validation";
export { calculateNEWS2 } from "./news2";
export type {
  InteractionSeverity,
  DrugInteractionPair,
  InteractionAlert,
  DoseRoute,
  DoseValidationResult,
  NEWS2Input,
  NEWS2Result,
  NEWS2Risk,
  AlertUIBehavior,
  ClinicalAlertDisplay,
} from "./types";
export { ALERT_DISPLAY_MAP } from "./types";
