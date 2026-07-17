"use client";

import {
  LayoutDashboard,
  ClipboardList,
  Package,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  Gift,
  Pill,
  Truck,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";
import type { MobileTabItem } from "@/components/layouts/mobile-tab-bar";

const pharmacistMobileTabs: MobileTabItem[] = [
  { href: "/pharmacist/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/pharmacist/prescriptions",
    label: "Prescriptions",
    icon: ClipboardList,
    requiredFeature: "prescriptions",
  },
  { href: "/pharmacist/stock", label: "Stock", icon: Package, requiredFeature: "stock" },
  { href: "/pharmacist/sales", label: "Sales", icon: Receipt, requiredFeature: "sales" },
];

const config: ClinicDashboardConfig = {
  title: "Pharmacist",
  shortTitle: "Pharmacist Dashboard",
  icon: Pill,
  accentColor: "emerald-600",
  navItems: [
    { href: "/pharmacist/dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      href: "/pharmacist/prescriptions",
      label: "Prescriptions",
      icon: ClipboardList,
      requiredFeature: "prescriptions",
    },
    {
      href: "/pharmacist/stock",
      label: "Stock",
      icon: Package,
      requiredFeature: "stock",
    },
    {
      href: "/pharmacist/orders",
      label: "Restock",
      icon: ShoppingCart,
      requiredFeature: "stock",
    },
    { href: "/pharmacist/sales", label: "Daily Sales", icon: Receipt, requiredFeature: "sales" },
    {
      href: "/pharmacist/expiry",
      label: "Expiring soon",
      icon: AlertTriangle,
      requiredFeature: "stock",
    },
    { href: "/pharmacist/suppliers", label: "Suppliers", icon: Truck, requiredFeature: "stock" },
    { href: "/pharmacist/loyalty", label: "Loyalty", icon: Gift, requiredFeature: "sales" },
  ],
  mobileTabs: pharmacistMobileTabs,
};

export function PharmacistLayoutShell({ children }: { children: ReactNode }) {
  return <ClinicDashboardLayout config={config}>{children}</ClinicDashboardLayout>;
}
