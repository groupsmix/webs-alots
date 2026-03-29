"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { FeatureGate } from "@/components/feature-gate";
import type { LucideIcon } from "lucide-react";
import type { ClinicFeatureKey } from "@/lib/features";

export interface DashboardNavItem {
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
  /** FeatureGate featureKey for the module */
  featureKey?: ClinicFeatureKey;
  /** FeatureGate moduleName for the module */
  moduleName?: string;
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
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? `bg-${config.accentColor}/10 text-${config.accentColor} font-medium`
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
  const IconComponent = config.icon;
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
          <IconComponent className={`h-4 w-4 text-${config.accentColor}`} />
          <h2 className="text-sm font-semibold">{shortTitle}</h2>
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
                <IconComponent className={`h-5 w-5 text-${config.accentColor}`} />
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
          <div className={`h-8 w-8 rounded-lg bg-${config.accentColor} flex items-center justify-center`}>
            <IconComponent className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-lg font-semibold">{config.title}</h2>
        </div>
        <SidebarContent config={config} pathname={pathname} />
      </aside>

      <main className="flex-1 p-6 pt-16 md:pt-6">
        {content}
      </main>
    </div>
  );
}
