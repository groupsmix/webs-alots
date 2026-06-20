/**
 * Tests for the public demo-lead capture endpoint.
 *
 * POST /api/leads — a prospective clinic submits a demo request from the
 * marketing landing page. Public + unauthenticated, validated by
 * `demoLeadSchema`, persisted to the platform-level `demo_leads` table via
 * the service-role client.
 *
 * These exercise the full handler with a mocked Supabase client: input
 * validation (422), the happy path (201 + correct column mapping), and a
 * database failure (500).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/leads/route";

// ── Mock setup ────────────────────────────────────────────────────────

const insert = vi.fn();
const mockSupabase = { from: vi.fn(() => ({ insert })) };

vi.mock("@/lib/supabase-server", () => ({
  createServiceClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new Request("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validLead = {
  clinic: "Cabinet Dentaire Atlas",
  doctor: "Dr. Amine Benali",
  phone: "+212 6 12 34 56 78",
  email: "amine@atlas.ma",
  city: "Casablanca",
  locale: "fr",
};

// ── Tests ──────────────────────────────────────────────────────────────

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
  });

  it("persists a valid lead and returns 201", async () => {
    const res = await POST(makeRequest(validLead));
    expect(res.status).toBe(201);

    const body = (await res.json()) as { ok: boolean; data: { received: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.received).toBe(true);

    // Column mapping: schema field names → table columns.
    expect(mockSupabase.from).toHaveBeenCalledWith("demo_leads");
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      clinic_name: validLead.clinic,
      contact_name: validLead.doctor,
      phone: validLead.phone,
      email: validLead.email,
      city: validLead.city,
      locale: "fr",
      source: "landing_demo_cta",
      status: "new",
    });
  });

  it("accepts a lead without the optional city", async () => {
    const { city: _city, ...noCity } = validLead;
    void _city;
    const res = await POST(makeRequest(noCity));
    expect(res.status).toBe(201);
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.city).toBeNull();
  });

  it("rejects a missing clinic name (422)", async () => {
    const { clinic: _clinic, ...noClinic } = validLead;
    void _clinic;
    const res = await POST(makeRequest(noClinic));
    expect(res.status).toBe(422);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an invalid email (422)", async () => {
    const res = await POST(makeRequest({ ...validLead, email: "not-an-email" }));
    expect(res.status).toBe(422);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a malformed phone number (422)", async () => {
    const res = await POST(makeRequest({ ...validLead, phone: "abc" }));
    expect(res.status).toBe(422);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale (422)", async () => {
    const res = await POST(makeRequest({ ...validLead, locale: "es" }));
    expect(res.status).toBe(422);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 500 when the insert fails", async () => {
    insert.mockResolvedValueOnce({ error: { message: "db down" } });
    const res = await POST(makeRequest(validLead));
    expect(res.status).toBe(500);
  });
});
