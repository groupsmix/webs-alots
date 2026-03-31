"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserCog, Stethoscope, Settings, BarChart3, Star, Users, CalendarOff, Bell, Clock, UserCheck, Palette, Paintbrush, Menu, X, CreditCard, LayoutTemplate, ToggleRight, Building2, BedDouble, Monitor, Boxes, FileText } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { useClinicFeatures } from "@/lib/hooks/use-clinic-features";
import type { ClinicFeatureKey } from "@/lib/features";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-provider";
import { GettingStartedChecklist } from "@/components/onboarding/getting-started-checklist";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";
import { signOut } from "@/lib/auth";
import { AutoBreadcrumb } from "@/components/ui/auto-breadcrumb";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";
import { MobileMenuOverlay } from "@/components/layouts/mobile-menu-overlay";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When set, this item is only shown if the feature is enabled. */
  requiredFeature?: ClinicFeatureKey;
}

const navItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/doctors", label: "Doctors", icon: UserCog },
  { href: "/admin/services", label: "Services & Prices", icon: Stethoscope, requiredFeature: "appointments" },
  { href: "/admin/working-hours", label: "Working Hours", icon: Clock, requiredFeature: "appointments" },
  { href: "/admin/holidays", label: "Holidays / Closures", icon: CalendarOff, requiredFeature: "appointments" },
  { href: "/admin/receptionists", label: "Receptionists", icon: UserCheck },
  { href: "/admin/patients", label: "Patient Database", icon: Users },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/branding", label: "Branding", icon: Paintbrush },
  { href: "/admin/templates", label: "Layout Templates", icon: LayoutTemplate },
  { href: "/admin/sections", label: "Section Control", icon: ToggleRight },
  { href: "/admin/website-editor", label: "Website Editor", icon: Palette },
  { href: "/admin/billing", label: "Billing & Plan", icon: CreditCard },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  // Phase 6: Clinics & Centers
  { href: "/admin/departments", label: "Departments", icon: Building2, requiredFeature: "departments" },
  { href: "/admin/beds", label: "Bed Management", icon: BedDouble, requiredFeature: "bed_management" },
  { href: "/admin/machines", label: "Dialysis Machines", icon: Monitor, requiredFeature: "dialysis_machines" },
  { href: "/admin/lab-materials", label: "Lab Materials", icon: Boxes, requiredFeature: "lab_materials" },
  { href: "/admin/lab-invoices", label: "Lab Invoices", icon: FileText, requiredFeature: "lab_invoices" },
];

function OnboardingChecklistSidebar() {
  const { state, loading, dismiss, reshow } = useOnboarding();

  if (loading || !state) return null;

  return (
    <div className="mb-4">
      <GettingStartedChecklist
        completedSteps={state.completedSteps}
        dismissed={state.tourDismissed}
        onDismiss={dismiss}
        onReshow={reshow}
      />
    </div>
  );
}

function OnboardingTourOverlay() {
  const { state, showTour, dismiss, markComplete } = useOnboarding();

  if (!showTour || !state) return null;

  return (
    <OnboardingTour
      completedSteps={state.completedSteps}
      onDismiss={dismiss}
      onStepComplete={markComplete}
    />
  );
}

function SidebarContent({ pathname, onNavClick }: { pathname: string; onNavClick?: () => void }) {
  const { hasFeature } = useClinicFeatures();

  const visibleItems = navItems.filter(
    (item) => !item.requiredFeature || hasFeature(item.requiredFeature),
  );

  return (
    <>
      <OnboardingChecklistSidebar />
      <nav className="space-y-1 flex-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locale] = useLocale();

  return (
    <OnboardingProvider>
    <div className="flex min-h-screen">
      {/* Skip to content link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        {t(locale, "nav.skipToContent")}
      </a>
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-semibold">{t(locale, "nav.clinicAdmin")}</h2>
      </div>

      {/* Mobile sidebar overlay — A11Y-01: Escape key + focus trapping */}
      {mobileOpen && (
        <MobileMenuOverlay onClose={() => setMobileOpen(false)}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t(locale, "nav.clinicAdmin")}</h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavClick={() => setMobileOpen(false)} />
        </MobileMenuOverlay>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 border-r bg-card p-4 md:flex md:flex-col">
        <h2 className="text-lg font-semibold mb-6">{t(locale, "nav.clinicAdmin")}</h2>
        <SidebarContent pathname={pathname} />
      </aside>

      <main id="main-content" className="flex-1 p-6 pt-16 md:pt-6">
        <AutoBreadcrumb />
        {children}
      </main>
      <OnboardingTourOverlay />
      <SessionTimeoutWarning onLogout={() => signOut()} />
    </div>
    </OnboardingProvider>
  );
}
