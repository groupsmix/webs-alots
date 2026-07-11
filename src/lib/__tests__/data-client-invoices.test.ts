import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearLookupCache, fetchInvoices } from "@/lib/data/client";
import { createClient } from "@/lib/supabase-client";
import { createMockSupabaseClient } from "./test-utils";

vi.mock("@/lib/supabase-client", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

describe("fetchInvoices", () => {
  beforeEach(() => {
    clearLookupCache();
  });

  it("returns payment dates in the clinic-local timezone", async () => {
    const supabase = createMockSupabaseClient({
      users: [{ id: "p1", name: "Patient One", phone: null, email: null, clinic_id: "clinic-1" }],
      services: [{ id: "s1", name: "Consultation", price: 200, clinic_id: "clinic-1" }],
      payments: [
        {
          id: "pay-1",
          clinic_id: "clinic-1",
          appointment_id: null,
          patient_id: "p1",
          amount: 200,
          method: "cash",
          status: "completed",
          reference: null,
          payment_type: "appointment",
          gateway_session_id: null,
          refunded_amount: 0,
          created_at: "2026-07-10T23:05:00Z",
        },
      ],
    });

    vi.mocked(createClient).mockReturnValue(supabase as never);

    const invoices = await fetchInvoices("clinic-1");

    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe("paid");
    expect(invoices[0].date).toBe("2026-07-11");
  });
});
