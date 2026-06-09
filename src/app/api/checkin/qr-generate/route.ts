// Import the browser entry (SVG/canvas renderers only) rather than the main
// `qrcode` entry, which statically pulls in the PNG renderer + `pngjs` (~1 MiB)
// and bloated the Cloudflare Worker past its 10 MiB limit. See
// src/types/qrcode-browser.d.ts for the rationale and typing.
import QRCode from "qrcode/lib/browser.js";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { qrCheckinGenerateSchema } from "@/lib/validations/patient-experience";

/**
 * POST /api/checkin/qr-generate
 *
 * Generate a QR code for patient check-in at the clinic entrance.
 * The QR encodes a unique token that maps to a specific appointment.
 * Staff (receptionist, clinic_admin, doctor) can generate QR codes.
 */
export const POST = withAuthValidation(
  qrCheckinGenerateSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;

    try {
      const supabase = await createTenantClient(clinicId);

      const { data: appointment, error: apptError } = await supabase
        .from("appointments")
        .select("id, patient_id, appointment_date, start_time, status")
        .eq("id", data.appointmentId)
        .eq("clinic_id", clinicId)
        .single();

      if (apptError || !appointment) {
        return apiError("Appointment not found", 404, "NOT_FOUND");
      }

      if (appointment.status === "checked_in") {
        return apiError("Patient already checked in", 409, "ALREADY_CHECKED_IN");
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(23, 59, 59, 999);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type SupabaseUntyped = { from(table: string): any };
      const { error: insertError } = await (supabase as unknown as SupabaseUntyped)
        .from("qr_checkin_tokens")
        .insert({
          clinic_id: clinicId,
          appointment_id: data.appointmentId,
          patient_id: appointment.patient_id,
          token,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        logger.error("Failed to create QR checkin token", {
          context: "api/checkin/qr-generate",
          error: insertError,
        });
        return apiInternalError("Failed to generate QR code");
      }

      const checkinUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/checkin/scan?token=${token}`;
      // Render an SVG QR (no pngjs) and return it as an SVG data URL. The
      // response contract is unchanged: `qrDataUrl` is still a data: URL that
      // renders directly in an <img src> and scans identically (crisper, since
      // SVG is vector). Buffer is available in the Workers nodejs_compat runtime.
      const qrSvg = await QRCode.toString(checkinUrl, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
        width: 300,
      });
      const qrDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;

      await logAuditEvent({
        supabase,
        action: "qr_checkin_generated",
        type: "booking",
        clinicId,
        actor: auth.user.id,
        description: `QR check-in token generated for appointment ${data.appointmentId}`,
        metadata: { appointmentId: data.appointmentId },
      });

      return apiSuccess({
        qrDataUrl,
        token,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err) {
      logger.error("Failed to generate QR code", {
        context: "api/checkin/qr-generate",
        error: err,
      });
      return apiInternalError("Failed to generate QR code");
    }
  },
  ["clinic_admin", "receptionist", "doctor"],
);
