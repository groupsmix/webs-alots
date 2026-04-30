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
 *
 * A6-13: The verified clinicId is also returned so the caller can
 * reject tokens whose embedded clinicId does not match the current
 * tenant context (cross-tenant replay).
 */
interface BookingTokenResult {
  valid: boolean;
  /** The phone number embedded in the token (only set when valid=true). */
  phone?: string;
  /** The clinic id embedded in the token (only set when valid=true). */
  clinicId?: string;
}

/**
 * Verify a booking token issued after OTP verification.
 *
 * Tokens are HMAC-SHA256 signatures over `${clinicId}:${phone}:${expiry}`.
 * Format: `"clinicId:phone:expiryTimestamp:signature"` (4 parts).
 *
 * A6-13: The clinicId is part of the signed payload — not just the
 * token plaintext — so a token issued for clinic A cannot be replayed
 * against clinic B even when both tenants share the same
 * BOOKING_TOKEN_SECRET. The caller is still responsible for verifying
 * that the returned `clinicId` matches the current tenant context.
 *
 * Returns the verified phone so callers can enforce phone binding.
 */
async function verifyBookingToken(token: string): Promise<BookingTokenResult> {
  const secret = process.env.BOOKING_TOKEN_SECRET;
  if (!secret) {
    // HIGH-05: BOOKING_TOKEN_SECRET is required in ALL environments.
    // Dev bypass removed — configure the secret even in development
    // to prevent accidental leakage of unauthenticated booking access.
    logger.error("BOOKING_TOKEN_SECRET is not configured — rejecting all booking tokens", { context: "booking" });
    return { valid: false };
  }

  // A6-13: token is now `clinicId:phone:expiry:signature` (4 parts).
  // Tokens issued under the previous 3-part format become invalid the
  // moment this code ships; given the 15-minute TTL the impact is a
  // single retry of the verify step for users mid-flow at deploy time.
  const parts = token.split(":");
  if (parts.length !== 4) return { valid: false };

  const [clinicId, phone, expiryStr, signature] = parts;
  if (!clinicId || !phone) return { valid: false };
  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || Date.now() > expiry) return { valid: false };

  // Verify HMAC signature over the full payload (clinicId included).
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = encoder.encode(`${clinicId}:${phone}:${expiryStr}`);
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
  return mismatch === 0 ? { valid: true, phone, clinicId } : { valid: false };
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

    // Verify the booking token (HMAC-based, issued after OTP check)
    const tokenResult = await verifyBookingToken(bookingToken);
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

    const { tenant, config: tenantConfig } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;

    // A6-13: Reject tokens whose embedded clinicId does not match the
    // current tenant subdomain. The clinicId is part of the signed HMAC
    // payload, so this check together with the signature verification
    // makes cross-tenant replay infeasible.
    if (tokenResult.clinicId !== clinicId) {
      return apiForbidden("Booking token was issued for a different clinic");
    }
    const supabase = await createTenantClient(clinicId);

    const validation = await validateBookingRequest(body, tenantConfig.timezone, tenantConfig.workingHours);
    if (validation.error) {
      // F-A91-01: Always include error code for client localization
      return apiError(validation.error, 400, "VALIDATION_ERROR");
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
      return apiError("Doctor not found in this clinic", 404, "NOT_FOUND");
    }

    if (!serviceCheck.data) {
      return apiError("Service not found in this clinic", 404, "NOT_FOUND");
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
      return apiError("Appointment would extend past midnight. Please choose an earlier time.", 400, "SLOT_OVERFLOW");
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

    // ── F-A96-01 / DI-HIGH-02: Atomic booking via advisory-lock RPC ──
    // The previous insert-then-count-then-delete pattern was subject to a
    // TOCTOU race under concurrent requests (CVE-2026-XXXXX). The
    // booking_atomic_insert RPC wraps slot-count check + insert inside a
    // single transaction with a pg_advisory_xact_lock, guaranteeing that
    // maxPerSlot can never be exceeded.
    const maxPerSlot = tenantConfig.booking.maxPerSlot;
    const { data: appointmentId, error: apptError } = await supabase
      .rpc("booking_atomic_insert", {
        p_clinic_id: clinicId,
        p_patient_id: patientId,
        p_doctor_id: body.doctorId,
        p_service_id: body.serviceId,
        p_date: body.date,
        p_start_time: body.time,
        p_end_time: endTime,
        p_slot_start: slotStart,
        p_slot_end: slotEnd,
        p_status: initialStatus,
        p_is_first_visit: body.isFirstVisit,
        p_has_insurance: body.hasInsurance,
        p_booking_source: BOOKING_SOURCE.ONLINE,
        p_notes: body.patient.reason ?? null,
        p_is_emergency: false,
        p_max_per_slot: maxPerSlot,
      });

    if (apptError || !appointmentId) {
      // Handle slot-full or unique constraint violation
      if (apptError?.code === "23505") {
        return apiError("This slot has already been booked. Please choose another time.", 409, "SLOT_FULL");
      }
      // Handle tenant-isolation violations from the RPC
      if (apptError?.code === "42501") {
        logger.error("Booking RPC tenant validation failed", {
          context: "booking/route",
          clinicId,
          error: apptError,
        });
        return apiError("Invalid booking parameters", 400, "INVALID_TENANT");
      }
      logger.error("Booking atomic insert failed", {
        context: "booking/route",
        clinicId,
        error: apptError,
      });
      return apiInternalError("Failed to create booking");
    }

    const appointment = { id: appointmentId };

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
      return apiError("doctorId and date are required", 400, "VALIDATION_ERROR");
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
