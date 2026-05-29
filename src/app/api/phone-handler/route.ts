import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { phoneHandlerLookupSchema } from "@/lib/validations/batch4c";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/phone-handler
 *
 * Smart phone handler: when a call comes in, the system looks up the caller ID
 * against patient records and returns the matching patient file.
 *
 * Used by receptionist dashboard to auto-open patient file on incoming calls.
 */
export const POST = withAuthValidation(
  phoneHandlerLookupSchema,
  async (data, _request, _auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const { phone } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Normalize phone for lookup: strip spaces, dashes, parens
      const normalizedPhone = phone.replace(/[\s\-()]/g, "");

      // Try exact match first
      const { data: patients, error } = await untypedSupabase
        .from("patients")
        .select("id, first_name, last_name, phone, email, date_of_birth, insurance_type")
        .eq("clinic_id", clinicId)
        .or(`phone.eq.${normalizedPhone},phone.eq.${phone}`);

      if (error) {
        logger.error("Phone handler lookup failed", {
          context: "api/phone-handler",
          error,
        });
        return apiInternalError("Lookup failed");
      }

      type PatientRow = {
        id: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        email: string | null;
        date_of_birth: string | null;
        insurance_type: string | null;
      };

      const results = (patients ?? []) as unknown as PatientRow[];

      if (results.length === 0) {
        // Try partial match (last 9 digits for Moroccan numbers)
        const last9 = normalizedPhone.slice(-9);
        const { data: partialMatches } = await untypedSupabase
          .from("patients")
          .select("id, first_name, last_name, phone, email, date_of_birth, insurance_type")
          .eq("clinic_id", clinicId)
          .like("phone", `%${last9}`);

        const partial = (partialMatches ?? []) as unknown as PatientRow[];

        if (partial.length === 0) {
          return apiSuccess({ found: false, patients: [] });
        }

        return apiSuccess({
          found: true,
          matchType: "partial",
          patients: partial.map((p) => ({
            id: p.id,
            firstName: p.first_name,
            lastName: p.last_name,
            phone: p.phone,
            email: p.email,
            dateOfBirth: p.date_of_birth,
            insuranceType: p.insurance_type,
          })),
        });
      }

      // Get upcoming appointments for matched patients
      const patientIds = results.map((p) => p.id);
      const { data: upcomingAppts } = await supabase
        .from("appointments")
        .select("id, patient_id, doctor_id, appointment_date, start_time, status")
        .eq("clinic_id", clinicId)
        .in("patient_id", patientIds)
        .in("status", ["confirmed", "scheduled"])
        .order("appointment_date", { ascending: true })
        .limit(5);

      type ApptRow = {
        id: string;
        patient_id: string;
        doctor_id: string;
        appointment_date: string;
        start_time: string;
        status: string;
      };

      return apiSuccess({
        found: true,
        matchType: "exact",
        patients: results.map((p) => ({
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          phone: p.phone,
          email: p.email,
          dateOfBirth: p.date_of_birth,
          insuranceType: p.insurance_type,
        })),
        upcomingAppointments: ((upcomingAppts ?? []) as ApptRow[]).map((a) => ({
          id: a.id,
          patientId: a.patient_id,
          doctorId: a.doctor_id,
          date: a.appointment_date,
          time: a.start_time,
          status: a.status,
        })),
      });
    } catch (err) {
      logger.error("Phone handler error", {
        context: "api/phone-handler",
        error: err,
      });
      return apiInternalError("Phone lookup failed");
    }
  },
  ["clinic_admin", "receptionist"],
);
