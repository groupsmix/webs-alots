"use client";

import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardRequiredFlags, getScopedDashboardForPathname } from "@/lib/config/verticals";
import { useClinicFeatures } from "@/lib/hooks/use-clinic-features";
import { t } from "@/lib/i18n";

interface RouteScopeGateProps {
  children: ReactNode;
}

function dashboardLabel(dashboard: string): string {
  const segment = dashboard.split("/").pop() ?? dashboard;
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Central route-level gate for ADR-0013 Architecture-B dashboard surfaces.
 *
 * Shared layouts mount this once for broad route groups (admin/doctor), while
 * `verticals.ts` remains the source of truth for which path segments are gated.
 */
export function RouteScopeGate({ children }: RouteScopeGateProps) {
  const pathname = usePathname();
  const [locale] = useLocale();
  const { loaded, hasFeature } = useClinicFeatures();
  const dashboard = getScopedDashboardForPathname(pathname);

  if (!dashboard) return <>{children}</>;

  if (!loaded) {
    return (
      <div className="flex min-h-[200px] items-center justify-center" aria-busy="true">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  const requiredFlags = getDashboardRequiredFlags(dashboard) ?? [];
  const enabled = requiredFlags.some((flag) => hasFeature(flag));

  if (enabled) return <>{children}</>;

  const returnHref = pathname.startsWith("/doctor") ? "/doctor/dashboard" : "/admin/dashboard";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">
            {t(locale, "featureGate.notEnabled").replace("{module}", dashboardLabel(dashboard))}
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {t(locale, "featureGate.notAvailable")}
          </p>
          <Link
            href={returnHref}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t(locale, "featureGate.backToDashboard")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
