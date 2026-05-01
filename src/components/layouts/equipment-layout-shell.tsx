"use client";

import {
  LayoutDashboard, Package, HandCoins, Wrench,
  Menu, X, Stethoscope, Languages,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, createContext, useContext, useCallback } from "react";
import { FeatureGate } from "@/components/feature-gate";
import { SignOutButton } from "@/components/sign-out-button";

export type EquipmentLocale = "fr" | "ar";

interface EquipmentI18nContextValue {
  locale: EquipmentLocale;
  setLocale: (l: EquipmentLocale) => void;
  toggleLocale: () => void;
  isRtl: boolean;
}

const EquipmentI18nContext = createContext<EquipmentI18nContextValue>({
  locale: "fr",
  setLocale: () => {},
  toggleLocale: () => {},
  isRtl: false,
});

export function useEquipmentLocale() {
  return useContext(EquipmentI18nContext);
}

const navLabels: Record<string, Record<EquipmentLocale, string>> = {
  "/equipment/dashboard": { fr: "Tableau de bord", ar: "\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645" },
  "/equipment/inventory": { fr: "Inventaire", ar: "\u0627\u0644\u0645\u062E\u0632\u0648\u0646" },
  "/equipment/rentals": { fr: "Locations", ar: "\u0627\u0644\u0625\u064A\u062C\u0627\u0631\u0627\u062A" },
  "/equipment/maintenance": { fr: "Maintenance", ar: "\u0627\u0644\u0635\u064A\u0627\u0646\u0629" },
};

const navItems = [
  { href: "/equipment/dashboard", icon: LayoutDashboard },
  { href: "/equipment/inventory", icon: Package },
  { href: "/equipment/rentals", icon: HandCoins },
  { href: "/equipment/maintenance", icon: Wrench },
];

function SidebarContent({
  pathname,
  locale,
  onNavClick,
}: {
  pathname: string;
  locale: EquipmentLocale;
  onNavClick?: () => void;
}) {
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
                  ? "bg-amber-600/10 text-amber-600 font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {navLabels[item.href]?.[locale] ?? item.href}
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

export default function EquipmentLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locale, setLocale] = useState<EquipmentLocale>("fr");

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === "fr" ? "ar" : "fr"));
  }, []);

  const isRtl = locale === "ar";
  const title = locale === "fr" ? "Mat\u00E9riel M\u00E9dical" : "\u0645\u0639\u062F\u0627\u062A \u0637\u0628\u064A\u0629";
  const shortTitle = locale === "fr" ? "Mat\u00E9riel" : "\u0645\u0639\u062F\u0627\u062A";

  return (
    <EquipmentI18nContext.Provider value={{ locale, setLocale, toggleLocale, isRtl }}>
      <div className="flex min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
        {/* Mobile header */}
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Stethoscope className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold">{shortTitle}</h2>
          </div>
          <button
            onClick={toggleLocale}
            className="rounded-md p-1.5 hover:bg-muted flex items-center gap-1 text-xs text-muted-foreground"
            aria-label="Toggle language"
          >
            <Languages className="h-4 w-4" />
            {locale === "fr" ? "\u0639\u0631\u0628\u064A" : "FR"}
          </button>
        </div>

        {/* Mobile sidebar */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard interaction handled by parent or child interactive element */}
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card p-4 flex flex-col shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-amber-600" />
                  <h2 className="text-lg font-semibold">{shortTitle}</h2>
                </div>
                <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 hover:bg-muted" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent pathname={pathname} locale={locale} onNavClick={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden w-64 border-r bg-card p-4 md:flex md:flex-col">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold flex-1">{title}</h2>
            <button
              onClick={toggleLocale}
              className="rounded-md p-1.5 hover:bg-muted flex items-center gap-1 text-xs text-muted-foreground"
              title={locale === "fr" ? "Switch to Arabic" : "Passer au fran\u00E7ais"}
            >
              <Languages className="h-4 w-4" />
              {locale === "fr" ? "\u0639\u0631\u0628\u064A" : "FR"}
            </button>
          </div>
          <SidebarContent pathname={pathname} locale={locale} />
        </aside>

        <main id="main-content" className="flex-1 p-6 pt-16 md:pt-6">
          <FeatureGate featureKey="equipment_rentals" moduleName="Medical Equipment">
            {children}
          </FeatureGate>
        </main>
      </div>
    </EquipmentI18nContext.Provider>
  );
}
