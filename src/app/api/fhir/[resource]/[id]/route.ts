/**
 * GET /api/fhir/[resource]/[id]
 *
 * FHIR read interactions for specific resources.
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";
import { FhirProxy } from "@/modules/fhir/boundary/fhir-proxy";

const ALLOWED_RESOURCE_TYPES = new Set(["Patient"]);

export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    
    // Extract [resource] and [id] from the path manually
    // e.g. /api/fhir/Patient/123 -> parts = ["", "api", "fhir", "Patient", "123"]
    const parts = request.nextUrl.pathname.split("/");
    const id = parts.pop();
    const resourceType = parts.pop();

    if (!resourceType || !ALLOWED_RESOURCE_TYPES.has(resourceType)) {
      return apiError(
        "Type de ressource FHIR non supporté ou invalide pour cette opération",
        400,
        "INVALID_RESOURCE_TYPE",
      );
    }

    if (!id) {
      return apiError("ID requis", 400, "MISSING_ID");
    }

    const proxy = new FhirProxy(auth.supabase, tenant.clinicId);

    if (resourceType === "Patient") {
      const result = await proxy.readPatient(id);
      if (!result.ok) {
        return apiError(result.outcome.issue[0]?.diagnostics ?? "Erreur", 404, "NOT_FOUND");
      }
      return apiSuccess(result.data);
    }

    return apiError("Opération non supportée", 400, "UNSUPPORTED_OPERATION");
  },
  ["super_admin", "clinic_admin", "doctor"],
);
