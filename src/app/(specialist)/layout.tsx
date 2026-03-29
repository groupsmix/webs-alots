"use client";

import { usePathname } from "next/navigation";
import {
  ClinicDashboardLayout,
} from "@/components/layouts/clinic-dashboard-layout";
import { getSpecialistConfigFromPathname } from "@/config/specialist-registry";

/**
 * Consolidated layout for all specialist dashboard route groups.
 *
 * Replaces the individual (nutritionist), (optician), (parapharmacy),
 * (physiotherapist), (psychologist), (speech-therapist), and (radiology)
 * route-group layouts with a single config-driven layout.
 *
 * Equipment uses its own layout within (specialist)/equipment/ because
 * it has a custom i18n-aware sidebar that differs from ClinicDashboardLayout.
 */
export default function SpecialistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Equipment has its own nested layout — pass children through
  if (pathname.startsWith("/equipment")) {
    return <>{children}</>;
  }

  const config = getSpecialistConfigFromPathname(pathname);

  if (!config) {
    return <>{children}</>;
  }

  return (
    <ClinicDashboardLayout config={config}>
      {children}
    </ClinicDashboardLayout>
  );
}
