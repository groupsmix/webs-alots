import { describe, it, expect } from "vitest";
import type { VitalsEventType, VitalsUpdatePayload } from "@/modules/vitals/stream";

describe("vitals stream types", () => {
  it("VitalsEventType covers expected event types", () => {
    const events: VitalsEventType[] = ["vitals_update", "heartbeat", "error", "connected"];
    expect(events).toHaveLength(4);
  });

  it("VitalsUpdatePayload has required shape", () => {
    const payload: VitalsUpdatePayload = {
      id: "v-001",
      patient_id: "p-001",
      systolic: 120,
      diastolic: 80,
      heart_rate: 72,
      temperature: 36.6,
      weight: 70.0,
      oxygen_saturation: 98,
      recorded_at: "2024-01-15T10:00:00Z",
      recorded_by: "dr-001",
    };
    expect(payload.id).toBe("v-001");
    expect(payload.patient_id).toBe("p-001");
    expect(payload.recorded_at).toBeDefined();
  });

  it("VitalsUpdatePayload allows null optional fields", () => {
    const payload: VitalsUpdatePayload = {
      id: "v-002",
      patient_id: "p-002",
      systolic: null,
      diastolic: null,
      heart_rate: null,
      temperature: null,
      weight: null,
      oxygen_saturation: null,
      recorded_at: "2024-01-15T11:00:00Z",
      recorded_by: null,
    };
    expect(payload.systolic).toBeNull();
    expect(payload.recorded_by).toBeNull();
  });
});
