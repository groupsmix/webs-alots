"use client";

import { Building2, CreditCard, LayoutDashboard, Receipt } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { OltigoMonogram } from "@/components/brand/oltigo-mark";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { MobileTabBar } from "@/components/layouts/mobile-tab-bar";
import type { MobileTabItem } from "@/components/layouts/mobile-tab-bar";
import { SuperAdminHeader } from "@/components/layouts/super-admin-header";
import { SuperAdminSidebarNav } from "@/components/layouts/super-admin-sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { HelpFeedback } from "@/components/support/help-feedback";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function SuperAdminLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const superAdminMobileTabs: MobileTabItem[] = [
    { href: "/super-admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { href: "/super-admin/clinics", label: "Cliniques", icon: Building2 },
    { href: "/super-admin/billing", label: "Facturation", icon: CreditCard },
    { href: "/super-admin/subscriptions", label: "Abonnts", icon: Receipt },
  ];

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 border-r bg-card p-4 md:flex md:flex-col">
          <div className="flex items-center gap-2 mb-6">
            <OltigoMonogram size="sm" />
            <div>
              <h2 className="text-sm font-semibold">Tableau de contrôle</h2>
              <p className="text-[10px] text-muted-foreground">Super Admin</p>
            </div>
          </div>

          <SuperAdminSidebarNav pathname={pathname} />

          <div className="mt-auto pt-6 border-t">
            <SignOutButton />
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <SuperAdminHeader onMenuOpen={() => setMobileOpen(true)} />

          <main id="main-content" className="flex-1 min-w-0 p-4 pb-20 md:p-6 md:pb-6">
            {children}
          </main>
        </div>

        {/* Mobile bottom tab bar */}
        <MobileTabBar tabs={superAdminMobileTabs} onMoreClick={() => setMobileOpen(true)} />

        {/* Mobile Sidebar Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" onClose={() => setMobileOpen(false)}>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <OltigoMonogram size="sm" />
                Tableau de contrôle
              </SheetTitle>
            </SheetHeader>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard interaction handled by parent or child interactive element */}
            <div className="mt-6" onClick={() => setMobileOpen(false)}>
              <SuperAdminSidebarNav pathname={pathname} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <HelpFeedback />
    </div>
  );
}
