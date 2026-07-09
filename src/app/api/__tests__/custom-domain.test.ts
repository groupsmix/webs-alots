import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (request: NextRequest, auth: typeof mockAuthContext) => Promise<Response>;

const CLINIC_ID = "11111111-1111-4111-b111-111111111111";
const DOMAIN_ID = "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa";

const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: mockOrder,
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
  insert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  error: null as unknown,
};

const mockSupabase = {
  from: vi.fn(() => mockBuilder),
};

const mockAuthContext = {
  supabase: mockSupabase,
  user: { id: "auth-user-1", email: "admin@test.com" },
  profile: { id: "user-1", role: "clinic_admin", clinic_id: CLINIC_ID },
};

const mockCreateCustomHostname = vi.fn();
const mockDeleteCustomHostname = vi.fn();
const mockRequireTenant = vi.fn();
const mockLogAuditEvent = vi.fn();

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: Handler) => (request: NextRequest) => handler(request, mockAuthContext),
}));

vi.mock("@/lib/cloudflare-custom-hostnames", () => ({
  createCustomHostname: (...args: unknown[]) => mockCreateCustomHostname(...args),
  deleteCustomHostname: (...args: unknown[]) => mockDeleteCustomHostname(...args),
}));

vi.mock("@/lib/tenant", () => ({
  requireTenant: (...args: unknown[]) => mockRequireTenant(...args),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Custom domain route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuilder.select.mockReturnThis();
    mockBuilder.eq.mockReturnThis();
    mockBuilder.insert.mockReturnThis();
    mockBuilder.delete.mockReturnThis();
    mockBuilder.error = null;

    mockRequireTenant.mockResolvedValue({
      clinicId: CLINIC_ID,
      clinicName: "Test Clinic",
      subdomain: "test",
      clinicType: "clinic",
      clinicTier: "professional",
    });
    mockCreateCustomHostname.mockResolvedValue({
      success: true,
      data: {
        id: "cf-hostname-1",
        ownership_verification: { value: "txt-verification-token" },
        ssl: { status: "pending_validation" },
      },
      error: null,
    });
    mockDeleteCustomHostname.mockResolvedValue(undefined);
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("GET /api/branding/custom-domain returns domains list in expected shape", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [
        {
          id: DOMAIN_ID,
          domain: "clinic.example.com",
          status: "pending",
          ssl_status: "pending_validation",
          verification_txt: "txt-verification-token",
          created_at: "2026-07-07T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const { GET } = await import("../branding/custom-domain/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/api/branding/custom-domain", { method: "GET" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.domains).toHaveLength(1);
    expect(json.data.domains[0]).toMatchObject({
      id: DOMAIN_ID,
      domain: "clinic.example.com",
      status: "pending",
    });
  });

  it("POST /api/branding/custom-domain returns created domain payload expected by the UI", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSingle.mockResolvedValueOnce({
      data: {
        id: DOMAIN_ID,
        domain: "clinic.example.com",
        status: "pending",
        ssl_status: "pending_validation",
        verification_txt: "txt-verification-token",
        created_at: "2026-07-07T00:00:00.000Z",
      },
      error: null,
    });

    const { POST } = await import("@/app/api/branding/custom-domain/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/branding/custom-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "clinic.example.com" }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.domain).toMatchObject({
      id: DOMAIN_ID,
      domain: "clinic.example.com",
      status: "pending",
    });
    expect(json.data.cloudflareStatus).toBe("provisioning");
    expect(json.data.error).toBeNull();
  });

  it("POST /api/branding/custom-domain rejects duplicate domains", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: DOMAIN_ID }, error: null });

    const { POST } = await import("@/app/api/branding/custom-domain/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/branding/custom-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "clinic.example.com" }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("This domain is already registered");
    expect(mockCreateCustomHostname).not.toHaveBeenCalled();
  });

  it("DELETE /api/branding/custom-domain returns deleted flag in expected shape", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: DOMAIN_ID,
        domain: "clinic.example.com",
        cloudflare_custom_hostname_id: "cf-hostname-1",
      },
      error: null,
    });

    const { DELETE } = await import("@/app/api/branding/custom-domain/route");
    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/branding/custom-domain", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: DOMAIN_ID }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({ deleted: true });
    expect(mockDeleteCustomHostname).toHaveBeenCalledWith("cf-hostname-1");
  });

  it("DELETE /api/branding/custom-domain returns 404 when the domain does not belong to the clinic", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const { DELETE } = await import("@/app/api/branding/custom-domain/route");
    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/branding/custom-domain", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: DOMAIN_ID }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Domain not found");
    expect(mockDeleteCustomHostname).not.toHaveBeenCalled();
  });
});
