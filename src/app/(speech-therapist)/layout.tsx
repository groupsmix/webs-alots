"use client";

import {
  LayoutDashboard, BookOpen, FileText, ClipboardList,
} from "lucide-react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";

const config: ClinicDashboardConfig = {
  title: "Orthophoniste",
  icon: ClipboardList,
  accentColor: "orange-600",
  featureKey: "speech_sessions",
  moduleName: "Speech Therapy",
  navItems: [
    { href: "/speech-therapist/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/speech-therapist/sessions", label: "Sessions", icon: ClipboardList, requiredFeature: "speech_sessions" },
    { href: "/speech-therapist/exercise-library", label: "Exercise Library", icon: BookOpen, requiredFeature: "speech_exercises" },
    { href: "/speech-therapist/reports", label: "Progress Reports", icon: FileText, requiredFeature: "speech_reports" },
  ],
};

export default function SpeechTherapistLayout({
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
