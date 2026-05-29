import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { familyLinkCreateSchema } from "@/lib/validations/batch4c";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/family
 *
 * Create a family link between two patients.
 * Allows managing appointments for kids/parents under one account.
 */
export const POST = withAuthValidation(
  familyLinkCreateSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const {
      primaryPatientId,
      linkedPatientId,
      relationship,
      canBookAppointments,
      canViewRecords,
      sharedBilling,
    } = data;

    if (primaryPatientId === linkedPatientId) {
      return apiError("Impossible de lier un patient à lui-même", 400, "SELF_LINK");
    }

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Verify both patients exist in this clinic
      const { data: primary } = await untypedSupabase
        .from("patients")
        .select("id")
        .eq("id", primaryPatientId)
        .eq("clinic_id", clinicId)
        .single();

      if (!primary) {
        return apiError("Patient principal introuvable", 404, "PRIMARY_NOT_FOUND");
      }

      const { data: linked } = await untypedSupabase
        .from("patients")
        .select("id")
        .eq("id", linkedPatientId)
        .eq("clinic_id", clinicId)
        .single();

      if (!linked) {
        return apiError("Patient lié introuvable", 404, "LINKED_NOT_FOUND");
      }

      const { data: familyLink, error: insertError } = await untypedSupabase
        .from("family_links")
        .insert({
          clinic_id: clinicId,
          primary_patient_id: primaryPatientId,
          linked_patient_id: linkedPatientId,
          relationship,
          can_book_appointments: canBookAppointments ?? true,
          can_view_records: canViewRecords ?? false,
          shared_billing: sharedBilling ?? false,
        })
        .select("id, relationship, can_book_appointments, can_view_records, shared_billing")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          return apiError("Lien familial déjà existant", 409, "DUPLICATE_LINK");
        }
        logger.error("Failed to create family link", {
          context: "api/family",
          error: insertError,
        });
        return apiInternalError("Échec de la création du lien familial");
      }

      await logAuditEvent({
        supabase,
        action: "family_link_created",
        type: "patient",
        clinicId,
        actor: auth.user.id,
        description: `Family link created: ${primaryPatientId} → ${linkedPatientId} (${relationship})`,
        metadata: {
          primaryPatientId,
          linkedPatientId,
          relationship,
        },
      });

      return apiSuccess({ familyLink }, 201);
    } catch (err) {
      logger.error("Family link creation failed", {
        context: "api/family",
        error: err,
      });
      return apiInternalError("Échec de la création du lien familial");
    }
  },
  ["clinic_admin", "receptionist", "patient"],
);

/**
 * GET /api/family?patientId=...
 *
 * List all family members linked to a patient.
 */
export const GET = withAuth(
  async (request: NextRequest, _auth: AuthContext) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;

    const patientId = request.nextUrl.searchParams.get("patientId");
    if (!patientId) {
      return apiError("Paramètre patientId requis", 400, "MISSING_PARAM");
    }

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Get links where patient is primary OR linked
      const { data: asParent } = await untypedSupabase
        .from("family_links")
        .select(
          "id, linked_patient_id, relationship, can_book_appointments, can_view_records, shared_billing",
        )
        .eq("clinic_id", clinicId)
        .eq("primary_patient_id", patientId);

      const { data: asChild } = await untypedSupabase
        .from("family_links")
        .select(
          "id, primary_patient_id, relationship, can_book_appointments, can_view_records, shared_billing",
        )
        .eq("clinic_id", clinicId)
        .eq("linked_patient_id", patientId);

      type LinkRow = {
        id: string;
        linked_patient_id?: string;
        primary_patient_id?: string;
        relationship: string;
        can_book_appointments: boolean;
        can_view_records: boolean;
        shared_billing: boolean;
      };

      const links = [
        ...((asParent ?? []) as LinkRow[]).map((l) => ({
          id: l.id,
          memberId: l.linked_patient_id,
          relationship: l.relationship,
          direction: "primary_to_linked" as const,
          canBookAppointments: l.can_book_appointments,
          canViewRecords: l.can_view_records,
          sharedBilling: l.shared_billing,
        })),
        ...((asChild ?? []) as LinkRow[]).map((l) => ({
          id: l.id,
          memberId: l.primary_patient_id,
          relationship: l.relationship,
          direction: "linked_to_primary" as const,
          canBookAppointments: l.can_book_appointments,
          canViewRecords: l.can_view_records,
          sharedBilling: l.shared_billing,
        })),
      ];

      return apiSuccess({ patientId, familyMembers: links });
    } catch (err) {
      logger.error("Family members list failed", {
        context: "api/family",
        error: err,
      });
      return apiInternalError("Échec de la récupération des membres de la famille");
    }
  },
  ["clinic_admin", "receptionist", "doctor", "patient"],
);

/**
 * DELETE /api/family?linkId=...
 *
 * Remove a family link.
 */
export const DELETE = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;

    const linkId = request.nextUrl.searchParams.get("linkId");
    if (!linkId) {
      return apiError("Paramètre linkId requis", 400, "MISSING_PARAM");
    }

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      const { error: deleteError } = await untypedSupabase
        .from("family_links")
        .delete()
        .eq("id", linkId)
        .eq("clinic_id", clinicId);

      if (deleteError) {
        logger.error("Failed to delete family link", {
          context: "api/family",
          error: deleteError,
        });
        return apiInternalError("Échec de la suppression du lien familial");
      }

      await logAuditEvent({
        supabase,
        action: "family_link_deleted",
        type: "patient",
        clinicId,
        actor: auth.user.id,
        description: `Family link ${linkId} deleted`,
        metadata: { linkId },
      });

      return apiSuccess({ deleted: true });
    } catch (err) {
      logger.error("Family link delete failed", {
        context: "api/family",
        error: err,
      });
      return apiInternalError("Échec de la suppression du lien familial");
    }
  },
  ["clinic_admin", "receptionist"],
);
