"use client";

import {
  LayoutDashboard,
  CalendarDays,
  CalendarClock,
  Clock,
  Users,
  MessageSquare,
  FileBadge,
  Share2,
  CreditCard,
  Wallet,
  Package,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { OltigoMonogram } from "@/components/brand/oltigo-mark";
import { MobileMenuOverlay } from "@/components/layouts/mobile-menu-overlay";
import { MobileTabBar } from "@/components/layouts/mobile-tab-bar";
import type { MobileTabItem } from "@/components/layouts/mobile-tab-bar";
import { useLocale } from "@/components/locale-switcher";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";
import { SignOutButton } from "@/components/sign-out-button";
import { HelpFeedback } from "@/components/support/help-feedback";
import { AutoBreadcrumb } from "@/components/ui/auto-breadcrumb";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { t, type TranslationKey } from "@/lib/i18n";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  labelKey: TranslationKey;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    labelKey: "doctorNav.general",
    items: [
      { href: "/doctor/dashboard", labelKey: "doctorNav.dashboard", icon: LayoutDashboard },
      { href: "/doctor/schedule", labelKey: "doctorNav.schedule", icon: CalendarDays },
      { href: "/doctor/slots", labelKey: "doctorNav.availableSlots", icon: CalendarClock },
      { href: "/doctor/waiting-room", labelKey: "doctorNav.waitingRoom", icon: Clock },
      { href: "/doctor/patients", labelKey: "doctorNav.myPatients", icon: Users },
      { href: "/doctor/chat", labelKey: "doctorNav.chat", icon: MessageSquare },
    ],
  },
  {
    labelKey: "doctorNav.clinical",
    items: [
      { href: "/doctor/certificates", labelKey: "doctorNav.certificates", icon: FileBadge },
      { href: "/doctor/referrals", labelKey: "doctorNav.referrals", icon: Share2 },
    ],
  },
  {
    labelKey: "doctorNav.finance",
    items: [
      { href: "/doctor/installments", labelKey: "doctorNav.installments", icon: CreditCard },
      { href: "/doctor/patient-finance", labelKey: "doctorNav.patientFinance", icon: Wallet },
      { href: "/doctor/inventory", labelKey: "doctorNav.inventory", icon: Package },
      { href: "/doctor/analytics", labelKey: "doctorNav.analytics", icon: BarChart3 },
    ],
  },
];

function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return false;
}

function DoctorNav({ pathname, onNavClick }: { pathname: string; onNavClick?: () => void }) {
  const [locale] = useLocale();

  return (
    <nav className="flex-1 space-y-5">
      {navGroups.map((group) => (
        <div key={group.labelKey}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t(locale, group.labelKey)}
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
                  <span className="flex-1">{t(locale, item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function DoctorLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locale] = useLocale();

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }

  const doctorMobileTabs: MobileTabItem[] = [
    { href: "/doctor/dashboard", label: t(locale, "doctorNav.dashboard"), icon: LayoutDashboard },
    { href: "/doctor/schedule", label: t(locale, "doctorNav.schedule"), icon: CalendarDays },
    { href: "/doctor/patients", label: t(locale, "doctorNav.myPatients"), icon: Users },
    { href: "/doctor/waiting-room", label: t(locale, "doctorNav.waitingRoom"), icon: Clock },
  ];

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      {/* Skip to content link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        {t(locale, "nav.skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-e bg-card p-4 md:flex md:flex-col">
        <div className="flex items-center gap-2 mb-6">
          <OltigoMonogram size="sm" />
          <h2 className="text-lg font-semibold">{t(locale, "doctorNav.title")}</h2>
        </div>
        <DoctorNav pathname={pathname} />
        <div className="pt-6 border-t mt-6">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b p-3 md:hidden">
          <div className="flex items-center gap-2">
            <OltigoMonogram size="sm" />
            <span className="font-semibold text-sm">{t(locale, "doctorNav.title")}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile Menu Overlay — Escape key + focus trapping */}
        {mobileMenuOpen && (
          <MobileMenuOverlay onClose={() => setMobileMenuOpen(false)}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <OltigoMonogram size="sm" />
                <h2 className="text-lg font-semibold">{t(locale, "doctorNav.title")}</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <DoctorNav pathname={pathname} onNavClick={() => setMobileMenuOpen(false)} />
            <div className="mt-6 pt-4 border-t">
              <SignOutButton />
            </div>
          </MobileMenuOverlay>
        )}

        <main id="main-content" className="flex-1 min-w-0 p-4 pb-20 md:p-6 md:pb-6">
          <AutoBreadcrumb />
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar tabs={doctorMobileTabs} onMoreClick={() => setMobileMenuOpen(true)} />

      <SessionTimeoutWarning onLogout={() => signOut()} />
      <HelpFeedback />
    </div>
  );
}
