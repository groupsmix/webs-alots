import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClinicStats } from "../admin/clinic-stats";

// Mock the data client module
vi.mock("@/lib/data/client", () => ({
  fetchDashboardStats: vi.fn().mockResolvedValue({
    totalPatients: 150,
    totalAppointments: 200,
    completedAppointments: 180,
    noShowCount: 20,
    totalRevenue: 45000,
  }),
  fetchTodayAppointments: vi.fn().mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }]),
  type: {
    DashboardStats: {},
  },
}));

// Mock tenant provider
vi.mock("@/components/tenant-provider", () => ({
  useTenant: () => ({ clinicId: "clinic-1" }),
}));

// Mock UI components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe("ClinicStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without error", async () => {
    const { container } = render(<ClinicStats />);
    expect(container).toBeDefined();
  });

  it("displays stat card titles after data loads", async () => {
    render(<ClinicStats />);
    
    // Wait for data to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check stat titles are rendered
    expect(screen.getByText("Total Patients")).toBeDefined();
    expect(screen.getByText("Today's Bookings")).toBeDefined();
    expect(screen.getByText("No-Show Rate")).toBeDefined();
    expect(screen.getByText("Revenue (MTD)")).toBeDefined();
  });

  it("displays booking sources section", async () => {
    render(<ClinicStats />);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(screen.getByText("Online")).toBeDefined();
    expect(screen.getByText("Phone")).toBeDefined();
    expect(screen.getByText("Walk-in")).toBeDefined();
  });

  it("displays busiest hours section", async () => {
    render(<ClinicStats />);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(screen.getByText("Busiest Hours")).toBeDefined();
  });
});