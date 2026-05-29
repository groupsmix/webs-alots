/**
 * FHIR R4 API Endpoint
 *
 * Exposes a FHIR-compatible API for EHR system interoperability.
 * Supports Patient search, read, and import operations.
 *
 * All operations are tenant-scoped and audit-logged.
 *
 * GET  /api/fhir?type=Patient&name=...  → Search patients (FHIR Bundle)
 * GET  /api/fhir?type=Patient&id=...    → Read single patient
 * GET  /api/fhir?type=Observation&patient=... → Patient vitals
 * POST /api/fhir                         → Import FHIR resource
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";
import { FhirProxy } from "@/modules/fhir/boundary/fhir-proxy";

const ALLOWED_RESOURCE_TYPES = new Set(["Patient", "Observation"]);

export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get("type");

    if (!resourceType || !ALLOWED_RESOURCE_TYPES.has(resourceType)) {
      return apiError(
        "Type de ressource FHIR requis (Patient, Observation)",
        400,
        "INVALID_RESOURCE_TYPE",
      );
    }

    const proxy = new FhirProxy(auth.supabase, tenant.clinicId);

    if (resourceType === "Patient") {
      const id = searchParams.get("id");
      if (id) {
        const result = await proxy.readPatient(id);
        if (!result.ok) {
          return apiError(result.outcome.issue[0]?.diagnostics ?? "Erreur", 404, "NOT_FOUND");
        }
        return apiSuccess(result.data);
      }

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

    return apiError("Type de ressource non supporté", 400, "UNSUPPORTED_TYPE");
  },
  ["super_admin", "clinic_admin", "doctor"],
);

export const POST = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
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

    if (resource.resourceType === "Patient") {
      const result = await proxy.importPatient(
        resource as import("@/modules/fhir/types/resources").FhirPatient,
        auth.user.id,
      );

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
