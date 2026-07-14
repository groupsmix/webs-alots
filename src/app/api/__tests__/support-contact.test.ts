/**
 * Tests for POST /api/support/contact — in-app "Contact support" available to
 * any authenticated role. Opens a support ticket scoped to the caller's clinic
 * and threads the initial message. Exercises validation, the happy path, and a
 * ticket-insert failure, with a mocked Supabase client and pass-through auth.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CLINIC = "11111111-1111-1111-1111-111111111111";

const ticketSingle = vi.fn();
const ticketInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: ticketSingle })) }));
const messageInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === "support_tickets") return { insert: ticketInsert };
    return { insert: messageInsert };
  }),
};

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));

vi.mock("@/lib/tenant", () => ({
  requireTenant: vi.fn(() => Promise.resolve({ clinicId: CLINIC })),
}));

type Handler = (...args: unknown[]) => unknown;
const auth: {
  supabase: typeof mockSupabase;
  user: { id: string };
  profile: { id: string; role: string; clinic_id: string | null };
} = {
  supabase: mockSupabase,
  user: { id: "auth-1" },
  profile: { id: "user-1", role: "doctor", clinic_id: CLINIC },
};
vi.mock("@/lib/with-auth", () => ({
  withAuthAnyRole: (handler: Handler) => (request: NextRequest) => handler(request, auth),
  withAuth: (handler: Handler) => (request: NextRequest) => handler(request, auth),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    new Request("http://demo.localhost:3000/api/support/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/support/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ticketSingle.mockResolvedValue({ data: { id: "ticket-1" }, error: null });
  });

  it("rejects a request missing subject/message", async () => {
    const { POST } = await import("@/app/api/support/contact/route");
    const res = await POST(makeRequest({ subject: "hi" }));
    expect(res.status).toBe(422);
  });

  it("opens a clinic-scoped chat ticket and threads the message", async () => {
    const { POST } = await import("@/app/api/support/contact/route");
    const res = await POST(
      makeRequest({ subject: "Cannot print invoice", message: "The print button does nothing." }),
    );
    expect(res.status).toBe(200);
    expect(ticketInsert).toHaveBeenCalledWith(
      expect.objectContaining({ clinic_id: CLINIC, channel: "chat", status: "open" }),
    );
    expect(messageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: CLINIC,
        ticket_id: "ticket-1",
        sender_type: "staff",
        sender_id: "user-1",
      }),
    );
  });

  it("rejects a super_admin with no clinic context (400)", async () => {
    const prev = { ...auth.profile };
    auth.profile = { id: "sa-1", role: "super_admin", clinic_id: null };
    const { POST } = await import("@/app/api/support/contact/route");
    const res = await POST(
      makeRequest({ subject: "A global issue", message: "Something is broken platform-wide." }),
    );
    expect(res.status).toBe(400);
    expect(ticketInsert).not.toHaveBeenCalled();
    auth.profile = prev;
  });

  it("returns 500 when the ticket insert fails", async () => {
    ticketSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { POST } = await import("@/app/api/support/contact/route");
    const res = await POST(
      makeRequest({ subject: "Cannot print invoice", message: "The print button does nothing." }),
    );
    expect(res.status).toBe(500);
  });
});
