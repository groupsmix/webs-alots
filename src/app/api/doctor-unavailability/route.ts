import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiInternalError,
} from "@/lib/api-response";
import {
  findAlternativeSlots,
  buildBookedSlotsSet,
} from "@/lib/find-alternative-slots";
import { logger } from "@/lib/logger";
import { enqueueNotification } from "@/lib/notification-queue";
import { requireTenant, getClinicConfig } from "@/lib/tenant";
import { doctorUnavailabilitySchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

/**
 * POST /api/doctor-unavailability
 *
 * Called when a doctor marks themselves unavailable for a date range.
 * 1. Records the unavailability
 * 2. Finds all affected appointments
 * 3. Finds alternative slots
 * 4. Sends WhatsApp messages to affected patients with rebooking options
 * 5. Creates rebooking_requests records to track responses
 *
 * AUDIT F-01: Replaced raw auth + body-supplied clinicId with withAuth() +
 * requireTenant(). The clinicId is now derived from the subdomain, preventing
 * cross-tenant data mutation.
 */
export const POST = withAuth(async (request, auth) => {
    const supabase = auth.supabase;

    // AUDIT F-01: Derive clinicId from subdomain, not from the request body.
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // Parse and validate the request body.
    // Guard request.json() so malformed JSON returns a 400 instead of an
    // opaque 500 "Authentication failed" from the outer withAuth() wrapper.
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400, "INVALID_JSON");
    }
    const parsed = doctorUnavailabilitySchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(parsed.error.issues.map(i => i.message).join(", "), 422, "VALIDATION_ERROR");
    }

    const { doctorId, clinicId: bodyClinicId, startDate, endDate, reason } = parsed.data;

    // AUDIT F-01: If a body-supplied clinicId is present, it MUST match the
    // subdomain-derived value. This prevents cross-tenant mutations.
    if (bodyClinicId && bodyClinicId !== clinicId) {
      logger.error("Tenant mismatch in doctor-unavailability: body clinicId does not match subdomain", {
        context: "doctor-unavailability",
        bodyClinicId,
        subdomainClinicId: clinicId,
        userId: auth.profile.id,
      });
      return apiForbidden("clinicId does not match subdomain");
    }

    // Verify the doctor belongs to this clinic
    if (auth.profile.clinic_id !== clinicId) {
      return apiForbidden("You do not belong to this clinic");
    }

    // 1. Record the unavailability in doctor_unavailability table
    // doctor_unavailability & rebooking_requests not yet in generated types — cast through unknown
    type UnavailRow = { id: string };
    type RebookInsertClient = {
      from(t: string): {
        insert(row: Record<string, unknown>): {
          select(s: string): { single(): Promise<{ data: UnavailRow | null; error: unknown }> };
        };
      };
    };
    const unavailClient = supabase as unknown as RebookInsertClient;

    const { data: unavailability, error: unavailError } = await unavailClient
      .from("doctor_unavailability")
      .insert({
        doctor_id: doctorId,
        clinic_id: clinicId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || "Unavailable",
      })
      .select("id")
      .single();

    if (unavailError) {
      logger.warn("Failed to record unavailability", {
        context: "doctor-unavailability",
        error: unavailError,
      });
      return apiInternalError("Failed to record unavailability");
    }

    const unavailabilityId = unavailability?.id;

    // 2. Find all affected appointments in the date range
    const { data: affectedAppointments, error: apptError } = await supabase
      .from("appointments")
      .select(`
        id,
        patient_id,
        doctor_id,
        service_id,
        appointment_date,
        start_time,
        end_time,
        slot_start,
        slot_end,
        status,
        patients:patient_id (id, name, phone),
        doctors:doctor_id (id, name),
        services:service_id (name)
      `)
      .eq("doctor_id", doctorId)
      .eq("clinic_id", clinicId)
      .gte("appointment_date", startDate)
      .lte("appointment_date", endDate)
      .in("status", ["confirmed", "pending", "scheduled"]);

    if (apptError) {
      logger.warn("Failed to query affected appointments", {
        context: "doctor-unavailability",
        error: apptError,
      });
      return apiInternalError("Failed to query affected appointments");
    }

    if (!affectedAppointments || affectedAppointments.length === 0) {
      return apiSuccess({
        unavailabilityId,
        affectedCount: 0,
        message: "No appointments affected",
      });
    }

    // 3. Find all existing doctor appointments to determine booked slots
    const { data: allDoctorAppts } = await supabase
      .from("appointments")
      .select("appointment_date, start_time, status")
      .eq("doctor_id", doctorId)
      .eq("clinic_id", clinicId)
      .in("status", ["confirmed", "pending", "scheduled", "in_progress"]);

    const bookedSlots = buildBookedSlotsSet(allDoctorAppts ?? []);

    // 4. Find alternative slots using tenant-specific working hours
    const tenantConfig = await getClinicConfig(clinicId);
    const alternatives = findAlternativeSlots(
      bookedSlots,
      startDate,
      endDate,
      tenantConfig.workingHours,
      tenantConfig.booking.slotDuration,
      3,
    );

    // 5. Process each affected appointment
    const rebookingResults: Array<{
      appointmentId: string;
      patientName: string;
      whatsappSent: boolean;
    }> = [];

    for (const appt of affectedAppointments) {
      const patientRaw = appt.patients;
      const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw;
      const doctorRaw = appt.doctors;
      const doctor = Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw;
      const serviceRaw = appt.services;
      const service = Array.isArray(serviceRaw) ? serviceRaw[0] : serviceRaw;

      if (!patient) continue;

      // Create a rebooking request record
      const alternativeData = alternatives.map((alt, idx) => ({
        option_index: idx + 1,
        date: alt.date,
        time: alt.time,
        slot_start: alt.slotStart,
        slot_end: alt.slotEnd,
        label: alt.label,
      }));

      // rebooking_requests not yet in generated types — cast through unknown
      type RbInsertClient = {
        from(t: string): {
          insert(row: Record<string, unknown>): Promise<void>;
        };
      };
      const rbInsert = supabase as unknown as RbInsertClient;
      await rbInsert.from("rebooking_requests").insert({
        appointment_id: appt.id,
        unavailability_id: unavailabilityId,
        clinic_id: clinicId,
        doctor_id: doctorId,
        patient_id: patient.id,
        status: "pending",
        alternatives: alternativeData,
        sent_at: new Date().toISOString(),
      });

      // A73-F2: Enqueue WhatsApp sends via notification_queue instead of
      // sending inline. For a 1-month unavailability the result set could be
      // hundreds of appointments — sending inline creates O(N) external calls
      // with no backpressure. The queue provides retry, backoff, and rate limiting.
      let whatsappEnqueued = false;
      if (patient.phone && alternatives.length > 0) {
        const doctorName = doctor?.name ?? "your doctor";
        const serviceName = service?.name ?? "appointment";
        const messageBody =
          `Hello ${patient.name}, your ${serviceName} with ${doctorName} ` +
          `on ${appt.appointment_date} at ${appt.start_time?.slice(0, 5) ?? ""} ` +
          `has been cancelled because the doctor is unavailable.\n\n` +
          `Please choose a new time slot:\n` +
          alternatives.slice(0, 3).map((alt, idx) => `${idx + 1}. ${alt.label}`).join("\n");

        try {
          const queueId = await enqueueNotification({
            clinicId,
            channel: "whatsapp",
            recipient: patient.phone,
            body: messageBody,
            trigger: "cancellation",
            metadata: {
              appointmentId: appt.id,
              unavailabilityId: unavailabilityId ?? "",
              doctorId,
            },
          });
          whatsappEnqueued = queueId !== null;
        } catch (err) {
          logger.warn("Failed to enqueue rebooking WhatsApp", {
            context: "doctor-unavailability",
            appointmentId: appt.id,
            error: err,
          });
        }
      }

      rebookingResults.push({
        appointmentId: appt.id,
        patientName: patient.name,
        whatsappSent: whatsappEnqueued,
      });
    }

    return apiSuccess({
      unavailabilityId,
      affectedCount: affectedAppointments.length,
      alternatives,
      rebookingResults,
    });
}, ["clinic_admin", "doctor"]);

/**
 * GET /api/doctor-unavailability?doctorId=...
 *
 * Returns rebooking status for a doctor's unavailability events.
 *
 * AUDIT F-01: clinicId is now derived from the subdomain via requireTenant().
 * The query-param clinicId is ignored to prevent cross-tenant reads.
 */
export const GET = withAuth(async (request, auth) => {
  try {
    const supabase = auth.supabase;

    // AUDIT F-01: Derive clinicId from subdomain, not from query params.
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get("doctorId");

    // rebooking_requests not yet in generated types — cast through unknown
    type RbRow = { id: string; status: string; [k: string]: unknown };
    type RbQueryClient = {
      from(t: string): {
        select(s: string): {
          eq(c: string, v: string): RbQueryChain;
        };
      };
    };
    type RbQueryChain = {
      eq(c: string, v: string): RbQueryChain;
      order(c: string, o: { ascending: boolean }): RbQueryChain;
      limit(n: number): Promise<{ data: RbRow[] | null; error: unknown }>;
    };
    const rbQuery = supabase as unknown as RbQueryClient;

    let query = rbQuery
      .from("rebooking_requests")
      .select("id, appointment_id, unavailability_id, clinic_id, doctor_id, patient_id, status, alternatives, sent_at, created_at")
      .eq("clinic_id", clinicId);

    if (doctorId) {
      query = query.eq("doctor_id", doctorId);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      logger.warn("Failed to fetch rebooking requests", {
        context: "doctor-unavailability",
        error,
      });
      return apiInternalError("Failed to fetch rebooking status");
    }

    // Calculate summary stats
    const requests = data ?? [];
    const total = requests.length;
    const rebooked = requests.filter((r) => r.status === "rebooked").length;
    const pending = requests.filter((r) => r.status === "pending").length;
    const expired = requests.filter((r) => r.status === "expired").length;

    return apiSuccess({
      requests,
      summary: { total, rebooked, pending, expired },
    });
  } catch (err) {
    logger.warn("Operation failed", {
      context: "doctor-unavailability/GET",
      error: err,
    });
    return apiInternalError("Failed to fetch rebooking status");
  }
}, ["clinic_admin", "doctor"]);
