/**
 * Prescription Module
 *
 * Structured prescription lifecycle management with state machine
 * transitions, drug interaction checking, and audit trail.
 */

export {
  createPrescription,
  transitionPrescription,
  isValidTransition,
  checkDrugInteractions,
} from "./workflow";

export type {
  PrescriptionStatus,
  PrescriptionMedication,
  CreatePrescriptionParams,
  TransitionParams,
} from "./workflow";
