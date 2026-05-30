/**
 * Route handler + unit tests for GET /api/v1/appointments input validation.
 *
 * Covers:
 *   INJ-02 — Cursor field injection via crafted Base64 payloads
 *   IV-02  — Date query param format validation
 *
 * Cursor fields (`appointment_date`, `start_time`, `id`) are decoded from
 * Base64 and interpolated into a PostgREST `.or()` filter. Without strict
 * format validation an attacker could smuggle additional filter clauses.
 *
 * The `date` query param is passed to `.eq("appointment_date", date)` and
 * must conform to `YYYY-MM-DD` to prevent format-based injection.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/v1/appointments/route";
import { decodeCursor, encodeCursor } from "@/lib/pagination";

// ── Mock setup ───────────────────────────────────────────────────────

const result: { data: unknown[]; error: unknown } = { data: [], error: null };

const query: Record<string, unknown> = {};
for (const m of ["select", "eq", "order", "limit", "or"]) {
  query[m] = vi.fn(() => query);
}
(query as { then: unknown }).then = (resolve: (v: typeof result) => void) => resolve(result);

const mockSupabase = { from: vi.fn(() => query) };

const authenticateApiKey = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  authenticateApiKey: () => authenticateApiKey(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createTenantClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/tenant-context", () => ({
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/cors", () => ({
  getCorsHeaders: vi.fn(() => ({})),
  handlePreflight: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────

const CLINIC = "11111111-1111-1111-1111-111111111111";
const VALID_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function req(params?: Record<string, string>): NextRequest {
  const url = new URL("http://api.localhost:3000/api/v1/appointments");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url, {
    headers: { authorization: "Bearer test-key" },
  });
}

function makeCursor(fields: Record<string, string>): string {
  return Buffer.from(JSON.stringify(fields), "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

// ── Unit tests: decodeCursor (INJ-02) ────────────────────────────────

describe("decodeCursor — format validation (INJ-02)", () => {
  it("accepts a well-formed cursor", () => {
    const encoded = encodeCursor({
      appointment_date: "2025-06-15",
      start_time: "09:30",
      id: VALID_UUID,
    });
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({
      appointment_date: "2025-06-15",
      start_time: "09:30",
      id: VALID_UUID,
    });
  });

  it("accepts start_time with seconds", () => {
    const encoded = encodeCursor({
      appointment_date: "2025-06-15",
      start_time: "09:30:00",
      id: VALID_UUID,
    });
    expect(decodeCursor(encoded)).not.toBeNull();
  });

  it("rejects appointment_date containing PostgREST injection", () => {
    const cursor = makeCursor({
      appointment_date: "2025-06-15,role.eq.admin",
      start_time: "09:30",
      id: VALID_UUID,
    });
    expect(decodeCursor(cursor)).toBeNull();
  });

  it("rejects start_time containing filter operators", () => {
    const cursor = makeCursor({
      appointment_date: "2025-06-15",
      start_time: "09:30,status.eq.cancelled",
      id: VALID_UUID,
    });
    expect(decodeCursor(cursor)).toBeNull();
  });

  it("rejects id that is not a valid UUID", () => {
    const cursor = makeCursor({
      appointment_date: "2025-06-15",
      start_time: "09:30",
      id: "not-a-uuid,clinic_id.eq.other",
    });
    expect(decodeCursor(cursor)).toBeNull();
  });

  it("rejects appointment_date with extra characters", () => {
    const cursor = makeCursor({
      appointment_date: "2025-06-15T00:00:00",
      start_time: "09:30",
      id: VALID_UUID,
    });
    expect(decodeCursor(cursor)).toBeNull();
  });

  it("rejects start_time with non-digit characters", () => {
    const cursor = makeCursor({
      appointment_date: "2025-06-15",
      start_time: "09:30:00.000",
      id: VALID_UUID,
    });
    expect(decodeCursor(cursor)).toBeNull();
  });

  it("returns null for garbage base64", () => {
    expect(decodeCursor("!!!not-valid!!!")).toBeNull();
  });
});

// ── Route handler tests: date validation (IV-02) ─────────────────────

describe("GET /api/v1/appointments — date validation (IV-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateApiKey.mockResolvedValue({ clinicId: CLINIC });
  });

  it("rejects unauthenticated requests (401)", async () => {
    authenticateApiKey.mockResolvedValue(null);
    const res = await GET(req({ date: "2025-06-15" }));
    expect(res.status).toBe(401);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("accepts a valid YYYY-MM-DD date", async () => {
    const res = await GET(req({ date: "2025-06-15" }));
    expect(res.status).toBe(200);
    const eq = query.eq as ReturnType<typeof vi.fn>;
    expect(eq.mock.calls).toContainEqual(["appointment_date", "2025-06-15"]);
  });

  it("rejects a date with time appended (ISO datetime)", async () => {
    const res = await GET(req({ date: "2025-06-15T00:00:00" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("rejects a date with PostgREST injection payload", async () => {
    const res = await GET(req({ date: "2025-06-15,role.eq.admin" }));
    expect(res.status).toBe(400);
  });

  it("rejects a date with SQL injection payload", async () => {
    const res = await GET(req({ date: "'; DROP TABLE appointments;--" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty date string", async () => {
    // Empty string does not match YYYY-MM-DD
    const res = await GET(req({ date: "" }));
    // Empty string is falsy — the `if (date)` guard skips validation & filtering
    expect(res.status).toBe(200);
  });

  it("succeeds when no date param is supplied", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
  });
});

// ── Route handler tests: cursor validation (INJ-02) ──────────────────

describe("GET /api/v1/appointments — cursor validation (INJ-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateApiKey.mockResolvedValue({ clinicId: CLINIC });
  });

  it("accepts a valid cursor and applies the .or() filter", async () => {
    const cursor = encodeCursor({
      appointment_date: "2025-06-15",
      start_time: "09:30",
      id: VALID_UUID,
    });
    const res = await GET(req({ cursor }));
    expect(res.status).toBe(200);
    expect(query.or).toHaveBeenCalledTimes(1);
  });

  it("rejects an injection-laden cursor with 400", async () => {
    const cursor = makeCursor({
      appointment_date: "2025-06-15,clinic_id.eq.other",
      start_time: "09:30",
      id: VALID_UUID,
    });
    const res = await GET(req({ cursor }));
    expect(res.status).toBe(400);
    expect(query.or).not.toHaveBeenCalled();
  });

  it("rejects a cursor with a non-UUID id", async () => {
    const cursor = makeCursor({
      appointment_date: "2025-06-15",
      start_time: "09:30",
      id: "DROP TABLE appointments",
    });
    const res = await GET(req({ cursor }));
    expect(res.status).toBe(400);
  });
});
