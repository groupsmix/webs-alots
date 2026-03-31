import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendInteractiveMessage } from "@/lib/whatsapp";
import {
  findAlternativeSlots,
  buildBookedSlotsSet,
} from "@/lib/find-alternative-slots";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  apiError,
  apiInternalError,
  apiUnauthorized,
} from "@/lib/api-response";

/**
 * POST /api/doctor-unavailability
 *
 * Called when a doctor marks themselves unavailable for a date range.
 * 1. Records the unavailability
 * 2. Finds all affected appointments
 * 3. Finds alternative slots
 * 4. Sends WhatsApp messages to affected patients with rebooking options
 * 5. Creates rebooking_requests records to track responses
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify the caller is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiUnauthorized();
    }

    const body = (await request.json()) as {
      doctorId: string;
      clinicId: string;
      startDate: string;
      endDate: string;
      reason: string;
    };

    const { doctorId, clinicId, startDate, endDate, reason } = body;

    if (!doctorId || !clinicId || !startDate || !endDate) {
      return apiError("Missing required fields: doctorId, clinicId, startDate, endDate");
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

    // 4. Find alternative slots
    const alternatives = findAlternativeSlots(
      bookedSlots,
      startDate,
      endDate,
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

      // Send WhatsApp with interactive buttons
      let whatsappSent = false;
      if (patient.phone && alternatives.length > 0) {
        const doctorName = doctor?.name ?? "your doctor";
        const serviceName = service?.name ?? "appointment";
        const messageBody =
          `Hello ${patient.name}, your ${serviceName} with ${doctorName} ` +
          `on ${appt.appointment_date} at ${appt.start_time?.slice(0, 5) ?? ""} ` +
          `has been cancelled because the doctor is unavailable.\n\n` +
          `Please choose a new time slot:`;

        const buttons = alternatives.slice(0, 3).map((alt, idx) => ({
          id: `REBOOK_${appt.id}_${idx + 1}`,
          title: alt.label.slice(0, 20),
        }));

        try {
          const result = await sendInteractiveMessage({
            to: patient.phone,
            body: messageBody,
            buttons,
            header: "Appointment Rebooking",
            footer: "Reply within 24 hours",
          });
          whatsappSent = result.success;
        } catch (err) {
          logger.warn("Failed to send rebooking WhatsApp", {
            context: "doctor-unavailability",
            appointmentId: appt.id,
            error: err,
          });
        }
      }

      rebookingResults.push({
        appointmentId: appt.id,
        patientName: patient.name,
        whatsappSent,
      });
    }

    return apiSuccess({
      unavailabilityId,
      affectedCount: affectedAppointments.length,
      alternatives,
      rebookingResults,
    });
  } catch (err) {
    logger.warn("Operation failed", {
      context: "doctor-unavailability",
      error: err,
    });
    return apiInternalError("Failed to process unavailability");
  }
}

/**
 * GET /api/doctor-unavailability?clinicId=...&doctorId=...
 *
 * Returns rebooking status for a doctor's unavailability events.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiUnauthorized();
    }

    const { searchParams } = request.nextUrl;
    const clinicId = searchParams.get("clinicId");
    const doctorId = searchParams.get("doctorId");

    if (!clinicId) {
      return apiError("Missing clinicId parameter");
    }

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
      .select("*")
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
}
