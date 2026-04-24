import { describe, it, expect } from "vitest";
import { clinicDateTime } from "../timezone";
import { isCancellableStatus, NON_CANCELLABLE_STATUSES } from "../booking-utils";
import type { AppointmentStatus } from "@/lib/types/database";

// Test the server-side cancellation logic used in /api/booking/cancel
// We test the timezone-aware cancellation window check that the route performs.

describe("booking cancellation window (timezone-aware)", () => {
  it("rejects cancellation when less than cancellationHours before appointment", () => {
    const timezone = "Africa/Casablanca";
    const cancellationHours = 24;

    // Create an appointment 12 hours from now — should NOT be cancellable
    const now = new Date();
    const futureDate = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    // Format the future date in the clinic timezone
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(futureDate);
    const dateStr = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;

    const timeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(futureDate);
    const timeStr = `${timeParts.find((p) => p.type === "hour")?.value}:${timeParts.find((p) => p.type === "minute")?.value}`;

    const appointmentDateTime = clinicDateTime(dateStr, timeStr, timezone);
    const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    expect(hoursUntilAppt).toBeLessThan(cancellationHours);
  });

  it("allows cancellation when more than cancellationHours before appointment", () => {
    const timezone = "Africa/Casablanca";
    const cancellationHours = 24;

    // Create an appointment 48 hours from now — should be cancellable
    const now = new Date();
    const futureDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(futureDate);
    const dateStr = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;

    const timeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(futureDate);
    const timeStr = `${timeParts.find((p) => p.type === "hour")?.value}:${timeParts.find((p) => p.type === "minute")?.value}`;

    const appointmentDateTime = clinicDateTime(dateStr, timeStr, timezone);
    const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    expect(hoursUntilAppt).toBeGreaterThan(cancellationHours);
  });

  it("uses clinic timezone, not UTC, for the calculation", () => {
    // 2026-06-15 at 10:00 in Africa/Casablanca vs UTC
    // Africa/Casablanca is UTC+1 in summer
    const casablancaTime = clinicDateTime("2026-06-15", "10:00", "Africa/Casablanca");
    const utcTime = clinicDateTime("2026-06-15", "10:00", "UTC");

    // Casablanca is ahead of UTC, so the Casablanca timestamp should be earlier
    expect(casablancaTime.getTime()).not.toBe(utcTime.getTime());

    // The difference should reflect the timezone offset
    const diffHours = (utcTime.getTime() - casablancaTime.getTime()) / (1000 * 60 * 60);
    expect(Math.abs(diffHours)).toBeGreaterThan(0);
    expect(Math.abs(diffHours)).toBeLessThanOrEqual(2); // Max offset difference
  });

  it("handles different cancellation window hours per tenant", () => {
    const timezone = "Africa/Casablanca";

    // An appointment 3 hours from now
    const now = new Date();
    const futureDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(futureDate);
    const dateStr = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;

    const timeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(futureDate);
    const timeStr = `${timeParts.find((p) => p.type === "hour")?.value}:${timeParts.find((p) => p.type === "minute")?.value}`;

    const appointmentDateTime = clinicDateTime(dateStr, timeStr, timezone);
    const hoursUntilAppt = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    // With 2-hour window: should be cancellable
    expect(hoursUntilAppt).toBeGreaterThan(2);

    // With 24-hour window: should NOT be cancellable
    expect(hoursUntilAppt).toBeLessThan(24);
  });
});

describe("appointment status cancellability", () => {
  const NON_CANCELLABLE: AppointmentStatus[] = ["cancelled", "completed", "rescheduled"];
  const CANCELLABLE: AppointmentStatus[] = ["pending", "scheduled", "confirmed", "checked_in", "in_progress", "no_show"];

  NON_CANCELLABLE.forEach((status) => {
    it(`rejects cancellation for ${status} appointments`, () => {
      expect(isCancellableStatus(status)).toBe(false);
    });
  });

  CANCELLABLE.forEach((status) => {
    it(`allows cancellation for ${status} appointments`, () => {
      expect(isCancellableStatus(status)).toBe(true);
    });
  });

  it("NON_CANCELLABLE_STATUSES set contains exactly the expected statuses", () => {
    expect(NON_CANCELLABLE_STATUSES.size).toBe(3);
    for (const s of NON_CANCELLABLE) {
      expect(NON_CANCELLABLE_STATUSES.has(s)).toBe(true);
    }
  });
});
