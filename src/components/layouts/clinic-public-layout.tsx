import { DynamicFooter } from "@/components/public/dynamic-footer";
import { DynamicHeader } from "@/components/public/dynamic-header";
import { PublicFooter } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/header";
import { getPublicBranding } from "@/lib/data/public";
import { getTemplate } from "@/lib/templates";

/**
 * Shared layout for clinic-type public pages (dentist, lab, pharmacy, etc.).
 *
 * Consolidates the repeated header/footer + branding CSS-variable pattern
 * that was previously duplicated across separate public route groups,
 * now unified under the (clinic-public) route group.
 *
 * Dynamically selects header/footer components based on the clinic's
 * chosen template structural fields (headerVariant, footerVariant).
 * Falls back to the default PublicHeader/PublicFooter for "top-sticky"
 * and "classic-3col" variants respectively.
 */
export async function ClinicPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getPublicBranding();
  const template = getTemplate(branding.templateId);

  // Determine whether to use the original header/footer or dynamic variants
  const useOriginalHeader = template.headerVariant === "top-sticky";
  const useOriginalFooter = template.footerVariant === "classic-3col";

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
      {useOriginalHeader ? (
        <PublicHeader
          logoUrl={branding.logoUrl}
          clinicName={branding.clinicName}
        />
      ) : (
        <DynamicHeader
          logoUrl={branding.logoUrl}
          clinicName={branding.clinicName}
          headerVariant={template.headerVariant}
          template={template}
        />
      )}
      <main id="main-content" className="flex-1">{children}</main>
      {useOriginalFooter ? (
        <PublicFooter clinicName={branding.clinicName} />
      ) : (
        <DynamicFooter
          clinicName={branding.clinicName}
          footerVariant={template.footerVariant}
          template={template}
        />
      )}
    </div>
  );
}
