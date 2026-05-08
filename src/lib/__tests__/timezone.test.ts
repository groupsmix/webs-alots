import { describe, it, expect } from "vitest";
import { computeEndTime } from "../timezone";

describe("computeEndTime", () => {
  it("calculates end time for a 30-minute appointment", () => {
    const result = computeEndTime("09:00", 30);
    expect(result.endTime).toBe("09:30");
    expect(result.overflows).toBe(false);
  });

  it("calculates end time for a 60-minute appointment", () => {
    const result = computeEndTime("14:00", 60);
    expect(result.endTime).toBe("15:00");
    expect(result.overflows).toBe(false);
  });

  it("calculates end time crossing the hour boundary", () => {
    const result = computeEndTime("09:45", 30);
    expect(result.endTime).toBe("10:15");
    expect(result.overflows).toBe(false);
  });

  it("clamps to 23:59 when overflowing past midnight", () => {
    const result = computeEndTime("23:30", 60);
    expect(result.endTime).toBe("23:59");
    expect(result.overflows).toBe(true);
  });

  it("handles exactly midnight overflow", () => {
    const result = computeEndTime("23:00", 60);
    expect(result.endTime).toBe("23:59");
    expect(result.overflows).toBe(true);
  });

  it("does not overflow at 23:59", () => {
    const result = computeEndTime("23:00", 59);
    expect(result.endTime).toBe("23:59");
    expect(result.overflows).toBe(false);
  });

  it("handles 0-minute duration", () => {
    const result = computeEndTime("10:00", 0);
    expect(result.endTime).toBe("10:00");
    expect(result.overflows).toBe(false);
  });

  it("handles appointment starting at 00:00", () => {
    const result = computeEndTime("00:00", 90);
    expect(result.endTime).toBe("01:30");
    expect(result.overflows).toBe(false);
  });

  it("pads single-digit hours and minutes", () => {
    const result = computeEndTime("08:05", 3);
    expect(result.endTime).toBe("08:08");
  });

  it("handles large duration within day", () => {
    const result = computeEndTime("06:00", 720); // 12 hours
    expect(result.endTime).toBe("18:00");
    expect(result.overflows).toBe(false);
  });

  it("handles large duration exceeding day", () => {
    const result = computeEndTime("12:00", 800);
    expect(result.endTime).toBe("23:59");
    expect(result.overflows).toBe(true);
  });
});
