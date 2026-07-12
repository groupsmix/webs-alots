import { describe, it, expect } from "vitest";
import { DEFAULT_FEATURES, mergeFeaturesConfig } from "@/lib/features";

describe("mergeFeaturesConfig", () => {
  it("returns Lane-A defaults when persisted config is null", () => {
    const config = mergeFeaturesConfig(null);
    expect(config.appointments).toBe(true);
    expect(config.website).toBe(true);
    expect(config.installments).toBe(true);
    expect(config.prescriptions).toBe(false);
    expect(config.radiology_reports).toBe(false);
    expect(config.ai_triage).toBe(false);
  });

  it("returns Lane-A defaults when persisted config is empty", () => {
    const config = mergeFeaturesConfig({});
    expect(config.appointments).toBe(true);
    expect(config.public_catalog).toBe(false);
  });

  it("allows persisted values to override defaults", () => {
    const config = mergeFeaturesConfig({ appointments: false });
    expect(config.appointments).toBe(false);
    expect(config.website).toBe(true);
  });

  it("does not mutate the original DEFAULT_FEATURES object", () => {
    const config = mergeFeaturesConfig({ appointments: false });
    expect(DEFAULT_FEATURES.appointments).toBe(true);
    expect(config).not.toBe(DEFAULT_FEATURES);
  });
});
