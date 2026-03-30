"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  History,
  Pill,
  FileText,
  CreditCard,
  Users,
  Bell,
  MessageSquare,
  Menu,
  X,
  Heart,
  ClipboardList,
  Camera,
  CreditCard as CreditCardIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-switcher";
import { t, type TranslationKey } from "@/lib/i18n";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";
import { signOut } from "@/lib/auth";
import { AutoBreadcrumb } from "@/components/ui/auto-breadcrumb";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { href: "/patient/dashboard", labelKey: "patientNav.dashboard", icon: LayoutDashboard },
  { href: "/patient/appointments", labelKey: "patientNav.appointments", icon: Calendar },
  { href: "/patient/medical-history", labelKey: "patientNav.medicalHistory", icon: History },
  { href: "/patient/prescriptions", labelKey: "patientNav.prescriptions", icon: Pill },
  { href: "/patient/documents", labelKey: "patientNav.documents", icon: FileText },
  { href: "/patient/invoices", labelKey: "patientNav.invoices", icon: CreditCard },
  { href: "/patient/family", labelKey: "patientNav.family", icon: Users },
  { href: "/patient/notifications", labelKey: "patientNav.notifications", icon: Bell },
  { href: "/patient/feedback", labelKey: "patientNav.feedback", icon: MessageSquare },
  { href: "/patient/treatment-plan", labelKey: "patientNav.treatmentPlan", icon: ClipboardList },
  { href: "/patient/tooth-map", labelKey: "patientNav.toothMap", icon: Heart },
  { href: "/patient/before-after", labelKey: "patientNav.beforeAfter", icon: Camera },
  { href: "/patient/payment-plan", labelKey: "patientNav.paymentPlan", icon: CreditCardIcon },
];

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locale] = useLocale();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 border-r bg-card p-4 md:flex md:flex-col">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Heart className="h-4 w-4 text-primary-foreground" />
          </div>
          <h2 className="text-lg font-semibold">{t(locale, "patientNav.title")}</h2>
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {t(locale, item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="pt-4 border-t">
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b p-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">{t(locale, "patientNav.title")}</span>
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

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-card p-4 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <Heart className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold">{t(locale, "patientNav.title")}</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {t(locale, item.labelKey)}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-6 pt-4 border-t">
                <SignOutButton />
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6">
          <AutoBreadcrumb />
          {children}
        </main>
      </div>
      <SessionTimeoutWarning onLogout={() => signOut()} />
    </div>
  );
}
