import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { getPublicBranding } from "@/lib/data/public";

/**
 * Shared layout for clinic-type public pages (dentist, lab, pharmacy, etc.).
 *
 * Consolidates the repeated header/footer + branding CSS-variable pattern
 * that was previously duplicated across separate public route groups,
 * now unified under the (clinic-public) route group.
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
      <main id="main-content" className="flex-1">{children}</main>
      <PublicFooter clinicName={branding.clinicName} />
    </div>
  );
}
