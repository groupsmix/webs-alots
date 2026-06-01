/**
 * GET /api/fhir/metadata — FHIR CapabilityStatement
 *
 * Exposes the capabilities of the Oltigo Health FHIR endpoint.
 */

import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(
  async (_request: NextRequest) => {
    const capabilityStatement = {
      resourceType: "CapabilityStatement",
      status: "active",
      date: new Date().toISOString(),
      publisher: "Oltigo Health",
      kind: "instance",
      software: {
        name: "Oltigo Health FHIR API",
        version: "1.0.0",
      },
      fhirVersion: "4.0.1",
      format: ["application/fhir+json"],
      rest: [
        {
          mode: "server",
          resource: [
            {
              type: "Patient",
              profile: "http://hl7.org/fhir/StructureDefinition/Patient",
              interaction: [
                { code: "read" },
                { code: "search-type" },
                { code: "create" }
              ],
              searchParam: [
                { name: "name", type: "string" },
                { name: "phone", type: "string" },
                { name: "_count", type: "number" }
              ]
            },
            {
              type: "Observation",
              profile: "http://hl7.org/fhir/StructureDefinition/Observation",
              interaction: [
                { code: "search-type" }
              ],
              searchParam: [
                { name: "patient", type: "reference" },
                { name: "_count", type: "number" }
              ]
            },
            {
              type: "MedicationRequest",
              profile: "http://hl7.org/fhir/StructureDefinition/MedicationRequest",
              interaction: [
                { code: "search-type" }
              ],
              searchParam: [
                { name: "patient", type: "reference" }
              ]
            },
            {
              type: "Appointment",
              profile: "http://hl7.org/fhir/StructureDefinition/Appointment",
              interaction: [
                { code: "search-type" }
              ],
              searchParam: [
                { name: "patient", type: "reference" },
                { name: "actor", type: "reference" }
              ]
            }
          ]
        }
      ]
    };

    return apiSuccess(capabilityStatement);
  },
  ["super_admin", "clinic_admin", "doctor"],
);
