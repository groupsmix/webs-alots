import { Chatbot } from "@/components/chatbot";
import { ConsentGatedAnalytics } from "@/components/consent-gated-analytics";
import { DemoBanner } from "@/components/demo-banner";
import { DynamicFooter } from "@/components/public/dynamic-footer";
import { DynamicHeader } from "@/components/public/dynamic-header";
import { PublicFooter } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/header";
import { getPublicBranding, type ClinicBranding } from "@/lib/data/public";
import { buildPublicThemeStyle } from "@/lib/public-theme";
import { getTemplate } from "@/lib/templates";
import { getTenant } from "@/lib/tenant";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant();

  // Root domain (no tenant) → render children directly.
  // The landing page provides its own header/footer.
  if (!tenant) {
    return <>{children}</>;
  }

  // Subdomain → wrap with clinic branding, header, and footer
  const branding = await getPublicBranding();

  // Analytics IDs from branding config (stored in clinic's JSONB config)
  const brandingConfig = branding as ClinicBranding & { gaId?: string; gtmId?: string };
  const gaId = brandingConfig.gaId ?? null;
  const gtmId = brandingConfig.gtmId ?? null;

  const isDemo = tenant.subdomain === "demo";

  // Template-aware header/footer: the clinic's chosen template can swap the
  // header/footer layout. "top-sticky"/"classic-3col" keep the default
  // components; other variants use the dynamic (template-driven) ones.
  const template = getTemplate(branding.templateId);
  const useOriginalHeader = template.headerVariant === "top-sticky";
  const useOriginalFooter = template.footerVariant === "classic-3col";

  return (
    <div style={buildPublicThemeStyle(branding, template.borderRadius)}>
      {isDemo && <DemoBanner />}
      <ConsentGatedAnalytics gaId={gaId} gtmId={gtmId} />
      {useOriginalHeader ? (
        <PublicHeader logoUrl={branding.logoUrl} clinicName={branding.clinicName} />
      ) : (
        <DynamicHeader
          logoUrl={branding.logoUrl}
          clinicName={branding.clinicName}
          headerVariant={template.headerVariant}
          template={template}
        />
      )}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {useOriginalFooter ? (
        <PublicFooter clinicName={branding.clinicName} />
      ) : (
        <DynamicFooter
          clinicName={branding.clinicName}
          footerVariant={template.footerVariant}
          template={template}
        />
      )}
      <Chatbot />
      {/* <CookieConsent /> is mounted globally in src/app/layout.tsx — do not re-mount here */}
    </div>
  );
}
