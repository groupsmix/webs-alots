import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchDashboardStats,
  fetchAnnouncements,
  fetchActivityLogs,
} from "@/lib/super-admin-actions";
import Page from "./page";

vi.mock("@/lib/super-admin-actions", () => ({
  fetchDashboardStats: vi.fn(),
  fetchAnnouncements: vi.fn(),
  fetchActivityLogs: vi.fn(),
}));

vi.mock("@/components/admin/clinic-briefing-widget", () => ({
  ClinicBriefingWidget: () => null,
}));
vi.mock("@/components/admin/ops-summary-strip", () => ({
  OpsSummaryStrip: () => null,
}));
vi.mock("@/components/compliance/compliance-widget", () => ({
  ComplianceWidget: () => null,
}));

vi.mock("@/components/locale-switcher", () => ({
  useLocale: () => ["fr", vi.fn()],
  LocaleSwitcher: () => null,
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/export-utils", () => ({
  exportToPDF: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const OriginalDate = global.Date;

describe("SuperAdminDashboardPage", () => {
  beforeEach(() => {
    global.Date = class extends OriginalDate {
      constructor(...args: [string | number] | [number, number, ...number[]] | []) {
        if (args.length === 0) {
          super("2026-07-11T00:00:00Z");
        } else if (args.length === 1) {
          super(args[0]);
        } else {
          const [year, monthIndex, ...rest] = args as unknown as [number, number, ...number[]];
          super(
            year,
            monthIndex,
            rest[0] ?? 1,
            rest[1] ?? 0,
            rest[2] ?? 0,
            rest[3] ?? 0,
            rest[4] ?? 0,
          );
        }
      }
      static override now() {
        return new OriginalDate("2026-07-11T00:00:00Z").getTime();
      }
    } as unknown as DateConstructor;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.Date = OriginalDate;
  });

  it("renders real monthly MRR, revenue, overdue and paid-this-month stats", async () => {
    vi.mocked(fetchDashboardStats).mockResolvedValue({
      clinics: [
        {
          id: "c1",
          name: "Clinic A",
          type: "doctor",
          tier: "starter",
          status: "active",
          config: { city: "Casablanca" },
          created_at: "2026-07-02T00:00:00Z",
        },
      ],
      totalClinics: 5,
      activeClinics: 4,
      totalPatients: 120,
      totalAppointments: 250,
      totalRevenue: 5000,
      mrr: 2000,
      monthlyRevenue: 800,
      paidInvoicesThisMonth: 12,
      overdueInvoices: 3,
      newClinicsThisMonth: 2,
    } as never);
    vi.mocked(fetchAnnouncements).mockResolvedValue([]);
    vi.mocked(fetchActivityLogs).mockResolvedValue([]);

    render(<Page />);

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).toBeNull();
    });

    await waitFor(() => {
      screen.getByText("2 000,00 MAD");
      screen.getByText("800,00 MAD");
      screen.getByText("12");
      screen.getByText("3");
      screen.getByText("+2 ce mois");
      expect(screen.queryByText("Active Pilot Clinics")).toBeNull();
      expect(screen.queryByText("100%")).toBeNull();
    });
  });
});
