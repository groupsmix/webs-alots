/**
 * Tests for QR check-in scanning.
 *
 * POST /api/checkin/qr-scan — patient scans QR to check in
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/checkin/qr-scan/route";

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
  limit: vi.fn().mockReturnThis(),
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
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => {}),
}));

// ── Helpers ────────────────────────────────────────────────────────────

const CLINIC = "11111111-1111-4111-b111-111111111111";

function withTenant(clinicId: string | null) {
  getTenant.mockReturnValue(
    clinicId
      ? { clinicId, clinicName: "Test", subdomain: "test", clinicType: "clinic", clinicTier: "pro" }
      : null,
  );
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new Request("http://localhost:3000/api/checkin/qr-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("POST /api/checkin/qr-scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainable.select.mockReturnThis();
    mockChainable.eq.mockReturnThis();
    mockChainable.in.mockReturnThis();
    mockChainable.not.mockReturnThis();
    mockChainable.order.mockReturnThis();
    mockChainable.limit.mockReturnThis();
    mockChainable.update.mockReturnThis();
  });

  it("rejects without clinic context (400)", async () => {
    withTenant(null);
    const res = await POST(makeRequest({ token: "test-token" }));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid/missing token (400)", async () => {
    withTenant(CLINIC);
    mockChainable.single.mockResolvedValueOnce({ data: null, error: { message: "not found" } });

    const res = await POST(makeRequest({ token: "nonexistent-token" }));
    expect(res.status).toBe(400);
  });

  it("rejects already-scanned token (409)", async () => {
    withTenant(CLINIC);
    mockChainable.single.mockResolvedValueOnce({
      data: {
        id: "tok-1",
        appointment_id: "appt-1",
        patient_id: "pat-1",
        scanned_at: "2026-01-01T00:00:00Z",
        expires_at: "2099-12-31T23:59:59Z",
      },
    });

    const res = await POST(makeRequest({ token: "used-token" }));
    expect(res.status).toBe(409);
  });

  it("rejects expired token (410)", async () => {
    withTenant(CLINIC);
    mockChainable.single.mockResolvedValueOnce({
      data: {
        id: "tok-1",
        appointment_id: "appt-1",
        patient_id: "pat-1",
        scanned_at: null,
        expires_at: "2020-01-01T00:00:00Z",
      },
    });

    const res = await POST(makeRequest({ token: "expired-token" }));
    expect(res.status).toBe(410);
  });
});
