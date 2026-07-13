/**
 * Tests for the demo-tenant mutation guard and its QA/pilot escape hatch.
 *
 * The demo tenant is read-only by default: destructive requests are blocked.
 * Setting `DEMO_ALLOW_MUTATIONS=true` (QA/pilot only) permits them. Any other
 * value keeps the secure default.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldBlockDemoRequest } from "@/lib/demo";

const DEMO_CLINIC_ID = "c0000000-de00-0000-0000-000000000001";
const OTHER_CLINIC_ID = "a1111111-0000-0000-0000-000000000001";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shouldBlockDemoRequest", () => {
  it("blocks destructive requests on the demo tenant by default", () => {
    expect(shouldBlockDemoRequest("POST", "/api/receptionist/patients", DEMO_CLINIC_ID)).toBe(true);
    expect(shouldBlockDemoRequest("PUT", "/api/branding", DEMO_CLINIC_ID)).toBe(true);
    expect(shouldBlockDemoRequest("DELETE", "/api/appointments/1", DEMO_CLINIC_ID)).toBe(true);
  });

  it("never blocks non-destructive (GET) requests", () => {
    expect(shouldBlockDemoRequest("GET", "/api/branding", DEMO_CLINIC_ID)).toBe(false);
  });

  it("never blocks requests on a non-demo tenant", () => {
    expect(shouldBlockDemoRequest("POST", "/api/receptionist/patients", OTHER_CLINIC_ID)).toBe(
      false,
    );
    expect(shouldBlockDemoRequest("POST", "/api/receptionist/patients", null)).toBe(false);
  });

  it("keeps allowlisted paths (auth, webhooks, cron) open on the demo tenant", () => {
    expect(shouldBlockDemoRequest("POST", "/api/auth/login", DEMO_CLINIC_ID)).toBe(false);
    expect(shouldBlockDemoRequest("POST", "/api/webhooks/whatsapp", DEMO_CLINIC_ID)).toBe(false);
    expect(shouldBlockDemoRequest("POST", "/api/cron/reminders", DEMO_CLINIC_ID)).toBe(false);
  });

  it("allows demo mutations when DEMO_ALLOW_MUTATIONS=true", () => {
    vi.stubEnv("DEMO_ALLOW_MUTATIONS", "true");
    expect(shouldBlockDemoRequest("POST", "/api/receptionist/patients", DEMO_CLINIC_ID)).toBe(
      false,
    );
    expect(shouldBlockDemoRequest("PUT", "/api/branding", DEMO_CLINIC_ID)).toBe(false);
  });

  it("keeps the secure default for any value other than the exact string 'true'", () => {
    for (const value of ["false", "1", "TRUE", "yes", ""]) {
      vi.stubEnv("DEMO_ALLOW_MUTATIONS", value);
      expect(shouldBlockDemoRequest("POST", "/api/receptionist/patients", DEMO_CLINIC_ID)).toBe(
        true,
      );
    }
  });
});
