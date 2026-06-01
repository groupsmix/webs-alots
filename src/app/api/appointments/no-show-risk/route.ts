import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { predictNoShow, type NoShowFeatures } from "@/lib/predictive/no-show-model";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

/**
 * GET /api/appointments/no-show-risk?appointmentId=X
 *
 * Predicts the likelihood of a patient not showing up for their appointment.
 * Uses the predictive model based on historical data and appointment features.
 */
async function handler(req: NextRequest, auth: AuthContext) {
  const { searchParams } = new URL(req.url);
  const appointmentId = searchParams.get("appointmentId");

  if (!appointmentId) {
    return apiValidationError("appointmentId is required");
  }

  const { supabase, profile } = auth;
  const clinicId = profile.clinic_id;

  if (!clinicId) {
    return apiError("No clinic associated with this account", 403, "NO_CLINIC");
  }

  try {
    // 1. Fetch appointment details
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select(
        `
        *,
        patient:patient_id (
          id,
          first_visit_date,
          insurance_provider
        )
      `,
      )
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .single();

    if (aptError || !appointment) {
      return apiError("Appointment not found", 404, "NOT_FOUND");
    }

    // Without a start_time the predictive features (lead time, day of week,
    // hour, gap since last visit) cannot be computed.
    if (!appointment.start_time) {
      return apiError(
        "Appointment is missing a start_time and cannot be scored",
        400,
        "INVALID_APPOINTMENT",
      );
    }

    // 2. Fetch patient's past appointments for statistics
    const { data: history, error: historyError } = await supabase
      .from("appointments")
      .select("status, start_time")
      .eq("patient_id", appointment.patient_id)
      .eq("clinic_id", clinicId)
      .lt("start_time", appointment.start_time)
      .order("start_time", { ascending: false });

    if (historyError) {
      throw historyError;
    }

    // 3. Calculate features
    const totalPast = history?.length || 0;
    const pastNoShows = history?.filter((a) => a.status === "no_show").length || 0;
    const pastCancellations = history?.filter((a) => a.status === "cancelled").length || 0;
    const previousNoShowRate = totalPast > 0 ? pastNoShows / totalPast : 0;

    let daysSinceLastVisit: number | null = null;
    if (totalPast > 0 && history && history[0].start_time) {
      const lastVisit = new Date(history[0].start_time);
      const currentVisit = new Date(appointment.start_time);
      daysSinceLastVisit = Math.floor(
        (currentVisit.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    const appointmentDate = new Date(appointment.start_time);
    // created_at is nullable in the schema; fall back to the appointment
    // date itself (lead time = 0) when missing rather than NaN-ing through
    // the entire feature vector.
    const createdAt = appointment.created_at ? new Date(appointment.created_at) : appointmentDate;
    const leadTimeDays = Math.floor(
      (appointmentDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    const isFirstVisit = totalPast === 0;

    // Type casting because we know 'patient' is joined and returned as an object from our query
    const patientData = appointment.patient as unknown as { insurance_provider: string | null };
    const hasInsurance = !!(patientData && patientData.insurance_provider);

    const features: NoShowFeatures = {
      previousNoShowRate,
      leadTimeDays: Math.max(0, leadTimeDays),
      isFirstVisit,
      hasInsurance,
      appointmentDayOfWeek: appointmentDate.getDay(),
      appointmentHour: appointmentDate.getHours(),
      previousCancellations: pastCancellations,
      daysSinceLastVisit,
    };

    // 4. Predict
    const prediction = predictNoShow(features);

    return apiSuccess({
      appointmentId,
      prediction,
      featuresCalculated: features,
    });
  } catch (err) {
    logger.error("Failed to predict no-show risk", {
      context: "api/appointments/no-show-risk",
      error: err instanceof Error ? err.message : String(err),
      appointmentId,
      clinicId,
    });
    return apiError("Failed to calculate no-show risk", 500);
  }
}

export const GET = withAuth(handler, ["doctor", "clinic_admin", "receptionist"]);
