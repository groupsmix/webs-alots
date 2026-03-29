"use client";

import {
  LayoutDashboard, Glasses, Package, FileText,
} from "lucide-react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";

const config: ClinicDashboardConfig = {
  title: "Opticien",
  icon: Glasses,
  accentColor: "blue-600",
  featureKey: "lens_inventory",
  moduleName: "Optician",
  navItems: [
    { href: "/optician/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/optician/lens-inventory", label: "Lens Inventory", icon: Package, requiredFeature: "lens_inventory" },
    { href: "/optician/frame-catalog", label: "Frame Catalog", icon: Glasses, requiredFeature: "frame_catalog" },
    { href: "/optician/prescriptions", label: "Prescriptions", icon: FileText, requiredFeature: "optical_prescriptions" },
  ],
};

export default function OpticianLayout({
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
