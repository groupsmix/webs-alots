import { describe, it, expect, vi } from "vitest";
import { logAuditEvent, logAuthEvent, logSecurityEvent } from "../audit-log";

function createMockSupabase(insertResult: { error: unknown } = { error: null }) {
  const mockInsert = vi.fn().mockResolvedValue(insertResult);
  return {
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
    _insert: mockInsert,
  };
}

describe("logAuditEvent — enhanced fields", () => {
  it("includes ip_address when provided", async () => {
    const mock = createMockSupabase();
    await logAuditEvent({
      supabase: mock as never,
      action: "login.success",
      type: "auth",
      clinicId: "clinic-1",
      actor: "user@example.com",
      ipAddress: "203.0.113.42",
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: "203.0.113.42",
      }),
    );
  });

  it("includes user_agent when provided", async () => {
    const mock = createMockSupabase();
    await logAuditEvent({
      supabase: mock as never,
      action: "login.success",
      type: "auth",
      clinicId: "clinic-1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_agent: "Mozilla/5.0 (Windows NT 10.0)",
      }),
    );
  });

  it("includes metadata as structured object", async () => {
    const mock = createMockSupabase();
    await logAuditEvent({
      supabase: mock as never,
      action: "role.changed",
      type: "security",
      clinicId: "clinic-1",
      metadata: { oldRole: "patient", newRole: "doctor", changedBy: "admin-1" },
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { oldRole: "patient", newRole: "doctor", changedBy: "admin-1" },
      }),
    );
  });

  it("defaults ip_address, user_agent, metadata to null when not provided", async () => {
    const mock = createMockSupabase();
    await logAuditEvent({
      supabase: mock as never,
      action: "test",
      type: "admin",
      clinicId: "clinic-1",
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: null,
        user_agent: null,
        metadata: null,
      }),
    );
  });

  it("supports all new event types", async () => {
    const types = ["auth", "config", "security"] as const;
    for (const type of types) {
      const mock = createMockSupabase();
      await logAuditEvent({
        supabase: mock as never,
        action: `test.${type}`,
        type,
        clinicId: "clinic-1",
      });
      expect(mock._insert).toHaveBeenCalledWith(
        expect.objectContaining({ type }),
      );
    }
  });

  it("does not throw when insert rejects", async () => {
    const mockInsert = vi.fn().mockRejectedValue(new Error("connection lost"));
    const mock = {
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    };

    await expect(
      logAuditEvent({
        supabase: mock as never,
        action: "test",
        type: "auth",
        clinicId: "clinic-1",
        ipAddress: "1.2.3.4",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("logAuthEvent", () => {
  it("sets type to 'auth' and includes success metadata", async () => {
    const mock = createMockSupabase();
    await logAuthEvent({
      supabase: mock as never,
      action: "login.success",
      actor: "user@test.com",
      clinicId: "clinic-1",
      ipAddress: "10.0.0.1",
      success: true,
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "auth",
        action: "login.success",
        actor: "user@test.com",
        clinic_id: "clinic-1",
        ip_address: "10.0.0.1",
        metadata: { success: true },
      }),
    );
  });

  it("defaults clinicId to 'system' when not provided", async () => {
    const mock = createMockSupabase();
    await logAuthEvent({
      supabase: mock as never,
      action: "login.failed",
      actor: "unknown@test.com",
      success: false,
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: "system",
        metadata: { success: false },
      }),
    );
  });

  it("defaults success to true when not provided", async () => {
    const mock = createMockSupabase();
    await logAuthEvent({
      supabase: mock as never,
      action: "logout",
      actor: "user@test.com",
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { success: true },
      }),
    );
  });

  it("includes user agent when provided", async () => {
    const mock = createMockSupabase();
    await logAuthEvent({
      supabase: mock as never,
      action: "login.success",
      actor: "user@test.com",
      userAgent: "TestBrowser/1.0",
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_agent: "TestBrowser/1.0",
      }),
    );
  });
});

describe("logSecurityEvent", () => {
  it("sets type to 'security' and includes metadata", async () => {
    const mock = createMockSupabase();
    await logSecurityEvent({
      supabase: mock as never,
      action: "impersonate.start",
      actor: "admin@test.com",
      clinicId: "clinic-target",
      clinicName: "Target Clinic",
      description: "Admin started impersonation",
      ipAddress: "192.168.1.1",
      metadata: { reason: "debugging", targetClinicId: "clinic-target" },
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "security",
        action: "impersonate.start",
        actor: "admin@test.com",
        clinic_id: "clinic-target",
        clinic_name: "Target Clinic",
        description: "Admin started impersonation",
        ip_address: "192.168.1.1",
        metadata: { reason: "debugging", targetClinicId: "clinic-target" },
      }),
    );
  });

  it("works without optional fields", async () => {
    const mock = createMockSupabase();
    await logSecurityEvent({
      supabase: mock as never,
      action: "impersonate.end",
      actor: "admin@test.com",
      clinicId: "system",
    });

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "security",
        action: "impersonate.end",
        actor: "admin@test.com",
        clinic_id: "system",
        ip_address: null,
        user_agent: null,
        metadata: null,
      }),
    );
  });
});
