// SC-01: Server component layout — client-interactive shell extracted to
// a separate "use client" component (specialist-layout-shell).
import { SpecialistLayoutShell } from "@/components/layouts/specialist-layout-shell";

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
  return <SpecialistLayoutShell>{children}</SpecialistLayoutShell>;
}
