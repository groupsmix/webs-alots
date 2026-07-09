"use client";

import {
  LayoutDashboard,
  Package,
  HandCoins,
  Wrench,
  Menu,
  X,
  Languages,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, createContext, useContext, useCallback } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { OltigoMonogram } from "@/components/brand/oltigo-mark";
import { MobileTabBar } from "@/components/layouts/mobile-tab-bar";
import { useLocale } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import type { ClinicFeatureKey } from "@/lib/features";
import { useClinicFeatures } from "@/lib/hooks/use-clinic-features";
import { t } from "@/lib/i18n";

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
  "/equipment/dashboard": {
    fr: "Tableau de bord",
    ar: "\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645",
  },
  "/equipment/inventory": { fr: "Inventaire", ar: "\u0627\u0644\u0645\u062E\u0632\u0648\u0646" },
  "/equipment/rentals": {
    fr: "Locations",
    ar: "\u0627\u0644\u0625\u064A\u062C\u0627\u0631\u0627\u062A",
  },
  "/equipment/maintenance": { fr: "Maintenance", ar: "\u0627\u0644\u0635\u064A\u0627\u0646\u0629" },
};

interface EquipmentNavItem {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  requiredFeature: ClinicFeatureKey;
}

const navItems: EquipmentNavItem[] = [
  { href: "/equipment/dashboard", icon: LayoutDashboard, requiredFeature: "equipment_rentals" },
  { href: "/equipment/inventory", icon: Package, requiredFeature: "equipment_rentals" },
  { href: "/equipment/rentals", icon: HandCoins, requiredFeature: "equipment_rentals" },
  { href: "/equipment/maintenance", icon: Wrench, requiredFeature: "equipment_maintenance" },
];

function requiredFeaturesForPathname(pathname: string): ClinicFeatureKey[] {
  if (pathname.startsWith("/equipment/maintenance")) return ["equipment_maintenance"];
  if (pathname.startsWith("/equipment/inventory") || pathname.startsWith("/equipment/rentals")) {
    return ["equipment_rentals"];
  }
  return ["equipment_rentals", "equipment_maintenance"];
}

function SidebarContent({
  pathname,
  locale,
  navItems,
  onNavClick,
}: {
  pathname: string;
  locale: EquipmentLocale;
  navItems: EquipmentNavItem[];
  onNavClick?: () => void;
}) {
  return (
    <>
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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

export default function EquipmentLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locale, setLocale] = useState<EquipmentLocale>("fr");
  const [appLocale] = useLocale();
  const { loaded, hasFeature } = useClinicFeatures();

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === "fr" ? "ar" : "fr"));
  }, []);

  const isRtl = locale === "ar";
  const visibleNavItems = navItems.filter((item) => hasFeature(item.requiredFeature));
  const routeEnabled = requiredFeaturesForPathname(pathname).some((feature) => hasFeature(feature));
  const title =
    locale === "fr"
      ? "Mat\u00E9riel M\u00E9dical"
      : "\u0645\u0639\u062F\u0627\u062A \u0637\u0628\u064A\u0629";
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
            <OltigoMonogram size="sm" />
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
                  <OltigoMonogram size="sm" />
                  <h2 className="text-lg font-semibold">{shortTitle}</h2>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-1 hover:bg-muted"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent
                pathname={pathname}
                locale={locale}
                navItems={visibleNavItems}
                onNavClick={() => setMobileOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden w-64 border-r bg-card p-4 md:flex md:flex-col">
          <div className="flex items-center gap-2 mb-6">
            <OltigoMonogram size="sm" />
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
          <SidebarContent pathname={pathname} locale={locale} navItems={visibleNavItems} />
        </aside>

        <main id="main-content" className="flex-1 p-4 pt-16 pb-20 md:p-6 md:pb-6">
          {!loaded ? (
            <div className="flex min-h-[200px] items-center justify-center" aria-busy="true">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : routeEnabled ? (
            children
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center px-4">
              <Card className="w-full max-w-md text-center">
                <CardContent className="p-8">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <ShieldAlert className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h2 className="mb-2 text-lg font-semibold">
                    {t(appLocale, "featureGate.notEnabled").replace("{module}", title)}
                  </h2>
                  <p className="mb-6 text-sm text-muted-foreground">
                    {t(appLocale, "featureGate.notAvailable")}
                  </p>
                  <Link
                    href="/admin/dashboard"
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {t(appLocale, "featureGate.backToDashboard")}
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}
        </main>

        {/* Mobile bottom tab bar */}
        {visibleNavItems.length ? (
          <MobileTabBar
            tabs={visibleNavItems.map((item) => ({
              href: item.href,
              label: navLabels[item.href]?.[locale] ?? item.href,
              icon: item.icon,
            }))}
            onMoreClick={() => setMobileOpen(true)}
          />
        ) : null}
      </div>
    </EquipmentI18nContext.Provider>
  );
}
