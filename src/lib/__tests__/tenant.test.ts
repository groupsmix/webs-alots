import { headers } from "next/headers";
import { describe, it, expect, vi } from "vitest";
import { getTenant, TENANT_HEADERS } from "../tenant";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

describe("TENANT_HEADERS", () => {
  it("defines all required header names", () => {
    expect(TENANT_HEADERS.clinicId).toBe("x-tenant-clinic-id");
    expect(TENANT_HEADERS.clinicName).toBe("x-tenant-clinic-name");
    expect(TENANT_HEADERS.subdomain).toBe("x-tenant-subdomain");
    expect(TENANT_HEADERS.clinicType).toBe("x-tenant-clinic-type");
    expect(TENANT_HEADERS.clinicTier).toBe("x-tenant-clinic-tier");
  });
});

describe("getTenant", () => {
  it("returns null when no clinic ID header is present", async () => {
    const mockHeaders = {
      get: vi.fn().mockReturnValue(null),
    };
    vi.mocked(headers).mockResolvedValue(mockHeaders as never);

    const result = await getTenant();
    expect(result).toBeNull();
  });

  it("returns tenant info when clinic ID header is present", async () => {
    const headerValues: Record<string, string> = {
      "x-tenant-clinic-id": "clinic-123",
      "x-tenant-clinic-name": "Dr. Ahmed Clinic",
      "x-tenant-subdomain": "ahmed",
      "x-tenant-clinic-type": "doctor",
      "x-tenant-clinic-tier": "pro",
    };
    const mockHeaders = {
      get: vi.fn((name: string) => headerValues[name] ?? null),
    };
    vi.mocked(headers).mockResolvedValue(mockHeaders as never);

    const result = await getTenant();
    expect(result).toEqual({
      clinicId: "clinic-123",
      clinicName: "Dr. Ahmed Clinic",
      subdomain: "ahmed",
      clinicType: "doctor",
      clinicTier: "pro",
    });
  });

  it("defaults to empty string for missing optional headers", async () => {
    const headerValues: Record<string, string> = {
      "x-tenant-clinic-id": "clinic-123",
    };
    const mockHeaders = {
      get: vi.fn((name: string) => headerValues[name] ?? null),
    };
    vi.mocked(headers).mockResolvedValue(mockHeaders as never);

    const result = await getTenant();
    expect(result).toEqual({
      clinicId: "clinic-123",
      clinicName: "",
      subdomain: "",
      clinicType: "",
      clinicTier: "",
    });
  });
});
