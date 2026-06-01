/**
 * FHIR R4 API Endpoint
 *
 * Exposes a FHIR-compatible API for EHR system interoperability.
 * Supports Patient search, read, and import operations.
 *
 * All operations are tenant-scoped and audit-logged.
 *
 * GET  /api/fhir/Patient?name=...  → Search patients (FHIR Bundle)
 * GET  /api/fhir/Observation?patient=... → Patient vitals
 * POST /api/fhir/Patient           → Import FHIR Patient resource
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";
import { FhirProxy } from "@/modules/fhir/boundary/fhir-proxy";
import type { FhirPatient } from "@/modules/fhir/types/resources";

const ALLOWED_RESOURCE_TYPES = new Set([
  "Patient",
  "Observation",
  "MedicationRequest",
  "Appointment",
]);

export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const { searchParams, pathname } = new URL(request.url);
    const resourceType = pathname.split("/").pop();

    if (!resourceType || !ALLOWED_RESOURCE_TYPES.has(resourceType)) {
      return apiError(
        "Type de ressource FHIR requis (Patient, Observation, MedicationRequest, Appointment)",
        400,
        "INVALID_RESOURCE_TYPE",
      );
    }

    const proxy = new FhirProxy(auth.supabase, tenant.clinicId);

    if (resourceType === "Patient") {
      const result = await proxy.searchPatients({
        name: searchParams.get("name") ?? undefined,
        phone: searchParams.get("phone") ?? undefined,
        limit: Math.min(parseInt(searchParams.get("_count") ?? "20", 10), 100),
      });

      if (!result.ok) {
        return apiError(
          result.outcome.issue[0]?.diagnostics ?? "Erreur de recherche",
          500,
          "SEARCH_FAILED",
        );
      }

      return apiSuccess(result.data);
    }

    if (resourceType === "Observation") {
      const patientId = searchParams.get("patient");
      if (!patientId) {
        return apiError("Paramètre 'patient' requis pour les observations", 400, "MISSING_PATIENT");
      }

      const result = await proxy.getPatientVitals(patientId, {
        limit: Math.min(parseInt(searchParams.get("_count") ?? "50", 10), 200),
      });

      if (!result.ok) {
        return apiError(result.outcome.issue[0]?.diagnostics ?? "Erreur", 500, "VITALS_FAILED");
      }

      return apiSuccess(result.data);
    }

    if (resourceType === "MedicationRequest") {
      const patientId = searchParams.get("patient");
      if (!patientId) {
        return apiError(
          "Paramètre 'patient' requis pour MedicationRequest",
          400,
          "MISSING_PATIENT",
        );
      }

      const result = await proxy.searchMedicationRequests({ patientId });
      if (!result.ok) {
        return apiError(
          result.outcome.issue[0]?.diagnostics ?? "Erreur",
          500,
          "MEDICATION_REQUEST_FAILED",
        );
      }

      return apiSuccess(result.data);
    }

    if (resourceType === "Appointment") {
      const patientId = searchParams.get("patient");
      const doctorId = searchParams.get("actor");

      const result = await proxy.searchAppointments({
        patientId: patientId ?? undefined,
        doctorId: doctorId ?? undefined,
      });
      if (!result.ok) {
        return apiError(
          result.outcome.issue[0]?.diagnostics ?? "Erreur",
          500,
          "APPOINTMENT_FAILED",
        );
      }

      return apiSuccess(result.data);
    }

    return apiError("Type de ressource non supporté", 400, "UNSUPPORTED_TYPE");
  },
  ["super_admin", "clinic_admin", "doctor"],
);

export const POST = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const { pathname } = new URL(request.url);
    const resourceType = pathname.split("/").pop();

    if (!resourceType || !ALLOWED_RESOURCE_TYPES.has(resourceType)) {
      return apiError("Type de ressource FHIR invalide", 400, "INVALID_RESOURCE_TYPE");
    }

    const proxy = new FhirProxy(auth.supabase, tenant.clinicId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Corps JSON invalide", 400, "INVALID_JSON");
    }

    if (!body || typeof body !== "object" || !("resourceType" in body)) {
      return apiError("Ressource FHIR invalide — resourceType requis", 400, "INVALID_FHIR");
    }

    const resource = body as { resourceType: string };

    if (resource.resourceType !== resourceType) {
      return apiError(
        `Incohérence entre URL (${resourceType}) et body (${resource.resourceType})`,
        400,
        "RESOURCE_MISMATCH",
      );
    }

    if (resource.resourceType === "Patient") {
      const result = await proxy.importPatient(resource as FhirPatient, auth.user.id);

      if (!result.ok) {
        return apiError(
          result.outcome.issue[0]?.diagnostics ?? "Erreur d'import",
          422,
          "IMPORT_FAILED",
        );
      }

      return apiSuccess(result.data);
    }

    return apiError(
      `Import de type '${resource.resourceType}' non supporté`,
      400,
      "UNSUPPORTED_IMPORT",
    );
  },
  ["super_admin", "clinic_admin"],
);
