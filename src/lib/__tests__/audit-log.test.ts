import { describe, it, expect, vi } from "vitest";
import { logAuditEvent } from "../audit-log";

describe("logAuditEvent", () => {
  it("inserts an audit log entry", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    };

    await logAuditEvent({
      supabase: mockSupabase as never,
      action: "appointment_created",
      type: "booking",
      clinicId: "clinic-123",
      actor: "user-456",
      clinicName: "Dr. Ahmed Clinic",
      description: "New appointment booked",
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("activity_logs");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "appointment_created",
        type: "booking",
        clinic_id: "clinic-123",
        actor: "user-456",
        clinic_name: "Dr. Ahmed Clinic",
        description: "New appointment booked",
        timestamp: expect.any(String),
      }),
    );
  });

  it("defaults actor and clinicName to null", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    };

    await logAuditEvent({
      supabase: mockSupabase as never,
      action: "patient_updated",
      type: "patient",
      clinicId: "clinic-123",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: null,
        clinic_name: null,
        description: null,
      }),
    );
  });

  it("does not throw on database error", async () => {
    const mockInsert = vi.fn().mockRejectedValue(new Error("DB connection failed"));
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    };

    // Should not throw
    await expect(
      logAuditEvent({
        supabase: mockSupabase as never,
        action: "test_action",
        type: "admin",
        clinicId: "clinic-123",
      }),
    ).resolves.toBeUndefined();
  });

  it("uses ISO timestamp format", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    };

    await logAuditEvent({
      supabase: mockSupabase as never,
      action: "test",
      type: "payment",
      clinicId: "clinic-1",
    });

    const insertArg = mockInsert.mock.calls[0][0];
    // ISO 8601 format check
    expect(insertArg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
