"use client";

import {
  Activity,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Menu,
  Settings,
  Sparkles,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { OltigoMonogram } from "@/components/brand/oltigo-mark";
import { AdminHeaderBar } from "@/components/layouts/admin-layout-shell-with-bell";
import { MobileMenuOverlay } from "@/components/layouts/mobile-menu-overlay";
import { MobileTabBar } from "@/components/layouts/mobile-tab-bar";
import type { MobileTabItem } from "@/components/layouts/mobile-tab-bar";
import { useLocale } from "@/components/locale-switcher";
import { GettingStartedChecklist } from "@/components/onboarding/getting-started-checklist";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/onboarding-provider";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";
import { SignOutButton } from "@/components/sign-out-button";
import { HelpFeedback } from "@/components/support/help-feedback";
import { AutoBreadcrumb } from "@/components/ui/auto-breadcrumb";
import { signOut } from "@/lib/auth";
import type { ClinicFeatureKey } from "@/lib/features";
import { useClinicFeatures } from "@/lib/hooks/use-clinic-features";
import { t } from "@/lib/i18n";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredFeature?: ClinicFeatureKey;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "admin.navGroup.manage",
    items: [
      { href: "/admin/dashboard", label: "admin.nav.today", icon: LayoutDashboard },
      { href: "/admin/agenda", label: "admin.nav.agenda", icon: CalendarDays },
      { href: "/admin/patients", label: "admin.nav.patients", icon: Users },
      { href: "/admin/analytics", label: "admin.nav.performance", icon: Activity },
      { href: "/admin/financial-summary", label: "admin.nav.payments", icon: CircleDollarSign },
      { href: "/admin/doctors", label: "admin.nav.team", icon: Stethoscope },
    ],
  },
  {
    label: "admin.navGroup.grow",
    items: [
      { href: "/admin/marketing", label: "admin.nav.growth", icon: Megaphone },
      { href: "/admin/website", label: "admin.nav.website", icon: Globe },
    ],
  },
  {
    label: "admin.navGroup.tools",
    items: [
      { href: "/admin/support", label: "admin.nav.support", icon: LifeBuoy },
      { href: "/admin/ai", label: "admin.nav.assistant", icon: Sparkles },
      { href: "/admin/billing", label: "admin.nav.subscription", icon: CreditCard },
      { href: "/admin/settings", label: "admin.nav.settings", icon: Settings },
    ],
  },
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

function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Match sub-routes (e.g. /admin/settings/chatbot matches /admin/settings)
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return false;
}

function SidebarContent({ pathname, onNavClick }: { pathname: string; onNavClick?: () => void }) {
  const { hasFeature } = useClinicFeatures();
  const [locale] = useLocale();

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.requiredFeature || hasFeature(item.requiredFeature),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <OnboardingChecklistSidebar />
      <nav className="flex-1 space-y-5">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t(locale, group.label)}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = isNavActive(pathname, item.href);
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
                    <span className="flex-1">{t(locale, item.label)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="pt-6 border-t mt-6">
        <SignOutButton />
      </div>
    </>
  );
}

export default function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locale] = useLocale();

  const adminMobileTabs: MobileTabItem[] = [
    { href: "/admin/dashboard", label: "admin.mobile.today", icon: LayoutDashboard },
    { href: "/admin/agenda", label: "admin.mobile.agenda", icon: CalendarDays },
    { href: "/admin/patients", label: "admin.mobile.patients", icon: Users },
    {
      href: "/admin/financial-summary",
      label: "admin.mobile.payments",
      icon: CircleDollarSign,
    },
  ];

  return (
    <OnboardingProvider>
      <div className="flex min-h-screen overflow-x-hidden">
        {/* Skip to content link for keyboard accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium"
        >
          {t(locale, "nav.skipToContent")}
        </a>
        {/* Mobile header bar */}
        <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <OltigoMonogram size="sm" />
          <h2 className="text-sm font-semibold">{t(locale, "nav.clinicAdmin")}</h2>
        </div>

        {/* Mobile sidebar overlay — A11Y-01: Escape key + focus trapping */}
        {mobileOpen && (
          <MobileMenuOverlay onClose={() => setMobileOpen(false)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <OltigoMonogram size="sm" />
                <h2 className="text-lg font-semibold">{t(locale, "nav.clinicAdmin")}</h2>
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
          </MobileMenuOverlay>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-e bg-card p-4 md:flex md:flex-col">
          <div className="flex items-center gap-2 mb-6">
            <OltigoMonogram size="sm" />
            <h2 className="text-lg font-semibold">{t(locale, "nav.clinicAdmin")}</h2>
          </div>
          <SidebarContent pathname={pathname} />
        </aside>

        <AdminHeaderBar />
        <main id="main-content" className="flex-1 min-w-0 p-4 pt-16 pb-20 md:p-6 md:pb-6 md:pt-18">
          <AutoBreadcrumb />
          {children}
        </main>
        <OnboardingTourOverlay />
        <SessionTimeoutWarning onLogout={() => signOut()} />

        {/* Mobile bottom tab bar */}
        <MobileTabBar tabs={adminMobileTabs} onMoreClick={() => setMobileOpen(true)} />
        <HelpFeedback />
      </div>
    </OnboardingProvider>
  );
}
