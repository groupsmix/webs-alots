import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "@/lib/logger";
import {
  isValidClinicId,
  logTenantContext,
  setTenantContext,
  TenantContextPermissionError,
} from "@/lib/tenant-context";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const VALID_CLINIC_ID = "c0000000-de00-0000-0000-000000000001";

function createMockSupabase(rpcResult: { error?: { message: string } | null } = { error: null }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as Parameters<typeof setTenantContext>[0];
}

describe("isValidClinicId", () => {
  it("accepts a valid UUID", () => {
    expect(isValidClinicId(VALID_CLINIC_ID)).toBe(true);
  });

  it("rejects an invalid string", () => {
    expect(isValidClinicId("not-a-uuid")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidClinicId("")).toBe(false);
  });
});

describe("setTenantContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when clinicId is empty", async () => {
    const supabase = createMockSupabase();
    await expect(setTenantContext(supabase, "")).rejects.toThrow(
      "Tenant context error: clinic_id is required but was empty",
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("throws when clinicId is invalid", async () => {
    const supabase = createMockSupabase();
    await expect(setTenantContext(supabase, "bad-id")).rejects.toThrow(
      "Tenant context error: invalid clinic_id format: bad-id",
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("sets the tenant context on success", async () => {
    const supabase = createMockSupabase({ error: null });
    await setTenantContext(supabase, VALID_CLINIC_ID);
    expect(supabase.rpc).toHaveBeenCalledWith("set_tenant_context", {
      p_clinic_id: VALID_CLINIC_ID,
    });
  });

  it("throws TenantContextPermissionError on permission denied", async () => {
    const supabase = createMockSupabase({
      error: { message: "permission denied for function set_tenant_context" },
    });
    await expect(setTenantContext(supabase, VALID_CLINIC_ID)).rejects.toBeInstanceOf(
      TenantContextPermissionError,
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "Failed to set tenant context",
      expect.objectContaining({ context: "tenant-context", clinicId: VALID_CLINIC_ID }),
    );
  });

  it("throws a generic error for other RPC failures", async () => {
    const supabase = createMockSupabase({
      error: { message: "connection lost" },
    });
    await expect(setTenantContext(supabase, VALID_CLINIC_ID)).rejects.toThrow(
      "Tenant context error: failed to set app.current_clinic_id: connection lost",
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to set tenant context",
      expect.objectContaining({ context: "tenant-context", clinicId: VALID_CLINIC_ID }),
    );
  });
});

describe("logTenantContext", () => {
  it("logs the resolved clinic id", () => {
    logTenantContext(VALID_CLINIC_ID, "test-context", { extra: "value" });
    expect(logger.info).toHaveBeenCalledWith("Tenant context resolved", {
      context: "test-context",
      clinicId: VALID_CLINIC_ID,
      extra: "value",
    });
  });

  it("logs 'none' when clinic id is missing", () => {
    logTenantContext(null, "test-context");
    expect(logger.info).toHaveBeenCalledWith("Tenant context resolved", {
      context: "test-context",
      clinicId: "none",
    });
  });
});
