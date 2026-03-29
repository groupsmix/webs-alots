"use client";

import {
  LayoutDashboard, ShoppingBag, Receipt, Package,
} from "lucide-react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";

const config: ClinicDashboardConfig = {
  title: "Parapharmacy",
  icon: ShoppingBag,
  accentColor: "pink-600",
  featureKey: "parapharmacy",
  moduleName: "Parapharmacy",
  navItems: [
    { href: "/parapharmacy/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/parapharmacy/catalog", label: "Product Catalog", icon: ShoppingBag },
    { href: "/parapharmacy/sales", label: "Sales", icon: Receipt },
    { href: "/parapharmacy/inventory", label: "Inventory", icon: Package },
  ],
};

export default function ParapharmacyLayout({
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
