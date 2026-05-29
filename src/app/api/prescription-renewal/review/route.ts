import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { prescriptionRenewalReviewSchema } from "@/lib/validations/batch4c";
import { sendTextMessage } from "@/lib/whatsapp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/prescription-renewal/review
 *
 * Doctor reviews a prescription renewal request — approve or reject.
 * On approval, optionally notifies pharmacy via WhatsApp.
 */
export const POST = withAuthValidation(
  prescriptionRenewalReviewSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const { renewalId, action, doctorNotes, rejectionReason, pharmacyName, pharmacyPhone } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Fetch existing renewal
      const { data: existing, error: fetchError } = await untypedSupabase
        .from("prescription_renewals")
        .select("id, status, patient_id, medication_name, dosage")
        .eq("id", renewalId)
        .eq("clinic_id", clinicId)
        .single();

      if (fetchError || !existing) {
        return apiError("Demande de renouvellement introuvable", 404, "NOT_FOUND");
      }

      type RenewalRow = {
        id: string;
        status: string;
        patient_id: string;
        medication_name: string;
        dosage: string | null;
      };
      const renewal = existing as RenewalRow;

      if (renewal.status !== "pending") {
        return apiError(
          "Seuls les renouvellements en attente peuvent être examinés",
          400,
          "INVALID_STATUS",
        );
      }

      const newStatus = action === "approve" ? "approved" : "rejected";
      const updateFields: Record<string, unknown> = {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.profile.id,
        doctor_notes: doctorNotes ?? null,
        updated_at: new Date().toISOString(),
      };

      if (action === "reject") {
        updateFields.rejection_reason = rejectionReason ?? null;
      }

      if (action === "approve" && pharmacyName) {
        updateFields.pharmacy_name = pharmacyName;
        updateFields.pharmacy_phone = pharmacyPhone ?? null;
      }

      const { error: updateError } = await untypedSupabase
        .from("prescription_renewals")
        .update(updateFields)
        .eq("id", renewalId)
        .eq("clinic_id", clinicId);

      if (updateError) {
        logger.error("Failed to update renewal status", {
          context: "api/prescription-renewal/review",
          error: updateError,
        });
        return apiInternalError("Échec de l'examen du renouvellement");
      }

      // If approved and pharmacy phone provided, notify pharmacy via WhatsApp
      if (action === "approve" && pharmacyPhone) {
        try {
          await sendTextMessage(
            pharmacyPhone,
            `Renouvellement d'ordonnance approuvé:\nPatient ID: ${renewal.patient_id}\nMédicament: ${renewal.medication_name}\nPosologie: ${renewal.dosage ?? "N/A"}\n\nMerci de préparer la commande.`,
          );

          await untypedSupabase
            .from("prescription_renewals")
            .update({ pharmacy_notified_at: new Date().toISOString() })
            .eq("id", renewalId)
            .eq("clinic_id", clinicId);
        } catch (whatsappErr) {
          logger.error("Failed to notify pharmacy via WhatsApp", {
            context: "api/prescription-renewal/review",
            error: whatsappErr,
          });
        }
      }

      await logAuditEvent({
        supabase,
        action: `prescription_renewal_${action}ed`,
        type: "patient",
        clinicId,
        actor: auth.user.id,
        description: `Prescription renewal ${renewalId} ${action}ed`,
        metadata: {
          renewalId,
          action,
          medicationName: renewal.medication_name,
        },
      });

      return apiSuccess({ renewalId, status: newStatus });
    } catch (err) {
      logger.error("Prescription renewal review failed", {
        context: "api/prescription-renewal/review",
        error: err,
      });
      return apiInternalError("Échec de l'examen du renouvellement");
    }
  },
  ["clinic_admin", "doctor"],
);
