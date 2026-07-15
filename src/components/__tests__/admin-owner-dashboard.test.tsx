import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OwnerAttention } from "@/components/admin/admin-owner-dashboard/attention";
import { OwnerOverview } from "@/components/admin/admin-owner-dashboard/overview";
import type { DashboardStats } from "@/lib/data/dashboard";

const stats: DashboardStats = {
  totalPatients: 20,
  totalAppointments: 100,
  completedAppointments: 80,
  noShowCount: 5,
  totalRevenue: 15000,
  averageRating: 4.5,
  doctorCount: 3,
  insurancePatients: 8,
  recentActivity: [],
};

describe("owner dashboard sections", () => {
  it("shows a clear empty attention state", () => {
    render(
      <OwnerAttention items={[]} locale="en" noShowRate={5} averageRating={stats.averageRating} />,
    );

    expect(screen.getByText("Nothing urgent right now")).toBeDefined();
    expect(
      screen.getByText("Your clinic has no alerts requiring action in the available data."),
    ).toBeDefined();
  });

  it("marks cumulative figures as all-time totals", () => {
    render(<OwnerOverview stats={stats} locale="en" />);

    expect(screen.getByText("All time")).toBeDefined();
    expect(screen.getByText("All appointments recorded to date")).toBeDefined();
    expect(screen.getByText("All completed payments recorded to date")).toBeDefined();
  });
});
