"use client";

import {
  LayoutDashboard, Brain, Target, TrendingUp,
} from "lucide-react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";

const config: ClinicDashboardConfig = {
  title: "Psychologue",
  icon: Brain,
  accentColor: "purple-600",
  featureKey: "therapy_notes",
  moduleName: "Psychology",
  navItems: [
    { href: "/psychologist/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/psychologist/session-notes", label: "Session Notes", icon: Brain, requiredFeature: "therapy_notes" },
    { href: "/psychologist/therapy-plans", label: "Therapy Plans", icon: Target, requiredFeature: "therapy_plans" },
    { href: "/psychologist/progress", label: "Progress Tracking", icon: TrendingUp },
  ],
};

export default function PsychologistLayout({
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
