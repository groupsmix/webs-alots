import { headers } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTenantClient } from "@/lib/supabase-server";
import { requireTenant, getClinicConfig } from "../tenant";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createTenantClient: vi.fn(),
}));

function createMockHeaders(values: Record<string, string> = {}) {
  return {
    get: vi.fn((name: string) => values[name] ?? null),
  };
}

describe("requireTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when no clinic ID header is present", async () => {
    vi.mocked(headers).mockResolvedValue(createMockHeaders({}) as never);

    await expect(requireTenant()).rejects.toThrow(
      "Tenant context is required but was not resolved",
    );
  });

  it("returns tenant info when clinic ID header is present", async () => {
    vi.mocked(headers).mockResolvedValue(
      createMockHeaders({
        "x-tenant-clinic-id": "clinic-abc",
        "x-tenant-clinic-name": "Test Clinic",
        "x-tenant-subdomain": "test",
        "x-tenant-clinic-type": "doctor",
        "x-tenant-clinic-tier": "pro",
      }) as never,
    );

    const tenant = await requireTenant();
    expect(tenant.clinicId).toBe("clinic-abc");
    expect(tenant.clinicName).toBe("Test Clinic");
    expect(tenant.subdomain).toBe("test");
  });
});

describe("getClinicConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when DB config is empty", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { config: {} } }),
          }),
        }),
      }),
    };
    vi.mocked(createTenantClient).mockResolvedValue(mockSupabase as never);

    const config = await getClinicConfig("clinic-123");

    expect(config.timezone).toBe("Africa/Casablanca");
    expect(config.currency).toBe("MAD");
    expect(config.booking.slotDuration).toBe(30);
    expect(config.booking.cancellationHours).toBe(24);
    expect(config.booking.maxRecurringWeeks).toBe(12);
  });

  it("overrides defaults with DB config values", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                config: {
                  timezone: "Europe/Paris",
                  currency: "EUR",
                  slotDuration: 45,
                  cancellationHours: 48,
                },
              },
            }),
          }),
        }),
      }),
    };
    vi.mocked(createTenantClient).mockResolvedValue(mockSupabase as never);

    const config = await getClinicConfig("clinic-123");

    expect(config.timezone).toBe("Europe/Paris");
    expect(config.currency).toBe("EUR");
    expect(config.booking.slotDuration).toBe(45);
    expect(config.booking.cancellationHours).toBe(48);
  });

  it("handles null DB config gracefully", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    };
    vi.mocked(createTenantClient).mockResolvedValue(mockSupabase as never);

    const config = await getClinicConfig("clinic-123");

    // Should fall back to defaults
    expect(config.timezone).toBe("Africa/Casablanca");
    expect(config.currency).toBe("MAD");
  });
});
