import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPatientDashboardData } from "@/lib/data/dashboard";
import { createClient, createTenantClient } from "@/lib/supabase-server";
import { createMockSupabaseClient } from "./test-utils";

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

describe("getPatientDashboardData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scopes appointments to a 90-day lookback and all future rows", async () => {
    const supabase = createMockSupabaseClient({
      appointments: [
        {
          id: "a1",
          doctor_id: "d1",
          service_id: "s1",
          appointment_date: "2026-07-11",
          start_time: "09:00:00",
          status: "confirmed",
          clinic_id: "clinic-1",
          patient_id: "patient-1",
        },
        {
          id: "a2",
          doctor_id: "d1",
          service_id: "s1",
          appointment_date: "2026-04-12",
          start_time: "10:00:00",
          status: "completed",
          clinic_id: "clinic-1",
          patient_id: "patient-1",
        },
        {
          id: "a3",
          doctor_id: "d1",
          service_id: "s1",
          appointment_date: "2026-04-11",
          start_time: "10:00:00",
          status: "completed",
          clinic_id: "clinic-1",
          patient_id: "patient-1",
        },
      ],
      prescriptions: [],
      payments: [],
      notifications: [],
      users: [{ id: "d1", name: "Dr. Amine", clinic_id: "clinic-1" }],
      services: [{ id: "s1", name: "Consultation", clinic_id: "clinic-1" }],
      clinics: [{ id: "clinic-1", config: { currency: "MAD" } }],
    });

    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createTenantClient).mockResolvedValue(supabase as never);

    const data = await getPatientDashboardData("clinic-1", "patient-1", "Patient");

    // The a3 appointment (before the lookback) must be excluded by the gte filter.
    expect(data.appointments.map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(data.appointments[0].date).toBe("2026-04-12");
    expect(data.appointments[1].date).toBe("2026-07-11");

    const apptBuilder = vi.mocked(supabase.from).mock.results[0].value;
    expect(apptBuilder.gte).toHaveBeenCalledWith("appointment_date", "2026-04-12");
    expect(apptBuilder.order).toHaveBeenCalledWith("appointment_date", { ascending: true });
  });
});
