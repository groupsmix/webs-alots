/**
 * FHIR Proxy Boundary — API layer for EHR system interoperability.
 *
 * Adapted from healthcare CRM patterns (Helsa DDD architecture).
 * This boundary layer acts as a facade between Oltigo Health's internal
 * data model and external EHR systems that speak FHIR R4.
 *
 * Design principles:
 *   1. All FHIR operations are tenant-scoped (clinic_id required)
 *   2. PHI is encrypted in transit via TLS; at rest via our encryption layer
 *   3. Every EHR interaction is audit-logged for HIPAA/Law 09-08 compliance
 *   4. Mappers handle format translation — business logic stays in our domain
 *
 * @see https://hl7.org/fhir/R4/http.html
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";
import { toFhirObservations } from "../mappers/observation-mapper";
import { toFhirPatient, fromFhirPatient } from "../mappers/patient-mapper";
import { toFhirMedicationRequests, type OltigoPrescriptionRow } from "../mappers/medication-request-mapper";
import { toFhirAppointment, type OltigoAppointmentRow } from "../mappers/appointment-mapper";
import type {
  FhirBundle,
  FhirOperationOutcome,
  FhirPatient,
  FhirResourceType,
} from "../types/resources";

/** Configuration for an external EHR endpoint. */
export interface EhrEndpointConfig {
  baseUrl: string;
  authToken: string;
  /** Timeout in milliseconds for EHR requests. */
  timeoutMs?: number;
}

/** Result of a FHIR proxy operation. */
export type FhirProxyResult<T> =
  | { ok: true; data: T }
  | { ok: false; outcome: FhirOperationOutcome };

function operationOutcome(
  severity: "error" | "warning",
  code: string,
  diagnostics: string,
): FhirOperationOutcome {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity, code, diagnostics }],
  };
}

/**
 * FHIR Proxy — mediates all EHR interactions with tenant scoping.
 *
 * Usage:
 *   const proxy = new FhirProxy(supabase, clinicId);
 *   const result = await proxy.searchPatients({ name: "Mohammed" });
 */
export class FhirProxy {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly clinicId: string,
  ) {}

  /**
   * Search patients in the local DB, return as FHIR Bundle.
   * This does NOT call an external EHR — it exposes our patients in FHIR format.
   */
  async searchPatients(params: {
    name?: string;
    phone?: string;
    limit?: number;
  }): Promise<FhirProxyResult<FhirBundle>> {
    try {
      let query = this.supabase
        .from("users")
        .select("id, name, email, phone, clinic_id, metadata")
        .eq("clinic_id", this.clinicId)
        .eq("role", "patient")
        .limit(params.limit ?? 20);

      if (params.name) {
        query = query.ilike("name", `%${params.name}%`);
      }
      if (params.phone) {
        query = query.eq("phone", params.phone);
      }

      const { data, error } = await query;

      if (error) {
        logger.error("FHIR patient search failed", {
          context: "fhir-proxy",
          clinicId: this.clinicId,
          error,
        });
        return {
          ok: false,
          outcome: operationOutcome("error", "exception", "Erreur de recherche patient"),
        };
      }

      const entries = (data ?? []).map((row) => {
        const r = row as {
          id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          clinic_id: string;
          metadata?: Record<string, unknown> | null;
        };
        const patientRow = {
          id: r.id,
          full_name: r.name,
          email: r.email,
          phone: r.phone,
          clinic_id: r.clinic_id,
          date_of_birth: (r.metadata as Record<string, string> | null)?.date_of_birth ?? null,
          gender: (r.metadata as Record<string, string> | null)?.gender ?? null,
          address: (r.metadata as Record<string, string> | null)?.address ?? null,
          insurance_type: (r.metadata as Record<string, string> | null)?.insurance_type ?? null,
        };
        return {
          resource: toFhirPatient(patientRow),
          fullUrl: `urn:uuid:${r.id}`,
        };
      });

      const bundle: FhirBundle = {
        resourceType: "Bundle",
        type: "searchset",
        total: entries.length,
        entry: entries,
      };

      await logAuditEvent({
        supabase: this.supabase,
        action: "fhir.patient.search",
        type: "patient",
        clinicId: this.clinicId,
        description: `Recherche FHIR patients (${entries.length} résultats)`,
        metadata: { resultCount: entries.length, hasNameFilter: !!params.name },
      });

      return { ok: true, data: bundle };
    } catch (err) {
      logger.error("FHIR patient search error", { context: "fhir-proxy", error: err });
      return { ok: false, outcome: operationOutcome("error", "exception", "Erreur interne") };
    }
  }

  /**
   * Read a single patient by ID, returned as FHIR Patient.
   */
  async readPatient(patientId: string): Promise<FhirProxyResult<FhirPatient>> {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("id, name, email, phone, clinic_id, metadata")
        .eq("clinic_id", this.clinicId)
        .eq("id", patientId)
        .eq("role", "patient")
        .single();

      if (error || !data) {
        return { ok: false, outcome: operationOutcome("error", "not-found", "Patient non trouvé") };
      }

      const r = data as {
        id: string;
        name: string;
        email?: string | null;
        phone?: string | null;
        clinic_id: string;
        metadata?: Record<string, unknown> | null;
      };
      const patientRow = {
        id: r.id,
        full_name: r.name,
        email: r.email,
        phone: r.phone,
        clinic_id: r.clinic_id,
      };

      await logAuditEvent({
        supabase: this.supabase,
        action: "fhir.patient.read",
        type: "patient",
        clinicId: this.clinicId,
        metadata: { patientId },
      });

      return { ok: true, data: toFhirPatient(patientRow) };
    } catch (err) {
      logger.error("FHIR patient read error", { context: "fhir-proxy", error: err });
      return { ok: false, outcome: operationOutcome("error", "exception", "Erreur interne") };
    }
  }

  /**
   * Import a patient from a FHIR Patient resource into the local DB.
   * The clinic_id is always set from tenant context — never from the FHIR payload.
   */
  async importPatient(
    fhirPatient: FhirPatient,
    actorId: string,
  ): Promise<FhirProxyResult<{ id: string }>> {
    try {
      const mapped = fromFhirPatient(fhirPatient);

      if (!mapped.full_name) {
        return {
          ok: false,
          outcome: operationOutcome("error", "required", "Le nom du patient est requis"),
        };
      }

      const { data, error } = await this.supabase
        .from("users")
        .insert({
          name: mapped.full_name,
          email: mapped.email ?? null,
          phone: mapped.phone ?? null,
          role: "patient",
          clinic_id: this.clinicId,
          metadata: {
            date_of_birth: mapped.date_of_birth ?? null,
            gender: mapped.gender ?? null,
            address: mapped.address ?? null,
            insurance_type: mapped.insurance_type ?? null,
            source: "fhir_import",
          },
        })
        .select("id")
        .single();

      if (error) {
        logger.error("FHIR patient import failed", { context: "fhir-proxy", error });
        return {
          ok: false,
          outcome: operationOutcome("error", "exception", "Erreur lors de l'import"),
        };
      }

      await logAuditEvent({
        supabase: this.supabase,
        action: "fhir.patient.import",
        type: "patient",
        clinicId: this.clinicId,
        actor: actorId,
        description: `Import patient FHIR: ${mapped.full_name}`,
        metadata: { patientId: data.id, source: fhirPatient.meta?.source },
      });

      return { ok: true, data: { id: data.id } };
    } catch (err) {
      logger.error("FHIR patient import error", { context: "fhir-proxy", error: err });
      return { ok: false, outcome: operationOutcome("error", "exception", "Erreur interne") };
    }
  }

  /**
   * Get patient vitals as FHIR Observations.
   */
  async getPatientVitals(
    patientId: string,
    options?: { limit?: number },
  ): Promise<FhirProxyResult<FhirBundle>> {
    try {
      const { data, error } = await (this.supabase as SupabaseClient)
        .from("patient_vitals")
        .select("*")
        .eq("clinic_id", this.clinicId)
        .eq("patient_id", patientId)
        .order("recorded_at", { ascending: false })
        .limit(options?.limit ?? 50);

      if (error) {
        logger.error("FHIR vitals query failed", { context: "fhir-proxy", error });
        return {
          ok: false,
          outcome: operationOutcome("error", "exception", "Erreur de lecture des signes vitaux"),
        };
      }

      const observations = (data ?? []).flatMap((row) =>
        toFhirObservations(row as import("../mappers/observation-mapper").OltigoVitalsRow),
      );
      const bundle: FhirBundle = {
        resourceType: "Bundle",
        type: "searchset",
        total: observations.length,
        entry: observations.map((obs) => ({
          resource: obs,
          fullUrl: `urn:uuid:${obs.id}`,
        })),
      };

      return { ok: true, data: bundle };
    } catch (err) {
      logger.error("FHIR vitals error", { context: "fhir-proxy", error: err });
      return { ok: false, outcome: operationOutcome("error", "exception", "Erreur interne") };
    }
  }

  /**
   * Get patient prescriptions as FHIR MedicationRequests.
   */
  async searchMedicationRequests(params: {
    patientId: string;
  }): Promise<FhirProxyResult<FhirBundle>> {
    try {
      const { data, error } = await (this.supabase as SupabaseClient)
        .from("prescriptions")
        .select("*")
        .eq("clinic_id", this.clinicId)
        .eq("patient_id", params.patientId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("FHIR prescriptions query failed", { context: "fhir-proxy", error });
        return {
          ok: false,
          outcome: operationOutcome("error", "exception", "Erreur de lecture des prescriptions"),
        };
      }

      const medicationRequests = (data ?? []).flatMap((row) =>
        toFhirMedicationRequests(row as OltigoPrescriptionRow),
      );

      const bundle: FhirBundle = {
        resourceType: "Bundle",
        type: "searchset",
        total: medicationRequests.length,
        entry: medicationRequests.map((req) => ({
          resource: req,
          fullUrl: `urn:uuid:${req.id}`,
        })),
      };

      return { ok: true, data: bundle };
    } catch (err) {
      logger.error("FHIR prescriptions error", { context: "fhir-proxy", error: err });
      return { ok: false, outcome: operationOutcome("error", "exception", "Erreur interne") };
    }
  }

  /**
   * Search appointments for a patient or doctor as FHIR Appointments.
   */
  async searchAppointments(params: {
    patientId?: string;
    doctorId?: string;
  }): Promise<FhirProxyResult<FhirBundle>> {
    try {
      let query = (this.supabase as SupabaseClient)
        .from("appointments")
        .select("*")
        .eq("clinic_id", this.clinicId)
        .order("slot_start", { ascending: false })
        .limit(100);

      if (params.patientId) query = query.eq("patient_id", params.patientId);
      if (params.doctorId) query = query.eq("doctor_id", params.doctorId);

      const { data, error } = await query;

      if (error) {
        logger.error("FHIR appointments query failed", { context: "fhir-proxy", error });
        return {
          ok: false,
          outcome: operationOutcome("error", "exception", "Erreur de lecture des rendez-vous"),
        };
      }

      const appointments = (data ?? []).map((row) =>
        toFhirAppointment(row as OltigoAppointmentRow),
      );

      const bundle: FhirBundle = {
        resourceType: "Bundle",
        type: "searchset",
        total: appointments.length,
        entry: appointments.map((appt) => ({
          resource: appt,
          fullUrl: `urn:uuid:${appt.id}`,
        })),
      };

      return { ok: true, data: bundle };
    } catch (err) {
      logger.error("FHIR appointments error", { context: "fhir-proxy", error: err });
      return { ok: false, outcome: operationOutcome("error", "exception", "Erreur interne") };
    }
  }

  /**
   * Push a FHIR resource to an external EHR system.
   * This is the outbound proxy — sends data OUT to connected EHR endpoints.
   */
  async pushToEhr(

    resourceType: FhirResourceType,
    resource: unknown,
    endpoint: EhrEndpointConfig,
    actorId: string,
  ): Promise<FhirProxyResult<{ ehrId: string }>> {
    const timeoutMs = endpoint.timeoutMs ?? 10_000;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${endpoint.baseUrl}/${resourceType}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/fhir+json",
          Authorization: `Bearer ${endpoint.authToken}`,
          Accept: "application/fhir+json",
        },
        body: JSON.stringify(resource),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        logger.error("EHR push rejected", {
          context: "fhir-proxy",
          clinicId: this.clinicId,
          status: response.status,
          body: body.slice(0, 500),
        });
        return {
          ok: false,
          outcome: operationOutcome(
            "error",
            "exception",
            `Système DSÉ a rejeté la requête (${response.status})`,
          ),
        };
      }

      const result = (await response.json()) as { id?: string };

      await logAuditEvent({
        supabase: this.supabase,
        action: "fhir.ehr.push",
        type: "admin",
        clinicId: this.clinicId,
        actor: actorId,
        description: `Envoi ${resourceType} vers DSÉ externe`,
        metadata: { resourceType, ehrId: result.id, endpoint: endpoint.baseUrl },
      });

      return { ok: true, data: { ehrId: result.id ?? "unknown" } };
    } catch (err) {
      logger.error("EHR push failed", { context: "fhir-proxy", error: err });
      return {
        ok: false,
        outcome: operationOutcome("error", "transient", "Connexion au DSÉ échouée"),
      };
    }
  }
}
