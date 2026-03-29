"use client";

import {
  LayoutDashboard, ClipboardList, FlaskConical, FileText,
  History, TestTubes,
} from "lucide-react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";

const config: ClinicDashboardConfig = {
  title: "Analysis Lab",
  icon: TestTubes,
  accentColor: "blue-600",
  featureKey: "lab_tests",
  moduleName: "Analysis Lab",
  navItems: [
    { href: "/lab-panel/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/lab-panel/test-orders", label: "Test Orders", icon: ClipboardList },
    { href: "/lab-panel/results", label: "Results Entry", icon: FlaskConical },
    { href: "/lab-panel/reports", label: "Reports", icon: FileText },
    { href: "/lab-panel/patient-history", label: "Patient History", icon: History },
  ],
};

export default function LabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClinicDashboardLayout config={config}>
      {children}
    </ClinicDashboardLayout>
  );
}
