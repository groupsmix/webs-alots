import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getLocalDateStr } from "@/lib/utils";

describe("getLocalDateStr", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats a UTC timestamp to the Casablanca calendar date", () => {
    vi.setSystemTime(new Date("2026-07-11T00:30:00Z"));
    expect(getLocalDateStr()).toBe("2026-07-11");
    expect(getLocalDateStr(new Date("2026-07-10T23:05:00Z"))).toBe("2026-07-11");
  });

  it("returns tomorrow's local date when passed a date +1 day", () => {
    vi.setSystemTime(new Date("2026-07-11T12:00:00Z"));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getLocalDateStr(tomorrow)).toBe("2026-07-12");
  });

  it("returns an empty string for invalid dates", () => {
    expect(getLocalDateStr(new Date("invalid"))).toBe("");
  });
});
