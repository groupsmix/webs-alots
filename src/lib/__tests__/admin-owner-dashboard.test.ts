import { describe, expect, it } from "vitest";
import { calculateNoShowRate, getOwnerAttentionItems } from "@/lib/admin-owner-dashboard";
import type { DashboardStats } from "@/lib/data/dashboard";

function makeToday(
  overrides: Partial<Parameters<typeof getOwnerAttentionItems>[1]> = {},
): NonNullable<Parameters<typeof getOwnerAttentionItems>[1]> {
  return {
    totalAppointments: 0,
    unconfirmedAppointments: 0,
    confirmedAppointments: 0,
    checkedInAppointments: 0,
    inProgressAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
    ...overrides,
  };
}

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    totalPatients: 20,
    totalAppointments: 100,
    completedAppointments: 80,
    noShowCount: 5,
    totalRevenue: 15000,
    averageRating: 4.5,
    doctorCount: 3,
    insurancePatients: 8,
    recentActivity: [],
    ...overrides,
  };
}

describe("calculateNoShowRate", () => {
  it("returns zero when no appointments are recorded", () => {
    expect(calculateNoShowRate(makeStats({ totalAppointments: 0, noShowCount: 4 }))).toBe(0);
  });

  it("rounds the rate to a whole percentage", () => {
    expect(calculateNoShowRate(makeStats({ totalAppointments: 30, noShowCount: 4 }))).toBe(13);
  });
});

describe("getOwnerAttentionItems", () => {
  it("returns no alerts when the available totals are healthy", () => {
    expect(getOwnerAttentionItems(makeStats())).toEqual([]);
  });

  it("puts today's operational alerts first without repeating the no-show alert", () => {
    expect(
      getOwnerAttentionItems(
        makeStats({ noShowCount: 20 }),
        makeToday({
          unconfirmedAppointments: 3,
          checkedInAppointments: 2,
          noShowAppointments: 1,
        }),
      ).map((item) => item.kind),
    ).toEqual(["unconfirmedToday", "waitingToday", "noShowToday"]);
  });

  it("returns setup alerts for clinics without doctors or patients", () => {
    expect(
      getOwnerAttentionItems(makeStats({ doctorCount: 0, totalPatients: 0 })).map(
        (item) => item.kind,
      ),
    ).toEqual(["missingDoctor", "missingPatient"]);
  });

  it("uses warning at 10% no-shows and danger at 20%", () => {
    expect(
      getOwnerAttentionItems(makeStats({ noShowCount: 10 })).find(
        (item) => item.kind === "noShowRate",
      )?.tone,
    ).toBe("warning");
    expect(
      getOwnerAttentionItems(makeStats({ noShowCount: 20 })).find(
        (item) => item.kind === "noShowRate",
      )?.tone,
    ).toBe("danger");
  });

  it("only flags a non-zero rating below four", () => {
    expect(getOwnerAttentionItems(makeStats({ averageRating: 0 }))).toEqual([]);
    expect(
      getOwnerAttentionItems(makeStats({ averageRating: 3.9 })).map((item) => item.kind),
    ).toContain("lowRating");
    expect(getOwnerAttentionItems(makeStats({ averageRating: 4 }))).toEqual([]);
  });
});
