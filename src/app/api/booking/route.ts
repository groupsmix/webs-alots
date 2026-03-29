import { NextRequest, NextResponse } from "next/server";
import { requireTenantWithConfig } from "@/lib/tenant";
import { clinicConfig } from "@/config/clinic.config";
import {
  getPublicGeneratedSlots,
  getPublicAvailableSlots,
  getPublicSlotBookingCounts,
  getPublicDoctors,
  getPublicServices,
  getPublicSpecialties,
} from "@/lib/data/public";
import { createTenantClient } from "@/lib/supabase-server";
import { APPOINTMENT_STATUS, BOOKING_SOURCE } from "@/lib/types/database";
import { logAuditEvent } from "@/lib/audit-log";
// findOrCreatePatient is used by authenticated routes (recurring, emergency-slot, etc.)
// For the anonymous booking flow we use the booking_find_or_create_patient RPC instead
// (SECURITY DEFINER function that bypasses users-table RLS).
import { computeEndTime } from "@/lib/timezone";
import { logger } from "@/lib/logger";
import { bookingLimiter, extractClientIp } from "@/lib/rate-limit";
import { withValidation } from "@/lib/api-validate";
import { dispatchNotification } from "@/lib/notifications";
import type { TemplateVariables } from "@/lib/notifications";
import { z } from "zod";

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
 * Verify a booking token issued after OTP verification.
 * Tokens are HMAC-SHA256 signatures of the phone number + expiry timestamp.
 * Format: "phone:expiryTimestamp:signature"
 */
async function verifyBookingToken(token: string): Promise<boolean> {
  const secret = process.env.BOOKING_TOKEN_SECRET;
  if (!secret) {
    // HIGH-05: BOOKING_TOKEN_SECRET is required in ALL environments.
    // Dev bypass removed — configure the secret even in development
    // to prevent accidental leakage of unauthenticated booking access.
    logger.error("BOOKING_TOKEN_SECRET is not configured — rejecting all booking tokens", { context: "booking" });
    return false;
  }

  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [phone, expiryStr, signature] = parts;
  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || Date.now() > expiry) return false;

  // Verify HMAC signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = encoder.encode(`${phone}:${expiryStr}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expectedSig.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
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
      return NextResponse.json(
        { error: "Too many booking requests. Please try again later." },
        { status: 429 },
      );
    }

    // CRITICAL-02: Require a booking verification token.
    // The token is issued after phone/email OTP verification via
    // POST /api/booking/verify. Without it, bots can flood the
    // system with fake patient records and appointments.
    const bookingToken = request.headers.get("x-booking-token");
    if (!bookingToken) {
      return NextResponse.json(
        { error: "Booking verification required. Call POST /api/booking/verify first." },
        { status: 401 },
      );
    }

    // Verify the booking token (HMAC-based, issued after OTP check)
    const isValidToken = await verifyBookingToken(bookingToken);
    if (!isValidToken) {
      return NextResponse.json(
        { error: "Invalid or expired booking token" },
        { status: 403 },
      );
    }

    const { tenant, config: tenantConfig } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;
    const supabase = await createTenantClient(clinicId);

    const validation = await validateBookingRequest(body, tenantConfig.timezone, tenantConfig.workingHours);
    if (validation.error) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 },
      );
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
      return NextResponse.json({ error: "Doctor not found in this clinic" }, { status: 400 });
    }

    if (!serviceCheck.data) {
      return NextResponse.json({ error: "Service not found in this clinic" }, { status: 400 });
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
      return NextResponse.json({ error: "Failed to create patient record" }, { status: 500 });
    }

    // Calculate end time with midnight overflow guard
    const duration = service?.duration ?? tenantConfig.booking.slotDuration;
    const { endTime, overflows } = computeEndTime(body.time, duration);
    if (overflows) {
      return NextResponse.json(
        { error: "Appointment would extend past midnight. Please choose an earlier time." },
        { status: 400 },
      );
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
        return NextResponse.json(
          { error: "This slot has already been booked. Please choose another time." },
          { status: 409 },
        );
      }
      // Production: error logged via audit trail; no console output
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
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

      return NextResponse.json(
        { error: "This slot has just been fully booked. Please choose another time." },
        { status: 409 },
      );
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
      clinic_address: clinicConfig.contact?.address ?? "",
      clinic_phone: clinicConfig.contact?.phone ?? "",
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

    return NextResponse.json({
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
      return NextResponse.json(
        { error: "doctorId and date are required" },
        { status: 400 },
      );
    }

    const { config: tenantCfg } = await requireTenantWithConfig();

    const [allSlots, availableSlots, bookedCounts] = await Promise.all([
      getPublicGeneratedSlots(date, doctorId),
      getPublicAvailableSlots(date, doctorId),
      getPublicSlotBookingCounts(date, doctorId),
    ]);

    return NextResponse.json({
      slots: availableSlots,
      allSlots,
      bookedCounts,
      maxPerSlot: tenantCfg.booking.maxPerSlot,
      slotDuration: tenantCfg.booking.slotDuration,
      bufferTime: tenantCfg.booking.bufferTime,
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "booking/route", error: err });
    return NextResponse.json(
      { error: "Failed to fetch available slots" },
      { status: 500 },
    );
  }
}
