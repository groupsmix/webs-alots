import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiForbidden, apiInternalError, apiRateLimited, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getPublicGeneratedSlots,
  getPublicAvailableSlots,
  getPublicSlotBookingCounts,
  getPublicDoctors,
  getPublicServices,
  getPublicSpecialties,
} from "@/lib/data/public";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import type { TemplateVariables } from "@/lib/notifications";
import { bookingLimiter, extractClientIp } from "@/lib/rate-limit";
import { createTenantClient } from "@/lib/supabase-server";
import { requireTenantWithConfig } from "@/lib/tenant";
import { computeEndTime } from "@/lib/timezone";
import { APPOINTMENT_STATUS, BOOKING_SOURCE } from "@/lib/types/database";
// findOrCreatePatient is used by authenticated routes (recurring, emergency-slot, etc.)
// For the anonymous booking flow we use the booking_find_or_create_patient RPC instead
// (SECURITY DEFINER function that bypasses users-table RLS).

const bookingRequestSchema = z.object({
  specialtyId: z.string().min(1),
  doctorId: z.string().min(1),
  doctorIds: z.array(z.string()).optional(),
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM"),
  isFirstVisit: z.boolean(),
  hasInsurance: z.boolean(),
  patient: z.object({
    name: z.string().min(2).max(200),
    phone: z.string().min(6).max(30),
    email: z.string().email().optional(),
    reason: z.string().max(1000).optional(),
  }),
  slotDuration: z.number().int().positive(),
  bufferTime: z.number().int().min(0),
});
/**
 * Result of booking token verification.
 *
 * AUDIT-04: The verified phone number is returned so that callers can
 * bind it to the submitted patient phone. Previously the function only
 * returned a boolean, allowing a user to verify one phone number and
 * then submit a booking for a different phone.
 */
interface BookingTokenResult {
  valid: boolean;
  /** The phone number embedded in the token (only set when valid=true). */
  phone?: string;
}

/**
 * Verify a booking token issued after OTP verification.
 * Tokens are HMAC-SHA256 signatures of `phone:clinicId:expiry`.
 * Format: "phone:clinicId:expiryTimestamp:signature"
 *
 * S-2 (STRIDE): The token must be bound to the current tenant. A token
 * issued for one clinic_id is rejected if presented under a different
 * tenant context, defeating cross-tenant replay attacks.
 *
 * Returns the verified phone so callers can enforce phone binding.
 */
async function verifyBookingToken(
  token: string,
  expectedClinicId: string,
): Promise<BookingTokenResult> {
  const secret = process.env.BOOKING_TOKEN_SECRET;
  if (!secret) {
    // HIGH-05: BOOKING_TOKEN_SECRET is required in ALL environments.
    // Dev bypass removed — configure the secret even in development
    // to prevent accidental leakage of unauthenticated booking access.
    logger.error("BOOKING_TOKEN_SECRET is not configured — rejecting all booking tokens", { context: "booking" });
    return { valid: false };
  }

  const parts = token.split(":");
  // S-2: New tokens are 4-part (phone:clinicId:expiry:sig).
  if (parts.length !== 4) return { valid: false };

  const [phone, tokenClinicId, expiryStr, signature] = parts;
  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || Date.now() > expiry) return { valid: false };

  // S-2: The clinicId in the token must match the active tenant. Reject
  // before any HMAC work to avoid leaking timing information.
  if (tokenClinicId !== expectedClinicId) return { valid: false };

  // Verify HMAC signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = encoder.encode(`${phone}:${tokenClinicId}:${expiryStr}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expectedSig.length !== signature.length) return { valid: false };
  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0 ? { valid: true, phone } : { valid: false };
}

/** Inferred from the Zod schema — single source of truth. */
type BookingRequestBody = z.infer<typeof bookingRequestSchema>;

interface ValidationResult {
  error: string | null;
  doctors: Awaited<ReturnType<typeof getPublicDoctors>>;
  services: Awaited<ReturnType<typeof getPublicServices>>;
}

async function validateBookingRequest(
  body: BookingRequestBody,
  timezone: string,
  workingHours: Record<number, { open: string; close: string; enabled: boolean }>,
): Promise<ValidationResult> {
  const [doctors, services] = await Promise.all([
    getPublicDoctors(),
    getPublicServices(),
  ]);
  // Pass pre-fetched doctors to avoid a redundant database query
  const specialties = await getPublicSpecialties(doctors);

  const fail = (msg: string): ValidationResult => ({ error: msg, doctors, services });

  if (!body.specialtyId || !specialties.find((s) => s.id === body.specialtyId)) {
    return fail("Invalid specialty selected");
  }
  if (!body.doctorId || !doctors.find((d) => d.id === body.doctorId)) {
    return fail("Invalid doctor selected");
  }
  if (!body.serviceId || !services.find((s) => s.id === body.serviceId)) {
    return fail("Invalid service selected");
  }
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return fail("Invalid date format (expected YYYY-MM-DD)");
  }
  if (!body.time || !/^\d{2}:\d{2}$/.test(body.time)) {
    return fail("Invalid time format (expected HH:MM)");
  }
  if (!body.patient?.name || body.patient.name.trim().length < 2) {
    return fail("Patient name is required (minimum 2 characters)");
  }
  if (!body.patient?.phone || body.patient.phone.trim().length < 6) {
    return fail("Valid phone number is required");
  }

  // Reject past dates (compared in the tenant's configured timezone)
  const todayInTz = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // "YYYY-MM-DD"
  if (body.date < todayInTz) {
    return fail("Cannot book an appointment in the past");
  }

  // Determine day-of-week in the clinic's timezone so that midnight-
  // boundary edge cases don't return the wrong day.  Intl.DateTimeFormat
  // with the `weekday` option is timezone-aware, unlike Date.getDay().
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  });
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const parsedDate = new Date(body.date + "T12:00:00");
  const dayOfWeek = dayMap[dayFormatter.format(parsedDate)] ?? parsedDate.getDay();
  const hours = workingHours[dayOfWeek];
  if (!hours?.enabled) {
    return fail("Selected date is not a working day");
  }

  const generatedSlots = await getPublicGeneratedSlots(body.date, body.doctorId);
  if (!generatedSlots.includes(body.time)) {
    return fail("Selected time is not a valid slot");
  }

  const availableSlots = await getPublicAvailableSlots(body.date, body.doctorId);
  if (!availableSlots.includes(body.time)) {
    return fail("Selected time slot is already fully booked");
  }

  return { error: null, doctors, services };
}

/**
 * POST /api/booking
 *
 * Creates a new appointment booking.
 * Validates slot availability, enforces max capacity per slot and buffer time,
 * and sends confirmation via WhatsApp.
 */
export const POST = withValidation(bookingRequestSchema, async (body, request: NextRequest) => {
    // Defence-in-depth: per-IP rate limit for the booking endpoint.
    // The middleware also applies bookingLimiter, but checking here guards
    // against deployment configs that skip the middleware layer.
    const clientIp = extractClientIp(request);
    const allowed = await bookingLimiter.check(`booking:${clientIp}`);
    if (!allowed) {
      return apiRateLimited("Too many booking requests. Please try again later.");
    }

    // CRITICAL-02: Require a booking verification token.
    // The token is issued after phone/email OTP verification via
    // POST /api/booking/verify. Without it, bots can flood the
    // system with fake patient records and appointments.
    const bookingToken = request.headers.get("x-booking-token");
    if (!bookingToken) {
      return apiUnauthorized("Booking verification required. Call POST /api/booking/verify first.");
    }

    // Resolve tenant context BEFORE verifying the booking token so we can
    // bind the verification to the active clinic (S-2 STRIDE finding).
    const { tenant, config: tenantConfig } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;
    const supabase = await createTenantClient(clinicId);

    // Verify the booking token (HMAC-based, issued after OTP check).
    // S-2: Pass the active clinicId so the token signature is verified
    // against the tenant it was issued for. Tokens from other tenants
    // are rejected even if the HMAC secret is shared.
    const tokenResult = await verifyBookingToken(bookingToken, clinicId);
    if (!tokenResult.valid) {
      return apiForbidden("Invalid or expired booking token");
    }

    // AUDIT-04: Bind the verified phone from the token to the submitted
    // patient phone. Prevents a user from verifying one phone number and
    // then booking under a different one.
    const normalizePhone = (p: string) => p.replace(/[\s\-()]/g, "");
    if (normalizePhone(tokenResult.phone!) !== normalizePhone(body.patient.phone)) {
      return apiForbidden("Booking token does not match the submitted patient phone number");
    }

    const validation = await validateBookingRequest(body, tenantConfig.timezone, tenantConfig.workingHours);
    if (validation.error) {
      return apiError(validation.error);
    }

    // Reuse data already fetched during validation (avoids duplicate queries)
    const doctor = validation.doctors.find((d) => d.id === body.doctorId);
    const service = validation.services.find((s) => s.id === body.serviceId);

    // Verify doctorId and serviceId belong to this clinic in a single
    // parallel query instead of two sequential ones.  This also avoids
    // re-fetching data that validateBookingRequest already retrieved
    // from the public data layer.
    const [doctorCheck, serviceCheck] = await Promise.all([
      supabase
        .from("users")
        .select("id")
        .eq("id", body.doctorId)
        .eq("clinic_id", clinicId)
        .eq("role", "doctor")
        .single(),
      supabase
        .from("services")
        .select("id")
        .eq("id", body.serviceId)
        .eq("clinic_id", clinicId)
        .single(),
    ]);

    if (!doctorCheck.data) {
      return apiError("Doctor not found in this clinic");
    }

    if (!serviceCheck.data) {
      return apiError("Service not found in this clinic");
    }

    // Find or create a patient record using the SECURITY DEFINER RPC
    // (bypasses users-table RLS for the anon role while keeping tenant isolation)
    const { data: patientId, error: patientError } = await supabase
      .rpc("booking_find_or_create_patient", {
        p_clinic_id: clinicId,
        p_name: body.patient.name,
        p_phone: body.patient.phone,
        p_email: body.patient.email ?? undefined,
      });
    if (patientError || !patientId) {
      logger.warn("Failed to find/create patient", {
        context: "booking/route",
        error: patientError,
      });
      return apiInternalError("Failed to create patient record");
    }

    // Calculate end time with midnight overflow guard
    const duration = service?.duration ?? tenantConfig.booking.slotDuration;
    const { endTime, overflows } = computeEndTime(body.time, duration);
    if (overflows) {
      return apiError("Appointment would extend past midnight. Please choose an earlier time.");
    }

    // Determine initial status based on clinic payment requirements
    const requiresDeposit = (tenantConfig.booking.depositAmount ?? 0) > 0
      || (tenantConfig.booking.depositPercentage ?? 0) > 0;
    const initialStatus = requiresDeposit
      ? APPOINTMENT_STATUS.PENDING
      : APPOINTMENT_STATUS.CONFIRMED;

    // Construct ISO slot boundaries for the required slot_start/slot_end columns
    const slotStart = `${body.date}T${body.time}:00`;
    const slotEnd = `${body.date}T${endTime}:00`;

    const { data: appointment, error: apptError } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        doctor_id: body.doctorId,
        service_id: body.serviceId,
        appointment_date: body.date,
        start_time: body.time,
        end_time: endTime,
        slot_start: slotStart,
        slot_end: slotEnd,
        status: initialStatus,
        is_first_visit: body.isFirstVisit,
        insurance_flag: body.hasInsurance,
        booking_source: BOOKING_SOURCE.ONLINE,
        notes: body.patient.reason ?? null,
        is_emergency: false,
      })
      .select("id")
      .single();

    if (apptError || !appointment) {
      // Handle unique constraint violation (double-booking race condition)
      if (apptError?.code === "23505") {
        return apiError("This slot has already been booked. Please choose another time.", 409);
      }
      // Production: error logged via audit trail; no console output
      return apiInternalError("Failed to create booking");
    }

    // ── DI-HIGH-02: Post-insert maxPerSlot enforcement ──────────────
    // The pre-insert availability check (validateBookingRequest) is
    // subject to a TOCTOU race when maxPerSlot > 1.  After inserting we
    // count how many active bookings now exist for this slot.  If the
    // count exceeds maxPerSlot the just-inserted row lost the race and
    // must be rolled back.  This guarantees the cap is never exceeded.
    const maxPerSlot = tenantConfig.booking.maxPerSlot;
    const { count: slotCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("doctor_id", body.doctorId)
      .eq("appointment_date", body.date)
      .eq("start_time", body.time)
      .in("status", [
        APPOINTMENT_STATUS.CONFIRMED,
        APPOINTMENT_STATUS.PENDING,
        APPOINTMENT_STATUS.RESCHEDULED,
      ]);

    if (slotCount !== null && slotCount > maxPerSlot) {
      // Roll back the appointment that lost the race
      await supabase
        .from("appointments")
        .delete()
        .eq("id", appointment.id);

      return apiError("This slot has just been fully booked. Please choose another time.", 409);
    }

    // Audit log for healthcare compliance
    await logAuditEvent({
      supabase,
      action: "appointment.created",
      type: "booking",
      clinicId,
      description: `Appointment ${appointment.id} created for patient ${patientId} with doctor ${body.doctorId}`,
    });

    // ── Dispatch notifications (fire-and-forget) ──────────────────
    // Notification failure must NOT affect the booking outcome.
    // Build the manage/cancel URL so the patient can self-service
    const siteOrigin = request.headers.get("origin") ?? request.nextUrl.origin;
    const manageUrl = `${siteOrigin}/book?manage=${appointment.id}`;

    const notifVars: TemplateVariables = {
      patient_name: body.patient.name,
      doctor_name: doctor?.name ?? "Doctor",
      clinic_name: tenant.clinicName,
      clinic_address: "",
      clinic_phone: "",
      service_name: service?.name ?? "Consultation",
      date: body.date,
      time: body.time,
      manage_url: manageUrl,
    };

    // booking_confirmation → patient, new_booking → staff
    Promise.allSettled([
      dispatchNotification("booking_confirmation", notifVars, patientId, ["in_app", "email", "whatsapp"]),
      dispatchNotification("new_booking", notifVars, body.doctorId, ["in_app"]),
    ]).catch((err) => {
      logger.warn("Booking notification dispatch failed", { context: "booking/route", error: err });
    });

    return apiSuccess({
      status: "created",
      message: "Appointment booked successfully",
      appointment: {
        id: appointment.id,
        doctor: doctor?.name,
        service: service?.name,
        date: body.date,
        time: body.time,
        duration: service?.duration,
        price: service?.price,
        currency: service?.currency,
        isFirstVisit: body.isFirstVisit,
        hasInsurance: body.hasInsurance,
      },
    });
});

/**
 * GET /api/booking
 *
 * Returns available time slots for a given doctor and date.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const doctorId = searchParams.get("doctorId");
    const date = searchParams.get("date");

    if (!doctorId || !date) {
      return apiError("doctorId and date are required");
    }

    const { config: tenantCfg } = await requireTenantWithConfig();

    const [allSlots, availableSlots, bookedCounts] = await Promise.all([
      getPublicGeneratedSlots(date, doctorId),
      getPublicAvailableSlots(date, doctorId),
      getPublicSlotBookingCounts(date, doctorId),
    ]);

    return apiSuccess(
      {
        slots: availableSlots,
        allSlots,
        bookedCounts,
        maxPerSlot: tenantCfg.booking.maxPerSlot,
        slotDuration: tenantCfg.booking.slotDuration,
        bufferTime: tenantCfg.booking.bufferTime,
      },
      200,
      { "Cache-Control": "public, max-age=60" },
    );
  } catch (err) {
    logger.warn("Operation failed", { context: "booking/route", error: err });
    return apiInternalError("Failed to fetch available slots");
  }
}
