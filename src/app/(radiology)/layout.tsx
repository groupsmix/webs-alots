"use client";

import {
  LayoutDashboard, ClipboardList, Image, Eye, FileText,
  FileStack, Scan,
} from "lucide-react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";

const config: ClinicDashboardConfig = {
  title: "Radiology",
  shortTitle: "Radiology Center",
  icon: Scan,
  accentColor: "indigo-600",
  featureKey: "radiology_reports",
  moduleName: "Radiology",
  navItems: [
    { href: "/radiology/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/radiology/orders", label: "Study Orders", icon: ClipboardList },
    { href: "/radiology/images", label: "Image Gallery", icon: Image },
    { href: "/radiology/viewer", label: "DICOM Viewer", icon: Eye },
    { href: "/radiology/reports", label: "Reports", icon: FileText },
    { href: "/radiology/templates", label: "Report Templates", icon: FileStack },
  ],
};

export default function RadiologyLayout({
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
