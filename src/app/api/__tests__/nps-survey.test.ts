/**
 * Tests for NPS survey response.
 *
 * POST /api/nps/respond — patient submits score
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/nps/respond/route";

// ── Mock setup ────────────────────────────────────────────────────────

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn(),
  update: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
};

vi.mock("@/lib/supabase-server", () => ({
  createTenantClient: vi.fn(async () => mockSupabase),
}));

const getTenant = vi.fn();
vi.mock("@/lib/tenant", () => ({
  getTenant: () => getTenant(),
  requireTenant: async () => {
    const t = getTenant();
    if (!t?.clinicId) throw new Error("Tenant required");
    return t;
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => {}),
}));

// ── Helpers ────────────────────────────────────────────────────────────

const CLINIC = "11111111-1111-4111-b111-111111111111";
const SURVEY_ID = "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa";

function withTenant(clinicId: string | null) {
  getTenant.mockReturnValue(
    clinicId
      ? { clinicId, clinicName: "Test", subdomain: "test", clinicType: "clinic", clinicTier: "pro" }
      : null,
  );
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new Request("http://localhost:3000/api/nps/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("POST /api/nps/respond", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainable.select.mockReturnThis();
    mockChainable.eq.mockReturnThis();
    mockChainable.in.mockReturnThis();
    mockChainable.not.mockReturnThis();
    mockChainable.order.mockReturnThis();
    mockChainable.update.mockReturnThis();
  });

  it("rejects without clinic context (400)", async () => {
    withTenant(null);
    const res = await POST(makeRequest({ surveyId: SURVEY_ID, score: 8 }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing survey (404)", async () => {
    withTenant(CLINIC);
    mockChainable.single.mockResolvedValueOnce({ data: null, error: { message: "not found" } });

    const res = await POST(makeRequest({ surveyId: SURVEY_ID, score: 9 }));
    expect(res.status).toBe(404);
  });

  it("rejects an already-completed survey (409)", async () => {
    withTenant(CLINIC);
    mockChainable.single.mockResolvedValueOnce({
      data: { id: SURVEY_ID, score: 8, clinic_id: CLINIC },
    });

    const res = await POST(makeRequest({ surveyId: SURVEY_ID, score: 9 }));
    expect(res.status).toBe(409);
  });

  it("validates score range (rejects score > 10)", async () => {
    withTenant(CLINIC);
    const res = await POST(makeRequest({ surveyId: SURVEY_ID, score: 11 }));
    expect(res.status).toBe(422);
  });

  it("validates score range (rejects score < 0)", async () => {
    withTenant(CLINIC);
    const res = await POST(makeRequest({ surveyId: SURVEY_ID, score: -1 }));
    expect(res.status).toBe(422);
  });

  it("successfully records a valid NPS response", async () => {
    withTenant(CLINIC);
    mockChainable.single.mockResolvedValueOnce({
      data: { id: SURVEY_ID, score: null, clinic_id: CLINIC },
    });

    const res = await POST(makeRequest({ surveyId: SURVEY_ID, score: 9, comment: "Great!" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.recorded).toBe(true);
  });
});
