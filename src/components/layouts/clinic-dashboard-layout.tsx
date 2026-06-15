"use client";

import { Menu, X } from "lucide-react";
type LucideIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { OltigoMonogram } from "@/components/brand/oltigo-mark";
import { FeatureGate } from "@/components/feature-gate";
import { MobileTabBar } from "@/components/layouts/mobile-tab-bar";
import type { MobileTabItem } from "@/components/layouts/mobile-tab-bar";
import { SignOutButton } from "@/components/sign-out-button";
import type { ClinicFeatureKey } from "@/lib/features";

interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  requiredFeature?: string;
}

export interface ClinicDashboardConfig {
  /** Display title for the sidebar header */
  title: string;
  /** Short title for mobile header */
  shortTitle?: string;
  /** Icon component for the sidebar header */
  icon: LucideIcon;
  /** Tailwind color class for active state (e.g. "blue-600") */
  accentColor: string;
  /** Navigation items */
  navItems: DashboardNavItem[];
  /** Primary tabs shown in the mobile bottom tab bar (max 4 recommended) */
  mobileTabs?: MobileTabItem[];
  /** FeatureGate featureKey for the module */
  featureKey?: ClinicFeatureKey;
  /** FeatureGate moduleName for the module */
  moduleName?: string;
}

function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return false;
}

function SidebarContent({
  config,
  pathname,
  onNavClick,
}: {
  config: ClinicDashboardConfig;
  pathname: string;
  onNavClick?: () => void;
}) {
  return (
    <>
      <nav className="space-y-1 flex-1">
        {config.navItems.map((item) => {
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

export function ClinicDashboardLayout({
  config,
  children,
}: {
  config: ClinicDashboardConfig;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const shortTitle = config.shortTitle ?? config.title;

  const content = config.featureKey ? (
    <FeatureGate featureKey={config.featureKey} moduleName={config.moduleName ?? config.title}>
      {children}
    </FeatureGate>
  ) : (
    children
  );

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
          <OltigoMonogram size="sm" />
          <h2 className="text-sm font-semibold">{shortTitle}</h2>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard interaction handled by parent or child interactive element */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card p-4 flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <OltigoMonogram size="sm" />
                <h2 className="text-lg font-semibold">{config.title}</h2>
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
              config={config}
              pathname={pathname}
              onNavClick={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 border-r bg-card p-4 md:flex md:flex-col">
        <div className="flex items-center gap-2 mb-6">
          <OltigoMonogram size="sm" />
          <h2 className="text-lg font-semibold">{config.title}</h2>
        </div>
        <SidebarContent config={config} pathname={pathname} />
      </aside>

      <main
        id="main-content"
        className={`flex-1 ${config.mobileTabs ? "p-4 pt-16 pb-20 md:p-6 md:pb-6" : "p-6 pt-16 md:pt-6"}`}
      >
        {content}
      </main>

      {/* Mobile bottom tab bar */}
      {config.mobileTabs && (
        <MobileTabBar tabs={config.mobileTabs} onMoreClick={() => setMobileOpen(true)} />
      )}
    </div>
  );
}
