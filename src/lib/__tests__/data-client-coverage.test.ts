import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  clearLookupCache,
  fetchAppointments,
  fetchDoctorAppointments,
  fetchPatientAppointments,
  fetchGeneratedSlots,
  fetchSlotBookingCounts,
  fetchAvailableSlots,
  fetchConsultationNotes,
  fetchTimeSlots,
  fetchNotifications,
  fetchDashboardStats,
  fetchMedicalCertificates,
  fetchOdontogram,
  fetchTreatmentPlans,
  fetchSterilizationLog,
  fetchBeforeAfterPhotos,
  fetchInstallmentPlans,
  fetchHolidays,
} from "@/lib/data/client";
import { createClient, createTenantClient } from "@/lib/supabase-client";
import { createMockSupabaseClient } from "./test-utils";

vi.mock("@/lib/supabase-client", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

function setupMock(rows: Record<string, unknown[]>) {
  const mockSupabase = createMockSupabaseClient(rows);
  vi.mocked(createClient).mockReturnValue(mockSupabase as never);
  vi.mocked(createTenantClient).mockReturnValue(mockSupabase as never);
  return mockSupabase;
}

beforeEach(() => {
  clearLookupCache();
});

// ── Appointments ──────────────────────────────────────────────────────

describe("appointments", () => {
  const rows = {
    users: [
      {
        id: "p1",
        name: "Patient One",
        phone: "+212600000001",
        email: "p1@test.ma",
        clinic_id: "clinic-1",
      },
      {
        id: "d1",
        name: "Dr. Amina",
        phone: null,
        email: null,
        clinic_id: "clinic-1",
      },
    ],
    services: [{ id: "s1", name: "Consultation", price: 200, clinic_id: "clinic-1" }],
    appointments: [
      {
        id: "a1",
        clinic_id: "clinic-1",
        patient_id: "p1",
        doctor_id: "d1",
        service_id: "s1",
        slot_start: "2026-08-01T10:00:00Z",
        slot_end: "2026-08-01T10:30:00Z",
        appointment_date: "2026-08-01",
        start_time: "10:00:00",
        end_time: "10:30:00",
        status: "confirmed",
        is_first_visit: true,
        is_walk_in: false,
        insurance_flag: true,
        booking_source: "online",
        notes: null,
        cancelled_at: null,
        cancellation_reason: null,
        rescheduled_from: null,
        is_emergency: false,
        recurrence_group_id: null,
        recurrence_pattern: null,
        recurrence_index: null,
        created_at: "2026-07-11T09:00:00Z",
        updated_at: "2026-07-11T09:00:00Z",
      },
    ],
  };

  it("fetchAppointments returns mapped appointments", async () => {
    setupMock(rows);
    const appointments = await fetchAppointments("clinic-1");
    expect(appointments).toHaveLength(1);
    expect(appointments[0].patientName).toBe("Patient One");
    expect(appointments[0].serviceName).toBe("Consultation");
    expect(appointments[0].hasInsurance).toBe(true);
    expect(appointments[0].isFirstVisit).toBe(true);
  });

  it("fetchAppointments filters by sinceDate", async () => {
    setupMock(rows);
    const appointments = await fetchAppointments("clinic-1", { sinceDate: "2026-08-01" });
    expect(appointments).toHaveLength(1);
  });

  it("fetchDoctorAppointments filters by doctor", async () => {
    setupMock(rows);
    const appointments = await fetchDoctorAppointments("clinic-1", "d1");
    expect(appointments).toHaveLength(1);
    expect(appointments[0].doctorName).toBe("Dr. Amina");
  });

  it("fetchPatientAppointments filters by patient", async () => {
    setupMock(rows);
    const appointments = await fetchPatientAppointments("clinic-1", "p1");
    expect(appointments).toHaveLength(1);
    expect(appointments[0].patientName).toBe("Patient One");
  });
});

// ── Booking ───────────────────────────────────────────────────────────

describe("booking", () => {
  const rows = {
    users: [
      {
        id: "d1",
        name: "Dr. Amina",
        phone: null,
        email: null,
        clinic_id: "clinic-1",
      },
    ],
    services: [{ id: "s1", name: "Consultation", price: 200, clinic_id: "clinic-1" }],
    time_slots: [
      {
        id: "ts1",
        clinic_id: "clinic-1",
        doctor_id: "d1",
        day_of_week: 6, // Saturday for 2026-08-01
        start_time: "09:00",
        end_time: "10:00",
        max_capacity: 2,
        buffer_minutes: 0,
        buffer_min: 0,
        is_available: true,
        is_active: true,
      },
    ],
    appointments: [
      {
        id: "a1",
        clinic_id: "clinic-1",
        patient_id: "p1",
        doctor_id: "d1",
        appointment_date: "2026-08-01",
        start_time: "09:00:00",
        status: "confirmed",
      },
      {
        id: "a2",
        clinic_id: "clinic-1",
        patient_id: "p2",
        doctor_id: "d1",
        appointment_date: "2026-08-01",
        start_time: "09:00:00",
        status: "cancelled",
      },
      {
        id: "a3",
        clinic_id: "clinic-1",
        patient_id: "p3",
        doctor_id: "d1",
        appointment_date: "2026-08-01",
        start_time: "09:00:00",
        status: "confirmed",
      },
    ],
  };

  it("fetchGeneratedSlots returns time slots for a doctor and date", async () => {
    setupMock(rows);
    const slots = await fetchGeneratedSlots("clinic-1", "2026-08-01", "d1", {
      slotDuration: 30,
      bufferTime: 0,
      maxPerSlot: 2,
    });
    expect(slots).toContain("09:00");
    expect(slots).toContain("09:30");
  });

  it("fetchSlotBookingCounts excludes cancelled and no_show", async () => {
    setupMock(rows);
    const counts = await fetchSlotBookingCounts("clinic-1", "2026-08-01", "d1");
    expect(counts["09:00"]).toBe(2);
    expect(counts["09:30"]).toBeUndefined();
    expect(counts["cancelled"]).toBeUndefined();
  });

  it("fetchAvailableSlots removes fully booked slots", async () => {
    setupMock(rows);
    const slots = await fetchAvailableSlots("clinic-1", "2026-08-01", "d1", {
      slotDuration: 30,
      bufferTime: 0,
      maxPerSlot: 2,
    });
    expect(slots).not.toContain("09:00");
    expect(slots).toContain("09:30");
  });
});

// ── Clinical ──────────────────────────────────────────────────────────

describe("clinical", () => {
  const rows = {
    users: [
      {
        id: "p1",
        name: "Patient One",
        phone: "+212600000001",
        email: "p1@test.ma",
        clinic_id: "clinic-1",
      },
      {
        id: "d1",
        name: "Dr. Amina",
        phone: null,
        email: null,
        clinic_id: "clinic-1",
      },
    ],
    services: [{ id: "s1", name: "Consultation", price: 200, clinic_id: "clinic-1" }],
    consultation_notes: [
      {
        id: "cn1",
        clinic_id: "clinic-1",
        appointment_id: "a1",
        doctor_id: "d1",
        patient_id: "p1",
        notes: "Bilan",
        diagnosis: "Grippe",
        content: { reason: "fever" },
        created_at: "2026-07-11T09:00:00Z",
        updated_at: "2026-07-11T09:00:00Z",
      },
    ],
    time_slots: [
      {
        id: "ts1",
        clinic_id: "clinic-1",
        doctor_id: "d1",
        day_of_week: 6,
        start_time: "09:00",
        end_time: "10:00",
        max_capacity: 2,
        buffer_minutes: 5,
        buffer_min: 5,
        is_available: true,
        is_active: true,
      },
    ],
    notifications: [
      {
        id: "n1",
        clinic_id: "clinic-1",
        user_id: "p1",
        type: "appointment",
        channel: "in_app",
        title: "Rappel",
        body: "Rendez-vous demain",
        is_read: false,
        sent_at: "2026-07-11T09:00:00Z",
      },
    ],
  };

  it("fetchConsultationNotes maps notes with patient and doctor names", async () => {
    setupMock(rows);
    const notes = await fetchConsultationNotes("clinic-1");
    expect(notes).toHaveLength(1);
    expect(notes[0].patientName).toBe("Patient One");
    expect(notes[0].doctorName).toBe("Dr. Amina");
    expect(notes[0].diagnosis).toBe("Grippe");
  });

  it("fetchTimeSlots maps active slots", async () => {
    setupMock(rows);
    const slots = await fetchTimeSlots("clinic-1", "d1");
    expect(slots).toHaveLength(1);
    expect(slots[0].startTime).toBe("09:00");
    expect(slots[0].isAvailable).toBe(true);
  });

  it("fetchNotifications maps notifications", async () => {
    setupMock(rows);
    const notifications = await fetchNotifications("p1");
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("Rappel");
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].status).toBe("delivered");
  });
});

describe("clinical dashboard stats", () => {
  const rows = {
    users: [
      {
        id: "p1",
        clinic_id: "clinic-1",
        role: "patient",
        metadata: { insurance: true },
      },
      {
        id: "p2",
        clinic_id: "clinic-1",
        role: "patient",
        metadata: null,
      },
      {
        id: "d1",
        clinic_id: "clinic-1",
        role: "doctor",
        metadata: null,
      },
    ],
    appointments: [
      { id: "a1", clinic_id: "clinic-1", status: "completed" },
      { id: "a2", clinic_id: "clinic-1", status: "no_show" },
      { id: "a3", clinic_id: "clinic-1", status: "confirmed" },
    ],
    payments: [
      { id: "pay1", clinic_id: "clinic-1", status: "completed", amount: 200 },
      { id: "pay2", clinic_id: "clinic-1", status: "completed", amount: 300 },
    ],
    reviews: [
      { id: "r1", clinic_id: "clinic-1", stars: 5 },
      { id: "r2", clinic_id: "clinic-1", stars: 3 },
    ],
  };

  it("fetchDashboardStats aggregates counts", async () => {
    setupMock(rows);
    const stats = await fetchDashboardStats("clinic-1");
    expect(stats.totalPatients).toBe(2);
    expect(stats.totalAppointments).toBe(3);
    expect(stats.completedAppointments).toBe(1);
    expect(stats.noShowCount).toBe(1);
    expect(stats.totalRevenue).toBe(500);
    expect(stats.averageRating).toBe(4);
    expect(stats.doctorCount).toBe(1);
    expect(stats.insurancePatients).toBe(1);
  });
});

// ── Dental ────────────────────────────────────────────────────────────

describe("dental", () => {
  const rows = {
    users: [
      {
        id: "p1",
        name: "Patient One",
        phone: "+212600000001",
        email: "p1@test.ma",
        clinic_id: "clinic-1",
      },
      {
        id: "d1",
        name: "Dr. Amina",
        phone: null,
        email: null,
        clinic_id: "clinic-1",
      },
    ],
    services: [{ id: "s1", name: "Consultation", price: 200, clinic_id: "clinic-1" }],
    medical_certificates: [
      {
        id: "mc1",
        clinic_id: "clinic-1",
        patient_id: "p1",
        doctor_id: "d1",
        appointment_id: null,
        type: "sick_leave",
        content: { reason: "grippe" },
        pdf_url: null,
        issued_date: "2026-07-10",
        created_at: "2026-07-10T09:00:00Z",
      },
    ],
    odontogram: [
      {
        tooth_number: 11,
        clinic_id: "clinic-1",
        patient_id: "p1",
        status: "healthy",
        notes: null,
      },
    ],
    treatment_plans: [
      {
        id: "tp1",
        clinic_id: "clinic-1",
        patient_id: "p1",
        doctor_id: "d1",
        title: "Traitement carie",
        steps: [
          { step: 1, description: "Nettoyage", status: "completed", date: "2026-07-10", cost: 100 },
        ],
        total_cost: 100,
        status: "in_progress",
        created_at: "2026-07-10T09:00:00Z",
        updated_at: "2026-07-10T09:00:00Z",
      },
    ],
    sterilization_log: [
      {
        id: "sl1",
        clinic_id: "clinic-1",
        tool_name: "Pince",
        sterilized_by: "Assistant",
        sterilized_at: "2026-07-11T08:00:00Z",
        next_due: "2026-07-18T08:00:00Z",
        method: "autoclave",
        notes: null,
        batch_number: "B001",
        cycle_number: 1,
      },
    ],
    before_after_photos: [
      {
        id: "bap1",
        clinic_id: "clinic-1",
        patient_id: "p1",
        treatment_plan_id: "tp1",
        description: "Avant/après",
        before_date: "2026-07-01",
        after_date: "2026-07-10",
        category: "smile",
      },
    ],
  };

  it("fetchMedicalCertificates maps certificates", async () => {
    setupMock(rows);
    const certs = await fetchMedicalCertificates("clinic-1");
    expect(certs).toHaveLength(1);
    expect(certs[0].patientName).toBe("Patient One");
    expect(certs[0].type).toBe("sick_leave");
  });

  it("fetchOdontogram maps teeth", async () => {
    setupMock(rows);
    const teeth = await fetchOdontogram("clinic-1", "p1");
    expect(teeth).toHaveLength(1);
    expect(teeth[0].toothNumber).toBe(11);
  });

  it("fetchTreatmentPlans maps plans and steps", async () => {
    setupMock(rows);
    const plans = await fetchTreatmentPlans("clinic-1");
    expect(plans).toHaveLength(1);
    expect(plans[0].steps).toHaveLength(1);
    expect(plans[0].steps[0].cost).toBe(100);
  });

  it("fetchSterilizationLog maps log entries", async () => {
    setupMock(rows);
    const log = await fetchSterilizationLog("clinic-1");
    expect(log).toHaveLength(1);
    expect(log[0].toolName).toBe("Pince");
    expect(log[0].method).toBe("autoclave");
  });

  it("fetchBeforeAfterPhotos maps photos", async () => {
    setupMock(rows);
    const photos = await fetchBeforeAfterPhotos("clinic-1");
    expect(photos).toHaveLength(1);
    expect(photos[0].category).toBe("smile");
  });
});

// ── Clinic ────────────────────────────────────────────────────────────

describe("clinic", () => {
  const rows = {
    users: [
      {
        id: "p1",
        name: "Patient One",
        phone: "+212600000001",
        email: "p1@test.ma",
        clinic_id: "clinic-1",
      },
    ],
    services: [{ id: "s1", name: "Consultation", price: 200, clinic_id: "clinic-1" }],
    installment_plans: [
      {
        id: "ip1",
        clinic_id: "clinic-1",
        patient_id: "p1",
        treatment_plan_id: "tp1",
        total_amount: 1000,
        currency: "MAD",
        down_payment: 200,
        status: "active",
        whatsapp_reminder: true,
        created_at: "2026-07-10T09:00:00Z",
      },
    ],
    installments: [
      {
        id: "i1",
        plan_id: "ip1",
        amount: 200,
        due_date: "2026-08-10",
        paid_date: null,
        status: "pending",
        receipt_id: null,
      },
      {
        id: "i2",
        plan_id: "ip1",
        amount: 200,
        due_date: "2026-09-10",
        paid_date: "2026-08-15",
        status: "paid",
        receipt_id: "r1",
      },
    ],
    treatment_plans: [{ id: "tp1", title: "Plan A", clinic_id: "clinic-1" }],
    clinic_holidays: [
      {
        id: "h1",
        clinic_id: "clinic-1",
        title: "Aid El Kebir",
        start_date: "2026-07-17",
        type: "national",
        recurring: false,
      },
    ],
  };

  it("fetchInstallmentPlans groups installments and maps plan data", async () => {
    setupMock(rows);
    const plans = await fetchInstallmentPlans("clinic-1");
    expect(plans).toHaveLength(1);
    expect(plans[0].installments).toHaveLength(2);
    expect(plans[0].treatmentTitle).toBe("Plan A");
    expect(plans[0].whatsappReminderEnabled).toBe(true);
  });

  it("fetchHolidays maps holiday rows", async () => {
    setupMock(rows);
    const holidays = await fetchHolidays("clinic-1");
    expect(holidays).toHaveLength(1);
    expect(holidays[0].name).toBe("Aid El Kebir");
    expect(holidays[0].type).toBe("national");
  });
});
