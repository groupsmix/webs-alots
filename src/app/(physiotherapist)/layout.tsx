"use client";

import {
  LayoutDashboard, Dumbbell, ClipboardList, Camera,
} from "lucide-react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";

const config: ClinicDashboardConfig = {
  title: "Kinésithérapeute",
  icon: Dumbbell,
  accentColor: "teal-600",
  featureKey: "physio_sessions",
  moduleName: "Physiotherapy",
  navItems: [
    { href: "/physiotherapist/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/physiotherapist/exercise-programs", label: "Exercise Programs", icon: Dumbbell, requiredFeature: "exercise_programs" },
    { href: "/physiotherapist/sessions", label: "Session Tracking", icon: ClipboardList, requiredFeature: "physio_sessions" },
    { href: "/physiotherapist/progress-photos", label: "Progress Photos", icon: Camera, requiredFeature: "progress_photos" },
  ],
};

export default function PhysiotherapistLayout({
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
