import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the logger's PII redaction by capturing console.error output
// (the logger emits JSON to stderr via console.error).

describe("logger PII redaction (A8-01)", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logger: any;

  beforeEach(async () => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Dynamic import so the spy is active before the module loads
    const mod = await import("../logger");
    logger = mod.logger;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("redacts keys matching PII patterns (email, phone, name, etc.)", () => {
    logger.info("test", {
      context: "unit-test",
      email: "doctor@clinic.ma",
      phone: "+212600000000",
      full_name: "Dr. House",
      doctor_name: "Dr. Watson",
      clinic_name: "Clinique ABC",
      patient_name: "Jane Doe",
      address: "123 Rue de Fes",
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(consoleSpy.mock.calls[0][0] as string);

    expect(payload.email).toBe("[REDACTED]");
    expect(payload.phone).toBe("[REDACTED]");
    expect(payload.full_name).toBe("[REDACTED]");
    expect(payload.doctor_name).toBe("[REDACTED]");
    expect(payload.clinic_name).toBe("[REDACTED]");
    expect(payload.patient_name).toBe("[REDACTED]");
    expect(payload.address).toBe("[REDACTED]");
    // Non-PII fields should pass through unchanged
    expect(payload.context).toBe("unit-test");
    expect(payload.level).toBe("info");
  });

  it("passes through non-PII keys unchanged", () => {
    logger.info("test", {
      context: "unit-test",
      clinicId: "uuid-1234",
      ip: "1.2.3.4",
      verificationMethod: "dns",
    });

    const payload = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(payload.clinicId).toBe("uuid-1234");
    expect(payload.ip).toBe("1.2.3.4");
    expect(payload.verificationMethod).toBe("dns");
  });
});
