/**
 * Route-handler tests for POST /api/super-admin/clinics/bulk.
 *
 * Context: an audit checklist claimed that the super-admin "bulk Suspend" shows
 * a success toast but never persists, while single-clinic suspend works. These
 * tests pin down the backend contract the UI depends on: the handler issues a
 * real `clinics.update({ status }).in("id", ids)`, returns success ONLY when the
 * DB reports no error, and returns 500 on a DB error (so the client throws and
 * shows a failure toast instead of a phantom success). It also enforces input
 * validation before any write.
 *
 * The route is wrapped in withAuth(..., ["super_admin"]); we mock withAuth as a
 * pass-through that injects a super_admin AuthContext, so the test invokes the
 * real handler body. api-response is NOT mocked — real NextResponse shapes are
 * asserted. Runs in CI with no database.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/super-admin/clinics/bulk/route";

const CLINIC_A = "11111111-1111-4111-8111-111111111111";
const CLINIC_B = "22222222-2222-4222-9222-222222222222";

// ── Mocks (hoisted above the route import) ───────────────────────────

// Cross-tenant admin client used by the route to bypass RLS.
const adminChain = {
  update: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockResolvedValue({ error: null }),
  in: vi.fn().mockResolvedValue({ error: null, data: [] }),
};
const mockAdminClient = { from: vi.fn(() => adminChain) };

vi.mock("@/lib/supabase-server", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

// Pass-through auth wrapper that injects a super_admin context.
vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => unknown) => (req: NextRequest) =>
    handler(req, {
      supabase: { from: vi.fn() },
      user: { id: "auth-sa-1", email: "sa@oltigo.com" },
      profile: { id: "sa-1", role: "super_admin", clinic_id: null },
    }),
}));

const logAuditEvent = vi.fn();
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: (...a: unknown[]) => logAuditEvent(...a) }));
vi.mock("@/lib/whatsapp", () => ({ sendTextMessage: vi.fn().mockResolvedValue(undefined) }));

function bulkRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/super-admin/clinics/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  adminChain.update.mockReturnThis();
  adminChain.select.mockReturnThis();
  adminChain.upsert.mockResolvedValue({ error: null });
  adminChain.in.mockResolvedValue({ error: null, data: [] });
});

describe("POST /api/super-admin/clinics/bulk — suspend", () => {
  it("persists status=suspended for the selected ids and reports success", async () => {
    const res = await POST(bulkRequest({ action: "suspend", ids: [CLINIC_A, CLINIC_B] }));
    const json = (await res.json()) as { ok: boolean; data?: { processed: number } };

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.processed).toBe(2);

    // Real write was issued against the clinics table…
    expect(mockAdminClient.from).toHaveBeenCalledWith("clinics");
    expect(adminChain.update).toHaveBeenCalledWith({ status: "suspended" });
    // …scoped to exactly the selected ids.
    expect(adminChain.in).toHaveBeenCalledWith("id", [CLINIC_A, CLINIC_B]);
    // …and the action was audit-logged.
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });

  it("returns 500 (no phantom success) when the DB update errors", async () => {
    adminChain.in.mockResolvedValue({ error: { message: "update failed" }, data: null });

    const res = await POST(bulkRequest({ action: "suspend", ids: [CLINIC_A] }));
    const json = (await res.json()) as { ok: boolean; error?: string };

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    // The client treats !res.ok as a thrown error → failure toast, no DB refetch success.
  });
});

describe("POST /api/super-admin/clinics/bulk — validation & other actions", () => {
  it("rejects an empty id list with 422 before any write", async () => {
    const res = await POST(bulkRequest({ action: "suspend", ids: [] }));
    expect(res.status).toBe(422);
    expect(adminChain.update).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid id with 422", async () => {
    const res = await POST(bulkRequest({ action: "suspend", ids: ["not-a-uuid"] }));
    expect(res.status).toBe(422);
  });

  it("change_status persists the requested status", async () => {
    const res = await POST(
      bulkRequest({ action: "change_status", ids: [CLINIC_A], value: "active" }),
    );
    expect(res.status).toBe(200);
    expect(adminChain.update).toHaveBeenCalledWith({ status: "active" });
    expect(adminChain.in).toHaveBeenCalledWith("id", [CLINIC_A]);
  });

  it("change_status rejects an invalid status value with 422", async () => {
    const res = await POST(
      bulkRequest({ action: "change_status", ids: [CLINIC_A], value: "banished" }),
    );
    expect(res.status).toBe(422);
    expect(adminChain.update).not.toHaveBeenCalled();
  });
});
