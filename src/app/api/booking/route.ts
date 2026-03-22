import { NextRequest, NextResponse } from "next/server";
import { clinicConfig } from "@/config/clinic.config";
import {
  getPublicGeneratedSlots,
  getPublicAvailableSlots,
  getPublicSlotBookingCounts,
  getPublicDoctors,
  getPublicServices,
  getPublicSpecialties,
} from "@/lib/data/public";
import { createClient } from "@/lib/supabase-server";

export const runtime = "edge";

interface BookingRequestBody {
  specialtyId: string;
  doctorId: string;
  doctorIds?: string[];
  serviceId: string;
  date: string;
  time: string;
  isFirstVisit: boolean;
  hasInsurance: boolean;
  patient: {
    name: string;
    phone: string;
    email?: string;
    reason?: string;
  };
  slotDuration: number;
  bufferTime: number;
}

interface ValidationResult {
  error: string | null;
  doctors: Awaited<ReturnType<typeof getPublicDoctors>>;
  services: Awaited<ReturnType<typeof getPublicServices>>;
}

async function validateBookingRequest(body: BookingRequestBody): Promise<ValidationResult> {
  const [specialties, doctors, services] = await Promise.all([
    getPublicSpecialties(),
    getPublicDoctors(),
    getPublicServices(),
  ]);

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

  // Reject past dates (compared in the clinic's configured timezone)
  const tz = clinicConfig.timezone ?? "Africa/Casablanca";
  const todayInTz = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // "YYYY-MM-DD"
  if (body.date < todayInTz) {
    return fail("Cannot book an appointment in the past");
  }

  // Parse day-of-week using noon to avoid DST edge cases.
  // Date string "YYYY-MM-DD" parsed at noon is safe across all timezones.
  const parsedDate = new Date(body.date + "T12:00:00");
  const dayOfWeek = parsedDate.getDay();
  const hours = clinicConfig.workingHours[dayOfWeek];
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
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BookingRequestBody;

    const validation = await validateBookingRequest(body);
    if (validation.error) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 },
      );
    }

    // Reuse data already fetched during validation (avoids duplicate queries)
    const doctor = validation.doctors.find((d) => d.id === body.doctorId);
    const service = validation.services.find((s) => s.id === body.serviceId);

    const supabase = await createClient();

    // Find or create a patient record
    let patientId: string;
    const { data: existingPatient } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinicConfig.clinicId)
      .eq("phone", body.patient.phone)
      .eq("role", "patient")
      .single();

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      const { data: newPatient, error: patientError } = await supabase
        .from("users")
        .insert({
          clinic_id: clinicConfig.clinicId,
          name: body.patient.name,
          phone: body.patient.phone,
          email: body.patient.email ?? null,
          role: "patient",
        })
        .select("id")
        .single();

      if (patientError || !newPatient) {
        return NextResponse.json({ error: "Failed to create patient record" }, { status: 500 });
      }
      patientId = newPatient.id;
    }

    // Calculate end time
    const duration = service?.duration ?? clinicConfig.booking.slotDuration;
    const [h, m] = body.time.split(":").map(Number);
    const endMinutes = h * 60 + m + duration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

    // Construct ISO slot boundaries for the required slot_start/slot_end columns
    const slotStart = `${body.date}T${body.time}:00`;
    const slotEnd = `${body.date}T${endTime}:00`;

    const { data: appointment, error: apptError } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinicConfig.clinicId,
        patient_id: patientId,
        doctor_id: body.doctorId,
        service_id: body.serviceId,
        appointment_date: body.date,
        start_time: body.time,
        end_time: endTime,
        slot_start: slotStart,
        slot_end: slotEnd,
        status: "confirmed",
        is_first_visit: body.isFirstVisit,
        insurance_flag: body.hasInsurance,
        booking_source: "online",
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
      console.error("[booking] create appointment:", apptError?.message);
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
    }

    console.log("Booking created:", appointment.id);

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
  } catch (err) {
    console.error("[booking] Error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/booking
 *
 * Returns available time slots for a given doctor and date.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");

  if (!doctorId || !date) {
    return NextResponse.json(
      { error: "doctorId and date are required" },
      { status: 400 },
    );
  }

  const [allSlots, availableSlots, bookedCounts] = await Promise.all([
    getPublicGeneratedSlots(date, doctorId),
    getPublicAvailableSlots(date, doctorId),
    getPublicSlotBookingCounts(date, doctorId),
  ]);

  return NextResponse.json({
    slots: availableSlots,
    allSlots,
    bookedCounts,
    maxPerSlot: clinicConfig.booking.maxPerSlot,
    slotDuration: clinicConfig.booking.slotDuration,
    bufferTime: clinicConfig.booking.bufferTime,
  });
}
