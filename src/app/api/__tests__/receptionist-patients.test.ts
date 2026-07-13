/**
 * Tests for POST /api/receptionist/patients — front-desk patient registration.
 *
 * Front-desk staff create auth-less patient records. Direct client inserts
 * into `users` are blocked by RLS, so this authenticated route performs the
 * write with a clinic-scoped admin client. These exercise input validation,
 * the adult-only gate, phone dedupe, the happy path, and a DB failure — all
 * with a mocked Supabase client and a pass-through auth wrapper.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/receptionist/patients/route";

const CLINIC = "11111111-1111-1111-1111-111111111111";

const maybeSingle = vi.fn();
const single = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({ maybeSingle })),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({ single })),
    })),
  })),
};

vi.mock("@/lib/supabase-server", () => ({
  createScopedAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type Handler = (...args: unknown[]) => unknown;
vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: Handler) => (request: NextRequest) =>
    handler(request, {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: { id: "user-1", role: "receptionist", clinic_id: CLINIC },
    }),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    new Request("http://localhost:3000/api/receptionist/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/receptionist/patients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null });
    single.mockResolvedValue({
      data: { id: "patient-1", name: "Amine", phone: "+212600000000" },
      error: null,
    });
  });

  it("rejects a body missing required fields", async () => {
    const res = await POST(makeRequest({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("rejects registering a minor", async () => {
    const res = await POST(
      makeRequest({ name: "Kid", phone: "+212600000001", dateOfBirth: "2020-01-01" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("at least");
  });

  it("creates a patient and returns 201", async () => {
    const res = await POST(makeRequest({ name: "Amine", phone: "+212600000000" }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { patient: { id: string }; existing: boolean };
    };
    expect(body.data.patient.id).toBe("patient-1");
    expect(body.data.existing).toBe(false);
  });

  it("returns the existing patient (200) when the phone already exists", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "patient-existing", name: "Amine", phone: "+212600000000" },
    });
    const res = await POST(makeRequest({ name: "Amine", phone: "+212600000000" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { existing: boolean } };
    expect(body.data.existing).toBe(true);
  });

  it("returns 500 when the insert fails", async () => {
    single.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(makeRequest({ name: "Amine", phone: "+212600000000" }));
    expect(res.status).toBe(500);
  });
});
