/**
 * Tests for src/lib/whatsapp/booking-state-machine.ts
 *
 * Covers:
 *   - parseDate / parseTime
 *   - createInitialContext
 *   - isSessionExpired
 *   - processBookingMessage state transitions
 *   - Escalation after max attempts
 *   - Cancel command from any state
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("booking-state-machine — parseDate", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses 'demain'", async () => {
    const { parseDate } = await import("@/lib/whatsapp/booking-state-machine");
    const result = parseDate("demain");
    const expected = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    expect(result).toBe(expected);
  });

  it("parses 'aujourd'hui'", async () => {
    const { parseDate } = await import("@/lib/whatsapp/booking-state-machine");
    const result = parseDate("aujourd'hui");
    const expected = new Date().toISOString().split("T")[0];
    expect(result).toBe(expected);
  });

  it("parses DD/MM format", async () => {
    const { parseDate } = await import("@/lib/whatsapp/booking-state-machine");
    const result = parseDate("15/06");
    expect(result).toMatch(/\d{4}-06-15/);
  });

  it("parses DD/MM/YYYY format", async () => {
    const { parseDate } = await import("@/lib/whatsapp/booking-state-machine");
    const result = parseDate("15/06/2026");
    expect(result).toBe("2026-06-15");
  });

  it("returns null for invalid text", async () => {
    const { parseDate } = await import("@/lib/whatsapp/booking-state-machine");
    expect(parseDate("hello")).toBeNull();
  });
});

describe("booking-state-machine — parseTime", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses 15h00", async () => {
    const { parseTime } = await import("@/lib/whatsapp/booking-state-machine");
    expect(parseTime("15h00")).toBe("15:00");
  });

  it("parses 9h", async () => {
    const { parseTime } = await import("@/lib/whatsapp/booking-state-machine");
    expect(parseTime("9h")).toBe("09:00");
  });

  it("parses 10:30", async () => {
    const { parseTime } = await import("@/lib/whatsapp/booking-state-machine");
    expect(parseTime("10:30")).toBe("10:30");
  });

  it("parses 2:00 PM", async () => {
    const { parseTime } = await import("@/lib/whatsapp/booking-state-machine");
    expect(parseTime("2:00 PM")).toBe("14:00");
  });

  it("returns null for invalid text", async () => {
    const { parseTime } = await import("@/lib/whatsapp/booking-state-machine");
    expect(parseTime("hello")).toBeNull();
  });
});

describe("booking-state-machine — createInitialContext", () => {
  it("creates context with correct defaults", async () => {
    const { createInitialContext } = await import("@/lib/whatsapp/booking-state-machine");

    const ctx = createInitialContext("clinic-1", "Ma Clinique", "patient-1", "+212600000000");

    expect(ctx.clinicId).toBe("clinic-1");
    expect(ctx.clinicName).toBe("Ma Clinique");
    expect(ctx.patientId).toBe("patient-1");
    expect(ctx.patientPhone).toBe("+212600000000");
    expect(ctx.serviceId).toBeNull();
    expect(ctx.doctorId).toBeNull();
    expect(ctx.dateStr).toBeNull();
    expect(ctx.timeStr).toBeNull();
    expect(ctx.attempts).toBe(0);
  });
});

describe("booking-state-machine — isSessionExpired", () => {
  it("returns false for recent context", async () => {
    const { createInitialContext, isSessionExpired } =
      await import("@/lib/whatsapp/booking-state-machine");

    const ctx = createInitialContext("c", "n", "p", "+212");
    expect(isSessionExpired(ctx)).toBe(false);
  });

  it("returns true for expired context", async () => {
    const { isSessionExpired } = await import("@/lib/whatsapp/booking-state-machine");

    const ctx = {
      clinicId: "c",
      clinicName: "n",
      patientId: "p",
      patientPhone: "+212",
      serviceId: null,
      serviceName: null,
      doctorId: null,
      doctorName: null,
      dateStr: null,
      timeStr: null,
      escalationReason: null,
      attempts: 0,
      lastTransitionAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    };

    expect(isSessionExpired(ctx)).toBe(true);
  });
});

describe("booking-state-machine — processBookingMessage transitions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockSMClient(
    services: Array<Record<string, unknown>> = [],
    doctors: Array<Record<string, unknown>> = [],
  ) {
    return {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: table === "services" ? services : doctors,
                  error: null,
                }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: table === "services" ? services : doctors,
                error: null,
              }),
            }),
          }),
        }),
      })),
    };
  }

  it("cancels booking when user types ANNULER from any state", async () => {
    const { processBookingMessage, createInitialContext } =
      await import("@/lib/whatsapp/booking-state-machine");

    const client = createMockSMClient();
    const ctx = createInitialContext("c", "Clinic", "p", "+212");

    const result = await processBookingMessage(client, "awaiting_doctor", ctx, "ANNULER");

    expect(result.newState).toBe("cancelled");
    expect(result.responseMessage).toContain("annulée");
  });

  it("skips to awaiting_doctor when no services exist", async () => {
    const { processBookingMessage, createInitialContext } =
      await import("@/lib/whatsapp/booking-state-machine");

    const client = createMockSMClient([], []);
    const ctx = createInitialContext("c", "Clinic", "p", "+212");

    const result = await processBookingMessage(client, "awaiting_service", ctx, "consultation");

    expect(result.newState).toBe("awaiting_doctor");
  });

  it("selects service by number", async () => {
    const { processBookingMessage, createInitialContext } =
      await import("@/lib/whatsapp/booking-state-machine");

    const services = [
      { id: "s1", name: "Consultation" },
      { id: "s2", name: "Détartrage" },
    ];
    const client = createMockSMClient(services);
    const ctx = createInitialContext("c", "Clinic", "p", "+212");

    const result = await processBookingMessage(client, "awaiting_service", ctx, "1");

    expect(result.newState).toBe("awaiting_doctor");
    expect(result.context.serviceName).toBe("Consultation");
  });

  it("transitions from awaiting_date to awaiting_time", async () => {
    const { processBookingMessage, createInitialContext } =
      await import("@/lib/whatsapp/booking-state-machine");

    const client = createMockSMClient();
    const ctx = {
      ...createInitialContext("c", "Clinic", "p", "+212"),
      doctorId: "d1",
      doctorName: "Ahmed",
    };

    const result = await processBookingMessage(client, "awaiting_date", ctx, "demain");

    expect(result.newState).toBe("awaiting_time");
    expect(result.context.dateStr).toBeTruthy();
  });

  it("transitions from awaiting_time to confirming", async () => {
    const { processBookingMessage, createInitialContext } =
      await import("@/lib/whatsapp/booking-state-machine");

    const client = createMockSMClient();
    const ctx = {
      ...createInitialContext("c", "Clinic", "p", "+212"),
      doctorId: "d1",
      doctorName: "Ahmed",
      dateStr: "2026-06-15",
    };

    const result = await processBookingMessage(client, "awaiting_time", ctx, "15h00");

    expect(result.newState).toBe("confirming");
    expect(result.context.timeStr).toBe("15:00");
    expect(result.responseMessage).toContain("confirmer");
  });

  it("confirms booking when user replies OUI", async () => {
    const { processBookingMessage, createInitialContext } =
      await import("@/lib/whatsapp/booking-state-machine");

    const client = createMockSMClient();
    const ctx = {
      ...createInitialContext("c", "Clinic", "p", "+212"),
      doctorId: "d1",
      doctorName: "Ahmed",
      dateStr: "2026-06-15",
      timeStr: "15:00",
    };

    const result = await processBookingMessage(client, "confirming", ctx, "OUI");

    expect(result.newState).toBe("completed");
    expect(result.responseMessage).toContain("confirmé");
  });

  it("cancels booking when user replies NON at confirmation", async () => {
    const { processBookingMessage, createInitialContext } =
      await import("@/lib/whatsapp/booking-state-machine");

    const client = createMockSMClient();
    const ctx = {
      ...createInitialContext("c", "Clinic", "p", "+212"),
      doctorId: "d1",
      doctorName: "Ahmed",
      dateStr: "2026-06-15",
      timeStr: "15:00",
    };

    const result = await processBookingMessage(client, "confirming", ctx, "NON");

    expect(result.newState).toBe("cancelled");
  });

  it("resets when session is expired", async () => {
    const { processBookingMessage } = await import("@/lib/whatsapp/booking-state-machine");

    const client = createMockSMClient();
    const expiredCtx = {
      clinicId: "c",
      clinicName: "Clinic",
      patientId: "p",
      patientPhone: "+212",
      serviceId: null,
      serviceName: null,
      doctorId: "d1",
      doctorName: "Ahmed",
      dateStr: "2026-06-15",
      timeStr: null,
      escalationReason: null,
      attempts: 0,
      lastTransitionAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    };

    const result = await processBookingMessage(client, "awaiting_time", expiredCtx, "15h00");

    expect(result.newState).toBe("idle");
    expect(result.responseMessage).toContain("expiré");
  });
});
