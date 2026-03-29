import { ClinicPublicLayout } from "@/components/layouts/clinic-public-layout";

/**
 * Consolidated layout for all clinic-type public pages.
 *
 * Replaces the individual (dentist-public), (lab-public), and
 * (pharmacy-public) route-group layouts with a single shared layout
 * that provides branded header/footer via ClinicPublicLayout.
 */
export default async function ClinicPublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClinicPublicLayout>{children}</ClinicPublicLayout>;
}
