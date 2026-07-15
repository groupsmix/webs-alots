import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminAgendaAppointments } from "@/lib/data/admin-agenda";

const CLINIC_ID = "11110000-1111-1111-1111-111100001111";

const mockFrom = vi.fn();
const appointmentEq = vi.fn();
const appointmentGte = vi.fn();
const appointmentLt = vi.fn();
const appointmentOrder = vi.fn();
const appointmentLimit = vi.fn();
const userEq = vi.fn();
const userIn = vi.fn();
const serviceEq = vi.fn();
const serviceIn = vi.fn();

const appointmentChain = {
  eq: appointmentEq,
  gte: appointmentGte,
  lt: appointmentLt,
  order: appointmentOrder,
  limit: appointmentLimit,
};
const userChain = { eq: userEq, in: userIn };
const serviceChain = { eq: serviceEq, in: serviceIn };

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();

  appointmentEq.mockReturnValue(appointmentChain);
  appointmentGte.mockReturnValue(appointmentChain);
  appointmentLt.mockReturnValue(appointmentChain);
  appointmentOrder.mockReturnValue(appointmentChain);
  appointmentLimit.mockResolvedValue({
    data: [
      {
        id: "appointment-1",
        patient_id: "patient-1",
        doctor_id: "doctor-1",
        service_id: "service-1",
        slot_start: "2026-07-14T09:00:00.000Z",
        status: "confirmed",
      },
    ],
    error: null,
  });

  userEq.mockReturnValue(userChain);
  userIn.mockResolvedValue({
    data: [
      { id: "patient-1", name: "Patient Test" },
      { id: "doctor-1", name: "Doctor Test" },
    ],
    error: null,
  });
  serviceEq.mockReturnValue(serviceChain);
  serviceIn.mockResolvedValue({
    data: [{ id: "service-1", name: "Consultation" }],
    error: null,
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === "appointments") {
      return { select: vi.fn().mockReturnValue(appointmentChain) };
    }
    if (table === "users") {
      return { select: vi.fn().mockReturnValue(userChain) };
    }
    if (table === "services") {
      return { select: vi.fn().mockReturnValue(serviceChain) };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("getAdminAgendaAppointments", () => {
  it("scopes appointment, user, and service reads to the clinic", async () => {
    const result = await getAdminAgendaAppointments(CLINIC_ID, "2026-07-14", "Africa/Casablanca");

    expect(appointmentEq).toHaveBeenCalledWith("clinic_id", CLINIC_ID);
    expect(userEq).toHaveBeenCalledWith("clinic_id", CLINIC_ID);
    expect(serviceEq).toHaveBeenCalledWith("clinic_id", CLINIC_ID);
    expect(result).toEqual([
      {
        id: "appointment-1",
        slotStart: "2026-07-14T09:00:00.000Z",
        status: "confirmed",
        patientName: "Patient Test",
        doctorName: "Doctor Test",
        serviceName: "Consultation",
      },
    ]);
  });

  it("skips related record queries when the agenda is empty", async () => {
    appointmentLimit.mockResolvedValueOnce({ data: [], error: null });

    await expect(
      getAdminAgendaAppointments(CLINIC_ID, "2026-07-14", "Africa/Casablanca"),
    ).resolves.toEqual([]);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("appointments");
  });
});
