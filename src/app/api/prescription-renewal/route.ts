import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { prescriptionRenewalRequestSchema } from "@/lib/validations/batch4c";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/prescription-renewal
 *
 * Request a prescription renewal.
 * Typically triggered via WhatsApp → doctor approves → pharmacy notified.
 */
export const POST = withAuthValidation(
  prescriptionRenewalRequestSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const {
      patientId,
      doctorId,
      originalPrescriptionId,
      medicationName,
      dosage,
      requestChannel,
      requestMessage,
    } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Set expiry to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: renewal, error: insertError } = await untypedSupabase
        .from("prescription_renewals")
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          doctor_id: doctorId,
          original_prescription_id: originalPrescriptionId ?? null,
          medication_name: medicationName,
          dosage: dosage ?? null,
          request_channel: requestChannel ?? "whatsapp",
          request_message: requestMessage ?? null,
          status: "pending",
          expires_at: expiresAt.toISOString(),
        })
        .select("id, status, medication_name, dosage, request_channel, created_at, expires_at")
        .single();

      if (insertError) {
        logger.error("Failed to create prescription renewal", {
          context: "api/prescription-renewal",
          error: insertError,
        });
        return apiInternalError("Failed to create renewal request");
      }

      type RenewalRow = {
        id: string;
        status: string;
        medication_name: string;
        dosage: string | null;
        request_channel: string;
        created_at: string;
        expires_at: string;
      };

      await logAuditEvent({
        supabase,
        action: "prescription_renewal_requested",
        type: "patient",
        clinicId,
        actor: auth.user.id,
        description: `Prescription renewal requested: ${medicationName}`,
        metadata: {
          renewalId: (renewal as RenewalRow).id,
          patientId,
          doctorId,
          medicationName,
        },
      });

      return apiSuccess({ renewal: renewal as RenewalRow }, 201);
    } catch (err) {
      logger.error("Prescription renewal request failed", {
        context: "api/prescription-renewal",
        error: err,
      });
      return apiInternalError("Failed to create renewal request");
    }
  },
  ["clinic_admin", "receptionist", "doctor", "patient"],
);

/**
 * GET /api/prescription-renewal?patientId=...&status=...&doctorId=...
 *
 * List prescription renewals for the clinic.
 */
export const GET = withAuth(
  async (request: NextRequest, _auth: AuthContext) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      const url = request.nextUrl;
      const patientId = url.searchParams.get("patientId");
      const doctorId = url.searchParams.get("doctorId");
      const status = url.searchParams.get("status");

      let query = untypedSupabase
        .from("prescription_renewals")
        .select(
          "id, patient_id, doctor_id, medication_name, dosage, request_channel, status, reviewed_at, pharmacy_name, dispensed_at, created_at, expires_at",
        )
        .eq("clinic_id", clinicId);

      if (patientId) query = query.eq("patient_id", patientId);
      if (doctorId) query = query.eq("doctor_id", doctorId);
      if (status) query = query.eq("status", status);

      const { data: renewals, error } = await query.order("created_at", { ascending: false });

      if (error) {
        logger.error("Failed to list prescription renewals", {
          context: "api/prescription-renewal",
          error,
        });
        return apiInternalError("Failed to list renewals");
      }

      return apiSuccess({ renewals: renewals ?? [] });
    } catch (err) {
      logger.error("Prescription renewal list failed", {
        context: "api/prescription-renewal",
        error: err,
      });
      return apiInternalError("Failed to list renewals");
    }
  },
  ["clinic_admin", "receptionist", "doctor", "patient"],
);
