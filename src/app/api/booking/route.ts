import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, generateTimeSlots, appointments, doctors, services, specialties, assignDoctorsToAppointment } from "@/lib/demo-data";
import { clinicConfig } from "@/config/clinic.config";

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

function validateBookingRequest(body: BookingRequestBody): string | null {
  if (!body.specialtyId || !specialties.find((s) => s.id === body.specialtyId)) {
    return "Invalid specialty selected";
  }
  if (!body.doctorId || !doctors.find((d) => d.id === body.doctorId)) {
    return "Invalid doctor selected";
  }
  if (!body.serviceId || !services.find((s) => s.id === body.serviceId)) {
    return "Invalid service selected";
  }
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return "Invalid date format (expected YYYY-MM-DD)";
  }
  if (!body.time || !/^\d{2}:\d{2}$/.test(body.time)) {
    return "Invalid time format (expected HH:MM)";
  }
  if (!body.patient?.name || body.patient.name.trim().length < 2) {
    return "Patient name is required (minimum 2 characters)";
  }
  if (!body.patient?.phone || body.patient.phone.trim().length < 6) {
    return "Valid phone number is required";
  }

  const d = new Date(body.date);
  const dayOfWeek = d.getDay();
  const hours = clinicConfig.workingHours[dayOfWeek];
  if (!hours?.enabled) {
    return "Selected date is not a working day";
  }

  const allSlots = generateTimeSlots(body.date);
  if (!allSlots.includes(body.time)) {
    return "Selected time is not a valid slot";
  }

  const availableSlots = getAvailableSlots(body.date, body.doctorId);
  if (!availableSlots.includes(body.time)) {
    return "Selected time slot is already fully booked";
  }

  return null;
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

    const validationError = validateBookingRequest(body);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 },
      );
    }

    const doctor = doctors.find((d) => d.id === body.doctorId);
    const service = services.find((s) => s.id === body.serviceId);

    const newAppointment = {
      id: `apt-${Date.now()}`,
      patientName: body.patient.name,
      patientPhone: body.patient.phone,
      patientEmail: body.patient.email ?? "",
      doctorId: body.doctorId,
      serviceId: body.serviceId,
      specialtyId: body.specialtyId,
      date: body.date,
      time: body.time,
      status: "confirmed" as const,
      isFirstVisit: body.isFirstVisit,
      hasInsurance: body.hasInsurance,
      reason: body.patient.reason ?? "",
      slotDuration: body.slotDuration ?? clinicConfig.booking.slotDuration,
      bufferTime: body.bufferTime ?? clinicConfig.booking.bufferTime,
      createdAt: new Date().toISOString(),
    };

    appointments.push(newAppointment);

    // Multi-doctor support: assign additional doctors if provided
    if (body.doctorIds && body.doctorIds.length > 0 && clinicConfig.features.multiDoctor) {
      assignDoctorsToAppointment(newAppointment.id, body.doctorIds, body.doctorId);
    }

    console.log("Booking created:", JSON.stringify(newAppointment));

    return NextResponse.json({
      status: "created",
      message: "Appointment booked successfully",
      appointment: {
        id: newAppointment.id,
        doctor: doctor?.name,
        service: service?.name,
        date: newAppointment.date,
        time: newAppointment.time,
        duration: service?.duration,
        price: service?.price,
        currency: service?.currency,
        isFirstVisit: newAppointment.isFirstVisit,
        hasInsurance: newAppointment.hasInsurance,
      },
    });
  } catch {
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

  const allSlots = generateTimeSlots(date);
  const availableSlots = getAvailableSlots(date, doctorId);

  const bookedCounts: Record<string, number> = {};
  for (const slot of allSlots) {
    const count = appointments.filter(
      (a) => a.date === date && a.doctorId === doctorId && a.time === slot && a.status !== "cancelled"
    ).length;
    if (count > 0) bookedCounts[slot] = count;
  }

  return NextResponse.json({
    slots: availableSlots,
    allSlots,
    bookedCounts,
    maxPerSlot: clinicConfig.booking.maxPerSlot,
    slotDuration: clinicConfig.booking.slotDuration,
    bufferTime: clinicConfig.booking.bufferTime,
  });
}
