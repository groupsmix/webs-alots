"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Package, ShoppingCart,
  Receipt, AlertTriangle, Gift, Pill, Menu, X,
  Truck,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

const navItems = [
  { href: "/pharmacist/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pharmacist/prescriptions", label: "Prescriptions", icon: ClipboardList },
  { href: "/pharmacist/stock", label: "Stock Management", icon: Package },
  { href: "/pharmacist/orders", label: "Purchase Orders", icon: ShoppingCart },
  { href: "/pharmacist/sales", label: "Daily Sales", icon: Receipt },
  { href: "/pharmacist/expiry", label: "Expiry Tracker", icon: AlertTriangle },
  { href: "/pharmacist/suppliers", label: "Suppliers", icon: Truck },
  { href: "/pharmacist/loyalty", label: "Loyalty Program", icon: Gift },
];

function SidebarContent({ pathname, onNavClick }: { pathname: string; onNavClick?: () => void }) {
  return (
    <>
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-emerald-600/10 text-emerald-600 font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="pt-6 border-t mt-6">
        <SignOutButton />
      </div>
    </>
  );
}

export default function PharmacistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Pill className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold">Pharmacist Dashboard</h2>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card p-4 flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">Pharmacist</h2>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 border-r bg-card p-4 md:flex md:flex-col">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Pill className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-lg font-semibold">Pharmacist</h2>
        </div>
        <SidebarContent pathname={pathname} />
      </aside>

      <main className="flex-1 p-6 pt-16 md:pt-6">{children}</main>
    </div>
  );
}
