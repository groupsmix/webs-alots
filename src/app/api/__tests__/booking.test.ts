import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the booking API routes.
 *
 * Tests validation schemas and booking business logic
 * by mocking the Supabase client.
 */

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

describe("Booking API — cancel validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid cancellation payload", async () => {
    const { bookingCancelSchema } = await import("@/lib/validations");
    const result = bookingCancelSchema.safeParse({
      appointmentId: "appt-123",
      reason: "Cannot make it",
    });
    expect(result.success).toBe(true);
  });

  it("rejects cancellation without appointmentId", async () => {
    const { bookingCancelSchema } = await import("@/lib/validations");
    const result = bookingCancelSchema.safeParse({
      reason: "Cannot make it",
    });
    expect(result.success).toBe(false);
  });

  it("accepts cancellation without reason (optional)", async () => {
    const { bookingCancelSchema } = await import("@/lib/validations");
    const result = bookingCancelSchema.safeParse({
      appointmentId: "appt-456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects reason exceeding 1000 chars", async () => {
    const { bookingCancelSchema } = await import("@/lib/validations");
    const result = bookingCancelSchema.safeParse({
      appointmentId: "appt-789",
      reason: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe("Booking API — reschedule validation", () => {
  it("accepts valid reschedule payload", async () => {
    const { rescheduleSchema } = await import("@/lib/validations");
    const result = rescheduleSchema.safeParse({
      appointmentId: "appt-123",
      newDate: "2026-04-15",
      newTime: "14:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", async () => {
    const { rescheduleSchema } = await import("@/lib/validations");
    const result = rescheduleSchema.safeParse({
      appointmentId: "appt-123",
      newDate: "15-04-2026",
      newTime: "14:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format", async () => {
    const { rescheduleSchema } = await import("@/lib/validations");
    const result = rescheduleSchema.safeParse({
      appointmentId: "appt-123",
      newDate: "2026-04-15",
      newTime: "2:00PM",
    });
    expect(result.success).toBe(false);
  });
});

describe("Booking API — emergency slot validation", () => {
  it("accepts valid emergency slot creation", async () => {
    const { emergencySlotSchema } = await import("@/lib/validations");
    const result = emergencySlotSchema.safeParse({
      action: "create",
      doctorId: "doc-1",
      date: "2026-04-15",
      startTime: "09:00",
      durationMin: 30,
    });
    expect(result.success).toBe(true);
  });

  it("rejects emergency slot with invalid duration", async () => {
    const { emergencySlotSchema } = await import("@/lib/validations");
    const result = emergencySlotSchema.safeParse({
      action: "create",
      doctorId: "doc-1",
      date: "2026-04-15",
      startTime: "09:00",
      durationMin: 500,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid emergency slot booking", async () => {
    const { emergencySlotSchema } = await import("@/lib/validations");
    const result = emergencySlotSchema.safeParse({
      action: "book",
      slotId: "slot-1",
      patientId: "patient-1",
      patientName: "Karim",
    });
    expect(result.success).toBe(true);
  });
});

describe("Booking API — recurring appointment validation", () => {
  it("accepts valid recurring creation", async () => {
    const { recurringSchema } = await import("@/lib/validations");
    const result = recurringSchema.safeParse({
      action: "create",
      patientId: "patient-1",
      patientName: "Karim",
      doctorId: "doc-1",
      date: "2026-04-15",
      time: "10:00",
      pattern: "weekly",
      occurrences: 8,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid pattern", async () => {
    const { recurringSchema } = await import("@/lib/validations");
    const result = recurringSchema.safeParse({
      action: "create",
      patientId: "patient-1",
      patientName: "Karim",
      doctorId: "doc-1",
      date: "2026-04-15",
      time: "10:00",
      pattern: "daily",
      occurrences: 8,
    });
    expect(result.success).toBe(false);
  });

  it("rejects too many occurrences (max 52)", async () => {
    const { recurringSchema } = await import("@/lib/validations");
    const result = recurringSchema.safeParse({
      action: "create",
      patientId: "patient-1",
      patientName: "Karim",
      doctorId: "doc-1",
      date: "2026-04-15",
      time: "10:00",
      pattern: "weekly",
      occurrences: 100,
    });
    expect(result.success).toBe(false);
  });
});
