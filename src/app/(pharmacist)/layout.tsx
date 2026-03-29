"use client";

import {
  LayoutDashboard, ClipboardList, Package, ShoppingCart,
  Receipt, AlertTriangle, Gift, Pill,
  Truck,
} from "lucide-react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";

const config: ClinicDashboardConfig = {
  title: "Pharmacist",
  shortTitle: "Pharmacist Dashboard",
  icon: Pill,
  accentColor: "emerald-600",
  navItems: [
    { href: "/pharmacist/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pharmacist/prescriptions", label: "Prescriptions", icon: ClipboardList },
    { href: "/pharmacist/stock", label: "Stock Management", icon: Package },
    { href: "/pharmacist/orders", label: "Purchase Orders", icon: ShoppingCart },
    { href: "/pharmacist/sales", label: "Daily Sales", icon: Receipt },
    { href: "/pharmacist/expiry", label: "Expiry Tracker", icon: AlertTriangle },
    { href: "/pharmacist/suppliers", label: "Suppliers", icon: Truck },
    { href: "/pharmacist/loyalty", label: "Loyalty Program", icon: Gift },
  ],
};

export default function PharmacistLayout({
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
