/**
 * FHIR Interoperability Module
 *
 * Domain-driven module for EHR system integration following the
 * FHIR R4 specification. Provides:
 *   - Type-safe FHIR resource definitions
 *   - Bidirectional mappers (Oltigo ↔ FHIR)
 *   - Proxy boundary for external EHR communication
 *
 * Architecture (adapted from Helsa DDD patterns):
 *   types/     — FHIR R4 resource type definitions
 *   mappers/   — Data transformation between internal and FHIR formats
 *   boundary/  — Proxy layer that mediates EHR interactions
 */

export { FhirProxy } from "./boundary/fhir-proxy";
export type { EhrEndpointConfig, FhirProxyResult } from "./boundary/fhir-proxy";

export { toFhirPatient, fromFhirPatient } from "./mappers/patient-mapper";
export type { OltigoPatientRow } from "./mappers/patient-mapper";

export { toFhirObservations } from "./mappers/observation-mapper";
export type { OltigoVitalsRow } from "./mappers/observation-mapper";

export type {
  FhirResourceType,
  FhirResource,
  FhirPatient,
  FhirAppointment,
  FhirObservation,
  FhirMedicationRequest,
  FhirBundle,
  FhirOperationOutcome,
  AnyFhirResource,
} from "./types/resources";
