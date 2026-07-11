import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchDashboardStatsImpl } from "@/lib/super-admin/dashboard-actions";
import { createMockSupabaseClient } from "./test-utils";

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

describe("fetchDashboardStatsImpl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes total/all-time revenue from completed payments", async () => {
    vi.setSystemTime(new Date("2026-07-11T12:00:00Z"));
    const supabase = createMockSupabaseClient({
      clinics: [],
      users: [],
      appointments: [],
      payments: [
        { amount: 100, created_at: "2026-07-10T10:00:00Z", status: "completed" },
        { amount: 250, created_at: "2026-06-01T10:00:00Z", status: "completed" },
      ],
      invoices: [],
    });

    const stats = await fetchDashboardStatsImpl(supabase as never);

    expect(stats.totalRevenue).toBe(350);
    expect(stats.monthlyRevenue).toBe(100);
    expect(stats.paidInvoicesThisMonth).toBe(1);
  });

  it("computes MRR from clinic subscription plans, not from total revenue", async () => {
    const supabase = createMockSupabaseClient({
      clinics: [
        {
          id: "c1",
          name: "A",
          type: "doctor",
          tier: "starter",
          status: "active",
          config: {},
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "c2",
          name: "B",
          type: "dentist",
          tier: "professional",
          status: "active",
          config: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      users: [],
      appointments: [],
      payments: [],
      invoices: [],
    });

    const stats = await fetchDashboardStatsImpl(supabase as never);

    expect(stats.totalRevenue).toBe(0);
    expect(stats.mrr).toBeGreaterThan(0);
    expect(stats.mrr).toBe(798); // 199 + 599 from getPlanConfig defaults
  });

  it("counts overdue invoices and active/new clinics this month", async () => {
    vi.setSystemTime(new Date("2026-07-11T12:00:00Z"));
    const supabase = createMockSupabaseClient({
      clinics: [
        {
          id: "c1",
          name: "A",
          type: "doctor",
          tier: "starter",
          status: "active",
          config: {},
          created_at: "2026-07-05T00:00:00Z",
        },
        {
          id: "c2",
          name: "B",
          type: "dentist",
          tier: "professional",
          status: "active",
          config: {},
          created_at: "2026-06-01T00:00:00Z",
        },
      ],
      users: [],
      appointments: [],
      payments: [],
      invoices: [
        { status: "overdue", due_date: "2026-07-01" },
        { status: "sent", due_date: "2026-07-09" },
        { status: "sent", due_date: "2026-07-12" },
        { status: "paid", due_date: "2026-07-01" },
      ],
    });

    const stats = await fetchDashboardStatsImpl(supabase as never);

    expect(stats.overdueInvoices).toBe(2);
    expect(stats.newClinicsThisMonth).toBe(1);
  });
});
