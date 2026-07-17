/**
 * Tests for GET /api/receptionist/recalls-due — due-recall count for the
 * reception dashboard. Exercises the happy path, a DB failure, and the
 * missing-clinic guard with a mocked Supabase client and pass-through auth.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CLINIC = "11111111-1111-1111-1111-111111111111";

const lte = vi.fn();
const eqStatus = vi.fn(() => ({ lte }));
const eqClinic = vi.fn(() => ({ eq: eqStatus }));
const select = vi.fn(() => ({ eq: eqClinic }));
const from = vi.fn(() => ({ select }));

const mockSupabase = { from };

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let authProfile: { role: string; clinic_id: string | null } = {
  role: "receptionist",
  clinic_id: CLINIC,
};

type Handler = (...args: unknown[]) => unknown;
vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: Handler) => (request: NextRequest) =>
    handler(request, {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: { id: "user-1", ...authProfile },
    }),
}));

async function importRoute() {
  return import("@/app/api/receptionist/recalls-due/route");
}

function makeRequest(): NextRequest {
  return new NextRequest(new Request("http://localhost:3000/api/receptionist/recalls-due"));
}

describe("GET /api/receptionist/recalls-due", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authProfile = { role: "receptionist", clinic_id: CLINIC };
    lte.mockResolvedValue({ count: 3, error: null });
  });

  it("returns the due-recall count scoped to the clinic", async () => {
    const { GET } = await importRoute();
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(3);
    expect(eqClinic).toHaveBeenCalledWith("clinic_id", CLINIC);
    expect(eqStatus).toHaveBeenCalledWith("status", "pending");
  });

  it("returns 0 when there are no due recalls", async () => {
    lte.mockResolvedValue({ count: null, error: null });
    const { GET } = await importRoute();
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(0);
  });

  it("returns 500 when the query fails", async () => {
    lte.mockResolvedValue({ count: null, error: { message: "boom" } });
    const { GET } = await importRoute();
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns 400 when there is no clinic context", async () => {
    authProfile = { role: "receptionist", clinic_id: null };
    const { GET } = await importRoute();
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });
});
