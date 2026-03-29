import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { getPublicBranding } from "@/lib/data/public";

/**
 * Shared layout for clinic-type public pages (dentist, lab, pharmacy, etc.).
 *
 * Consolidates the repeated header/footer + branding CSS-variable pattern
 * that was duplicated across (dentist-public), (lab-public), and
 * (pharmacy-public) route groups.
 */
export async function ClinicPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getPublicBranding();

  return (
    <div
      style={
        {
          "--brand-primary": branding.primaryColor,
          "--brand-secondary": branding.secondaryColor,
          "--brand-heading-font": branding.headingFont,
          "--brand-body-font": branding.bodyFont,
        } as React.CSSProperties
      }
    >
      <PublicHeader
        logoUrl={branding.logoUrl}
        clinicName={branding.clinicName}
      />
      <main className="flex-1">{children}</main>
      <PublicFooter clinicName={branding.clinicName} />
    </div>
  );
}
