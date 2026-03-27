"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Glasses, Package, FileText,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { useClinicFeatures } from "@/lib/hooks/use-clinic-features";
import type { ClinicFeatureKey } from "@/lib/features";
import { FeatureGate } from "@/components/feature-gate";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredFeature?: ClinicFeatureKey;
}

const navItems: NavItem[] = [
  { href: "/optician/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/optician/lens-inventory", label: "Lens Inventory", icon: Package, requiredFeature: "lens_inventory" },
  { href: "/optician/frame-catalog", label: "Frame Catalog", icon: Glasses, requiredFeature: "frame_catalog" },
  { href: "/optician/prescriptions", label: "Prescriptions", icon: FileText, requiredFeature: "optical_prescriptions" },
];

export default function OpticianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { hasFeature } = useClinicFeatures();

  const visibleItems = navItems.filter(
    (item) => !item.requiredFeature || hasFeature(item.requiredFeature),
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-card p-4 md:block">
        <h2 className="text-lg font-semibold mb-6">Opticien</h2>
        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
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
        <div className="mt-auto pt-6 border-t mt-6">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">
        <FeatureGate featureKey="lens_inventory" moduleName="Optician">
          {children}
        </FeatureGate>
      </main>
    </div>
  );
}
