import { headers } from "next/headers";
import { Chatbot } from "@/components/chatbot";
import { DefaultTemplateLayout } from "@/components/public/default-template-layout";
import { getPublicBranding } from "@/lib/data/public";
import type { Locale } from "@/lib/i18n";
import { buildPublicThemeStyle } from "@/lib/public-theme";
import { getTemplate } from "@/lib/templates";

/**
 * Shared layout for clinic-type public pages (dentist, lab, pharmacy, etc.).
 *
 * Consolidates the repeated header/footer + branding CSS-variable pattern
 * that was previously duplicated across separate public route groups,
 * now unified under the (clinic-public) route group.
 *
 * Template packages can provide their own Layout/Header/Footer components;
 * otherwise the default dispatcher selects the legacy variant-based
 * PublicHeader/DynamicHeader and PublicFooter/DynamicFooter components.
 */
export async function ClinicPublicLayout({ children }: { children: React.ReactNode }) {
  const branding = await getPublicBranding();
  const template = getTemplate(branding.templateId);
  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";

  return (
    <div style={buildPublicThemeStyle(branding, template)}>
      <DefaultTemplateLayout branding={branding} template={template} locale={locale}>
        {children}
      </DefaultTemplateLayout>
      <Chatbot />
    </div>
  );
}
