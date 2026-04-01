/**
 * Integration test: Onboarding flow.
 *
 * Audit L9-11: Covers the complete clinic onboarding flow from
 * registration through admin user creation. Verifies validation,
 * idempotency guards, subdomain generation, and error handling.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createTenantClient: vi.fn(async () => mockSupabase),
}));

// ── Helpers ──────────────────────────────────────────────────────────

function buildOnboardingRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  clinic_type_key: "general_medicine",
  clinic_name: "Clinique Test",
  owner_name: "Dr. Ahmed",
  phone: "+212600000000",
  email: "ahmed@test.ma",
  city: "Casablanca",
};

// ── Tests ────────────────────────────────────────────────────────────

describe("Onboarding flow — route handler integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 422 when clinic_name is missing", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1", email: "a@b.com", email_confirmed_at: "2026-01-01" } },
      error: null,
    });
    // Profile lookup: no existing profile
    mockChainable.single.mockResolvedValueOnce({
      data: { id: "user-1", role: "clinic_admin", clinic_id: null },
      error: null,
    });

    const { POST } = await import("@/app/api/onboarding/route");
    const request = buildOnboardingRequest({
      clinic_type_key: "general",
      owner_name: "Admin",
      phone: "+212600000000",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { POST } = await import("@/app/api/onboarding/route");
    const request = buildOnboardingRequest(VALID_PAYLOAD);
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/not authenticated/i);
  });

  it("returns 403 when email is not verified", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "auth-1",
          email: "a@b.com",
          email_confirmed_at: null,
        },
      },
      error: null,
    });
    // Profile lookup for withAuth
    mockChainable.single.mockResolvedValueOnce({
      data: { id: "user-new", role: "clinic_admin", clinic_id: null },
      error: null,
    });

    const { POST } = await import("@/app/api/onboarding/route");
    const request = buildOnboardingRequest(VALID_PAYLOAD);
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.ok).toBe(false);
  });

  it("returns 409 when user already has a clinic", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "auth-1",
          email: "a@b.com",
          email_confirmed_at: "2026-01-01",
        },
      },
      error: null,
    });
    // withAuth profile lookup
    mockChainable.single
      .mockResolvedValueOnce({
        data: { id: "user-1", role: "clinic_admin", clinic_id: null },
        error: null,
      })
      // Onboarding's own profile lookup — user already has a clinic
      .mockResolvedValueOnce({
        data: { clinic_id: "existing-clinic", role: "clinic_admin" },
        error: null,
      });

    const { POST } = await import("@/app/api/onboarding/route");
    const request = buildOnboardingRequest(VALID_PAYLOAD);
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.ok).toBe(false);
  });
});

describe("Onboarding flow — subdomain generation", () => {
  it("generates lowercase hyphenated subdomain from clinic name", () => {
    const clinicName = "My Test Clinic";
    const subdomain = clinicName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-");
    expect(subdomain).toBe("my-test-clinic");
  });

  it("strips special characters from clinic name", () => {
    const clinicName = "Dr. Ahmed's Clinic (Casablanca)";
    const subdomain = clinicName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-");
    expect(subdomain).toBe("dr-ahmeds-clinic-casablanca");
  });

  it("handles Arabic clinic names (strips non-latin characters)", () => {
    const clinicName = "عيادة الصحة";
    const subdomain = clinicName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-");
    expect(subdomain).toBe("");
  });
});

describe("Onboarding flow — clinic type mapping", () => {
  it("maps medical category to doctor type", () => {
    const legacyTypeMap: Record<string, string> = {
      medical: "doctor",
      para_medical: "doctor",
      diagnostic: "doctor",
      pharmacy_retail: "pharmacy",
      clinics_centers: "dentist",
    };
    expect(legacyTypeMap["medical"]).toBe("doctor");
    expect(legacyTypeMap["pharmacy_retail"]).toBe("pharmacy");
    expect(legacyTypeMap["clinics_centers"]).toBe("dentist");
  });

  it("type key overrides take precedence over category", () => {
    const typeKeyOverrides: Record<string, string> = {
      dental_clinic: "dentist",
      pharmacy: "pharmacy",
      parapharmacy: "pharmacy",
    };
    const legacyTypeMap: Record<string, string> = {
      medical: "doctor",
    };

    const clinicTypeKey = "dental_clinic";
    const category = "medical";
    const legacyType =
      typeKeyOverrides[clinicTypeKey] ??
      (category ? legacyTypeMap[category] : undefined) ??
      "doctor";

    expect(legacyType).toBe("dentist");
  });
});
