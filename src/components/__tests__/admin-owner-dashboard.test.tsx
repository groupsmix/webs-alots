import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OwnerAttention } from "@/components/admin/admin-owner-dashboard/attention";
import { OwnerBriefing } from "@/components/admin/admin-owner-dashboard/briefing";
import { OwnerOverview } from "@/components/admin/admin-owner-dashboard/overview";
import { OwnerToday } from "@/components/admin/admin-owner-dashboard/today";
import type { DashboardStats } from "@/lib/data/dashboard";

const today = {
  totalAppointments: 0,
  unconfirmedAppointments: 0,
  confirmedAppointments: 0,
  checkedInAppointments: 0,
  inProgressAppointments: 0,
  completedAppointments: 0,
  cancelledAppointments: 0,
  noShowAppointments: 0,
};

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
      <OwnerAttention
        items={[]}
        locale="en"
        noShowRate={5}
        averageRating={stats.averageRating}
        today={today}
      />,
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

  it("shows a useful empty state when today has no appointments", () => {
    render(<OwnerToday summary={today} locale="en" />);

    expect(screen.getByText("No appointments today")).toBeDefined();
    expect(screen.getByRole("link", { name: "View schedule" }).getAttribute("href")).toBe(
      "/admin/agenda",
    );
  });

  it("shows current appointment work without technical labels", () => {
    render(
      <OwnerToday
        summary={{
          ...today,
          totalAppointments: 9,
          unconfirmedAppointments: 2,
          confirmedAppointments: 3,
          checkedInAppointments: 1,
          inProgressAppointments: 1,
          completedAppointments: 2,
        }}
        locale="en"
      />,
    );

    expect(screen.getByText("Appointments today")).toBeDefined();
    expect(screen.getByText("Awaiting confirmation")).toBeDefined();
    expect(screen.getByText("Waiting now")).toBeDefined();
    expect(screen.getByText("Completed")).toBeDefined();
  });

  it("shows the daily AI brief with its aggregate-data privacy note", () => {
    const content = "A".repeat(400);
    render(
      <OwnerBriefing
        locale="en"
        briefing={{
          id: "briefing-1",
          briefingDate: "2026-07-14",
          content,
          generatedAt: "2026-07-14T05:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Your daily AI brief")).toBeDefined();
    expect(
      screen.getByText(
        "Built from clinic totals only. Patient names and contact details are not sent to AI.",
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Read the full brief" }));

    expect(screen.getByText(content).getAttribute("dir")).toBe("auto");
  });

  it("explains when today's AI brief is not available", () => {
    render(<OwnerBriefing locale="en" briefing={null} />);

    expect(screen.getByText("No AI brief for today yet")).toBeDefined();
    expect(
      screen.getByText("Your daily brief will appear here after the morning clinic review runs."),
    ).toBeDefined();
  });
});
