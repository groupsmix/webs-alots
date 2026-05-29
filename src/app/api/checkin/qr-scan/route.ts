import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { getLocalDateStr } from "@/lib/utils";
import { qrCheckinScanSchema } from "@/lib/validations/patient-experience";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/checkin/qr-scan
 *
 * Patient scans QR code at clinic entrance. Validates the token,
 * marks the appointment as checked_in, and adds the patient to the
 * waiting queue with estimated wait time.
 */
export const POST = withValidation(qrCheckinScanSchema, async (data) => {
  const tenant = await getTenant();
  if (!tenant?.clinicId) {
    return apiError("Clinic context required — use a clinic subdomain", 400);
  }
  const clinicId = tenant.clinicId;

  try {
    const supabase = await createTenantClient(clinicId);
    const untypedSupabase = supabase as unknown as SupabaseUntyped;

    const { data: tokenRow, error: tokenError } = await untypedSupabase
      .from("qr_checkin_tokens")
      .select("id, appointment_id, patient_id, scanned_at, expires_at")
      .eq("token", data.token)
      .eq("clinic_id", clinicId)
      .single();

    if (tokenError || !tokenRow) {
      return apiError("Invalid or expired QR code", 400, "INVALID_TOKEN");
    }

    type TokenRow = {
      id: string;
      appointment_id: string;
      patient_id: string;
      scanned_at: string | null;
      expires_at: string;
    };
    const token = tokenRow as TokenRow;

    if (token.scanned_at) {
      return apiError("QR code already used", 409, "ALREADY_SCANNED");
    }

    if (new Date(token.expires_at) < new Date()) {
      return apiError("QR code has expired", 410, "TOKEN_EXPIRED");
    }

    await untypedSupabase
      .from("qr_checkin_tokens")
      .update({ scanned_at: new Date().toISOString() })
      .eq("id", token.id)
      .eq("clinic_id", clinicId);

    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: "checked_in" })
      .eq("id", token.appointment_id)
      .eq("clinic_id", clinicId);

    if (updateError) {
      logger.error("Failed to update appointment status", {
        context: "api/checkin/qr-scan",
        error: updateError,
      });
      return apiInternalError("Failed to check in");
    }

    const { data: appointment } = await supabase
      .from("appointments")
      .select("doctor_id, start_time")
      .eq("id", token.appointment_id)
      .eq("clinic_id", clinicId)
      .single();

    const today = getLocalDateStr();
    const { count: aheadCount } = await untypedSupabase
      .from("waiting_queue")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "waiting")
      .eq("doctor_id", appointment?.doctor_id ?? "");

    const position = (aheadCount ?? 0) + 1;
    const MINUTES_PER_PATIENT = 15;
    const estimatedWait = Math.max(0, (position - 1) * MINUTES_PER_PATIENT);

    const { error: queueError } = await untypedSupabase.from("waiting_queue").insert({
      clinic_id: clinicId,
      appointment_id: token.appointment_id,
      patient_id: token.patient_id,
      doctor_id: appointment?.doctor_id ?? "",
      position,
      estimated_wait_minutes: estimatedWait,
      checked_in_at: new Date().toISOString(),
      status: "waiting",
    });

    if (queueError) {
      logger.error("Failed to add to waiting queue", {
        context: "api/checkin/qr-scan",
        error: queueError,
      });
    }

    const { data: checkedInToday } = await supabase
      .from("appointments")
      .select("id, start_time")
      .eq("clinic_id", clinicId)
      .eq("appointment_date", today)
      .eq("status", "checked_in")
      .order("start_time", { ascending: true });

    const queue = checkedInToday ?? [];
    const queuePosition = queue.findIndex((a) => a.id === token.appointment_id) + 1 || queue.length;

    await logAuditEvent({
      supabase,
      action: "qr_checkin_scanned",
      type: "booking",
      clinicId,
      description: `Patient checked in via QR scan for appointment ${token.appointment_id}`,
      metadata: { appointmentId: token.appointment_id, patientId: token.patient_id },
    });

    return apiSuccess({
      checkedIn: true,
      queuePosition,
      estimatedWait,
      appointmentId: token.appointment_id,
    });
  } catch (err) {
    logger.error("Failed to process QR scan", {
      context: "api/checkin/qr-scan",
      error: err,
    });
    return apiInternalError("Failed to process QR check-in");
  }
});
