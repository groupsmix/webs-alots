"use client";

import { usePathname } from "next/navigation";
import { ClinicDashboardLayout } from "@/components/layouts/clinic-dashboard-layout";
import { getSpecialistConfigFromPathname } from "@/lib/config/specialist-registry";

/**
 * Client shell for the specialist layout (SC-01).
 * Reads the current pathname to resolve specialist config, then delegates
 * to the shared ClinicDashboardLayout.
 */
export function SpecialistLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const config = getSpecialistConfigFromPathname(pathname);

  if (!config) {
    return <>{children}</>;
  }

  return <ClinicDashboardLayout config={config}>{children}</ClinicDashboardLayout>;
}
