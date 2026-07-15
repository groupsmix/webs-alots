import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOwnerDashboardDailyData,
  summarizeOwnerTodayAppointments,
} from "@/lib/data/admin-owner-dashboard";

const CLINIC_ID = "22220000-2222-2222-2222-222200002222";

const mockFrom = vi.fn();
const appointmentEq = vi.fn();
const appointmentGte = vi.fn();
const appointmentLt = vi.fn();
const appointmentLimit = vi.fn();
const briefingEq = vi.fn();
const briefingMaybeSingle = vi.fn();

const appointmentChain = {
  eq: appointmentEq,
  gte: appointmentGte,
  lt: appointmentLt,
  limit: appointmentLimit,
};
const briefingChain = {
  eq: briefingEq,
  maybeSingle: briefingMaybeSingle,
};

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
  appointmentLimit.mockResolvedValue({
    data: [
      { status: "pending" },
      { status: "confirmed" },
      { status: "checked_in" },
      { status: "in_progress" },
      { status: "completed" },
      { status: "no_show" },
    ],
    error: null,
  });

  briefingEq.mockReturnValue(briefingChain);
  briefingMaybeSingle.mockResolvedValue({
    data: {
      id: "briefing-1",
      briefing_date: "2026-07-14",
      content: "Daily clinic brief",
      generated_at: "2026-07-14T05:00:00.000Z",
    },
    error: null,
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === "appointments") {
      return { select: vi.fn().mockReturnValue(appointmentChain) };
    }
    if (table === "clinic_ai_briefings") {
      return { select: vi.fn().mockReturnValue(briefingChain) };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("summarizeOwnerTodayAppointments", () => {
  it("counts the appointment states used by the owner dashboard", () => {
    expect(
      summarizeOwnerTodayAppointments([
        { status: "pending" },
        { status: "reminded" },
        { status: "confirmed" },
        { status: "scheduled" },
        { status: "checked_in" },
        { status: "in_progress" },
        { status: "completed" },
        { status: "cancelled" },
        { status: "no_show" },
      ]),
    ).toEqual({
      totalAppointments: 9,
      unconfirmedAppointments: 2,
      confirmedAppointments: 2,
      checkedInAppointments: 1,
      inProgressAppointments: 1,
      completedAppointments: 1,
      cancelledAppointments: 1,
      noShowAppointments: 1,
    });
  });
});

describe("getOwnerDashboardDailyData", () => {
  it("loads only the clinic's current-day appointments and briefing", async () => {
    const result = await getOwnerDashboardDailyData(CLINIC_ID, "2026-07-14", "Africa/Casablanca");

    expect(appointmentEq).toHaveBeenCalledWith("clinic_id", CLINIC_ID);
    expect(briefingEq).toHaveBeenCalledWith("clinic_id", CLINIC_ID);
    expect(briefingEq).toHaveBeenCalledWith("briefing_date", "2026-07-14");
    expect(appointmentGte).toHaveBeenCalledWith("slot_start", "2026-07-13T23:00:00.000Z");
    expect(appointmentLt).toHaveBeenCalledWith("slot_start", "2026-07-14T23:00:00.000Z");
    expect(result.today).toMatchObject({
      totalAppointments: 6,
      unconfirmedAppointments: 1,
      checkedInAppointments: 1,
      completedAppointments: 1,
      noShowAppointments: 1,
    });
    expect(result.briefing).toEqual({
      id: "briefing-1",
      briefingDate: "2026-07-14",
      content: "Daily clinic brief",
      generatedAt: "2026-07-14T05:00:00.000Z",
    });
  });

  it("returns no briefing when the morning brief is not available", async () => {
    briefingMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getOwnerDashboardDailyData(CLINIC_ID, "2026-07-14", "Africa/Casablanca");

    expect(result.briefing).toBeNull();
  });
});
