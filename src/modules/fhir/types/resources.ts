/**
 * FHIR R4 resource type definitions for the proxy boundary layer.
 *
 * These types model the subset of FHIR resources that Oltigo Health
 * exchanges with external EHR systems. They follow the HL7 FHIR R4
 * specification while remaining practical for our use case.
 *
 * @see https://hl7.org/fhir/R4/
 */

/** FHIR resource type identifiers used by the proxy. */
export type FhirResourceType = "Patient" | "Appointment" | "Observation" | "MedicationRequest";

/** Base fields shared by all FHIR resources. */
export interface FhirResource {
  resourceType: FhirResourceType;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    source?: string;
  };
}

/** FHIR HumanName component. */
export interface FhirHumanName {
  use?: "official" | "usual" | "nickname";
  family?: string;
  given?: string[];
  prefix?: string[];
}

/** FHIR ContactPoint (phone, email). */
export interface FhirContactPoint {
  system?: "phone" | "email" | "fax";
  value?: string;
  use?: "home" | "work" | "mobile";
}

/** FHIR Patient resource (R4). */
export interface FhirPatient extends FhirResource {
  resourceType: "Patient";
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  address?: Array<{
    use?: "home" | "work";
    line?: string[];
    city?: string;
    postalCode?: string;
    country?: string;
  }>;
  identifier?: Array<{
    system?: string;
    value?: string;
  }>;
}

/** FHIR Appointment resource (R4). */
export interface FhirAppointment extends FhirResource {
  resourceType: "Appointment";
  status: "proposed" | "pending" | "booked" | "arrived" | "fulfilled" | "cancelled" | "noshow";
  start?: string;
  end?: string;
  participant?: Array<{
    actor?: { reference?: string; display?: string };
    status: "accepted" | "declined" | "tentative" | "needs-action";
  }>;
  reasonCode?: Array<{ text?: string }>;
}

/** FHIR Observation resource (R4) — used for vitals. */
export interface FhirObservation extends FhirResource {
  resourceType: "Observation";
  status: "registered" | "preliminary" | "final" | "amended";
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: { reference?: string };
  effectiveDateTime?: string;
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  component?: Array<{
    code: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    valueQuantity?: {
      value?: number;
      unit?: string;
    };
  }>;
}

/** FHIR MedicationRequest resource (R4). */
export interface FhirMedicationRequest extends FhirResource {
  resourceType: "MedicationRequest";
  status: "active" | "on-hold" | "cancelled" | "completed" | "stopped" | "draft";
  intent: "proposal" | "plan" | "order" | "original-order" | "reflex-order";
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: { reference?: string };
  authoredOn?: string;
  requester?: { reference?: string; display?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: "s" | "min" | "h" | "d" | "wk" | "mo";
      };
    };
    doseAndRate?: Array<{
      doseQuantity?: {
        value?: number;
        unit?: string;
      };
    }>;
  }>;
}

/** Union of all supported FHIR resources. */
export type AnyFhirResource =
  | FhirPatient
  | FhirAppointment
  | FhirObservation
  | FhirMedicationRequest;

/** FHIR Bundle for batch responses. */
export interface FhirBundle {
  resourceType: "Bundle";
  type: "searchset" | "batch-response" | "collection";
  total?: number;
  entry?: Array<{
    resource?: AnyFhirResource;
    fullUrl?: string;
  }>;
}

/** FHIR OperationOutcome for error responses. */
export interface FhirOperationOutcome {
  resourceType: "OperationOutcome";
  issue: Array<{
    severity: "fatal" | "error" | "warning" | "information";
    code: string;
    diagnostics?: string;
  }>;
}
