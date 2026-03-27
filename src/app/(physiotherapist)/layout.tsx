"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Dumbbell, ClipboardList, Camera,
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
  { href: "/physiotherapist/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/physiotherapist/exercise-programs", label: "Exercise Programs", icon: Dumbbell, requiredFeature: "exercise_programs" },
  { href: "/physiotherapist/sessions", label: "Session Tracking", icon: ClipboardList, requiredFeature: "physio_sessions" },
  { href: "/physiotherapist/progress-photos", label: "Progress Photos", icon: Camera, requiredFeature: "progress_photos" },
];

export default function PhysiotherapistLayout({
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
        <h2 className="text-lg font-semibold mb-6">Kinésithérapeute</h2>
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
        <FeatureGate featureKey="physio_sessions" moduleName="Physiotherapy">
          {children}
        </FeatureGate>
      </main>
    </div>
  );
}
