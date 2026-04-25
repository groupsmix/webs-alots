import { describe, it, expect } from "vitest";
import { clinicDateTime } from "../timezone";

describe("clinicDateTime", () => {
  it("creates a Date for Africa/Casablanca timezone by default", () => {
    const dt = clinicDateTime("2026-06-15", "10:00", "Africa/Casablanca");
    // The resulting Date should represent 10:00 in Africa/Casablanca
    // We verify by formatting back to the timezone and checking
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Casablanca",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(dt);
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    expect(hour).toBe("10");
    expect(minute).toBe("00");
  });

  it("accepts an explicit timezone parameter", () => {
    const dt = clinicDateTime("2026-06-15", "14:30", "Europe/Paris");
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(dt);
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    expect(hour).toBe("14");
    expect(minute).toBe("30");
  });

  it("handles midnight correctly", () => {
    const dt = clinicDateTime("2026-01-15", "00:00", "Africa/Casablanca");
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Casablanca",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(dt);
    const hour = parts.find((p) => p.type === "hour")?.value;
    expect(hour).toBe("00");
  });

  it("handles end of day (23:59)", () => {
    const dt = clinicDateTime("2026-01-15", "23:59", "Africa/Casablanca");
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Casablanca",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(dt);
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    expect(hour).toBe("23");
    expect(minute).toBe("59");
  });

  it("preserves the correct date (no date drift)", () => {
    const dt = clinicDateTime("2026-03-15", "09:00", "Africa/Casablanca");
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Casablanca",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(dt);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    expect(year).toBe("2026");
    expect(month).toBe("03");
    expect(day).toBe("15");
  });

  it("returns a valid Date object", () => {
    const dt = clinicDateTime("2026-06-15", "10:00", "Africa/Casablanca");
    expect(dt).toBeInstanceOf(Date);
    expect(isNaN(dt.getTime())).toBe(false);
  });

  it("produces different UTC timestamps for different timezones with same local time", () => {
    const casablanca = clinicDateTime("2026-06-15", "10:00", "Africa/Casablanca");
    const paris = clinicDateTime("2026-06-15", "10:00", "Europe/Paris");
    // 10:00 in Paris is earlier in UTC than 10:00 in Casablanca (Paris is UTC+2 in summer, Casablanca is UTC+1)
    // So Paris 10:00 = UTC 08:00, Casablanca 10:00 = UTC 09:00
    expect(paris.getTime()).not.toBe(casablanca.getTime());
  });

  it("handles a date far in the future", () => {
    const dt = clinicDateTime("2030-12-31", "15:00", "Africa/Casablanca");
    expect(dt).toBeInstanceOf(Date);
    expect(isNaN(dt.getTime())).toBe(false);
  });
});
