import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { attestationCreateSchema } from "@/lib/validations/batch4c";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/attestations
 *
 * Create a new attestation (medical certificate, sick leave, attendance letter).
 * Pre-fills patient/doctor data for one-click generation.
 */
export const POST = withAuthValidation(
  attestationCreateSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const {
      patientId,
      doctorId,
      appointmentId,
      type,
      title,
      content,
      startDate,
      endDate,
      daysCount,
      locale,
    } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Fetch patient and doctor data for pre-filling
      const { data: patient } = await untypedSupabase
        .from("patients")
        .select("id, first_name, last_name, date_of_birth, phone, cin")
        .eq("id", patientId)
        .eq("clinic_id", clinicId)
        .single();

      if (!patient) {
        return apiError("Patient introuvable", 404, "PATIENT_NOT_FOUND");
      }

      type PatientRow = {
        id: string;
        first_name: string;
        last_name: string;
        date_of_birth: string | null;
        phone: string | null;
        cin: string | null;
      };
      const patientData = patient as unknown as PatientRow;

      // Build attestation content with pre-filled data
      const attestationContent = {
        ...((content as Record<string, unknown>) ?? {}),
        patientName: `${patientData.first_name} ${patientData.last_name}`,
        patientDob: patientData.date_of_birth,
        patientCin: patientData.cin,
        patientPhone: patientData.phone,
      };

      const { data: attestation, error: insertError } = await untypedSupabase
        .from("attestations")
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          doctor_id: doctorId,
          appointment_id: appointmentId ?? null,
          type,
          title,
          content: attestationContent,
          start_date: startDate ?? null,
          end_date: endDate ?? null,
          days_count: daysCount ?? null,
          locale: locale ?? "fr",
          status: "draft",
        })
        .select("id, type, title, status, generated_at, content")
        .single();

      if (insertError) {
        logger.error("Failed to create attestation", {
          context: "api/attestations",
          error: insertError,
        });
        return apiInternalError("Échec de la création de l'attestation");
      }

      type AttestationRow = {
        id: string;
        type: string;
        title: string;
        status: string;
        generated_at: string;
        content: Record<string, unknown>;
      };

      await logAuditEvent({
        supabase,
        action: "attestation_created",
        type: "patient",
        clinicId,
        actor: auth.user.id,
        description: `${type} attestation created for patient ${patientId}`,
        metadata: {
          attestationId: (attestation as AttestationRow).id,
          type,
          patientId,
          doctorId,
        },
      });

      return apiSuccess({ attestation: attestation as AttestationRow }, 201);
    } catch (err) {
      logger.error("Attestation creation failed", {
        context: "api/attestations",
        error: err,
      });
      return apiInternalError("Échec de la création de l'attestation");
    }
  },
  ["clinic_admin", "doctor"],
);

/**
 * GET /api/attestations?patientId=...&type=...&status=...
 *
 * List attestations for the clinic, optionally filtered by patient, type, or status.
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
      const type = url.searchParams.get("type");
      const status = url.searchParams.get("status");

      let query = untypedSupabase
        .from("attestations")
        .select(
          "id, patient_id, doctor_id, type, title, status, start_date, end_date, days_count, locale, generated_at, signed_at",
        )
        .eq("clinic_id", clinicId);

      if (patientId) query = query.eq("patient_id", patientId);
      if (doctorId) query = query.eq("doctor_id", doctorId);
      if (type) query = query.eq("type", type);
      if (status) query = query.eq("status", status);

      const { data: attestations, error } = await query.order("generated_at", { ascending: false });

      if (error) {
        logger.error("Failed to list attestations", {
          context: "api/attestations",
          error,
        });
        return apiInternalError("Échec de la récupération des attestations");
      }

      return apiSuccess({ attestations: attestations ?? [] });
    } catch (err) {
      logger.error("Attestation list failed", {
        context: "api/attestations",
        error: err,
      });
      return apiInternalError("Échec de la récupération des attestations");
    }
  },
  ["clinic_admin", "doctor", "receptionist"],
);
