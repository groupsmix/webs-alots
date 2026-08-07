import { headers } from "next/headers";
import { Chatbot } from "@/components/chatbot";
import { ConsentGatedAnalytics } from "@/components/consent-gated-analytics";
import { DemoBanner } from "@/components/demo-banner";
import { PublicRootLayout } from "@/components/landing/oltigo/public-root-layout";
import { DefaultTemplateLayout } from "@/components/public/default-template-layout";
import { WebSiteJsonLd } from "@/components/seo/json-ld";
import { getPublicBranding, type ClinicBranding } from "@/lib/data/public";
import { getRootDomain, getSiteUrl } from "@/lib/env";
import type { Locale } from "@/lib/i18n";
import { buildPublicThemeStyle } from "@/lib/public-theme";
import { getTemplate } from "@/lib/templates";
import { getTenant } from "@/lib/tenant";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant();
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";

  // Root domain (no tenant) → wrap marketing public pages with the Oltigo
  // nav/footer; the home page keeps its self-contained landing shell.
  if (!tenant) {
    const siteUrl = getSiteUrl() || "https://oltigo.com";
    return (
      <PublicRootLayout>
        <WebSiteJsonLd
          url={siteUrl}
          name="Oltigo"
          searchUrl={`${siteUrl}/annuaire?q={search_term_string}`}
          nonce={nonce}
        />
        {children}
      </PublicRootLayout>
    );
  }

  // Subdomain → wrap with clinic branding, header, and footer
  const branding = await getPublicBranding();

  // Analytics IDs from branding config (stored in clinic's JSONB config)
  const brandingConfig = branding as ClinicBranding & { gaId?: string; gtmId?: string };
  const gaId = brandingConfig.gaId ?? null;
  const gtmId = brandingConfig.gtmId ?? null;

  const isDemo = tenant.subdomain === "demo";
  const rootDomain = getRootDomain() || "oltigo.com";
  const siteUrl = `https://${tenant.subdomain}.${rootDomain}`;
  const template = getTemplate(branding.templateId);

  return (
    <div style={buildPublicThemeStyle(branding, template)}>
      {isDemo && <DemoBanner />}
      <ConsentGatedAnalytics gaId={gaId} gtmId={gtmId} />
      <WebSiteJsonLd
        url={siteUrl}
        name={branding.clinicName}
        searchUrl={`${siteUrl}/book`}
        nonce={nonce}
      />
      <DefaultTemplateLayout branding={branding} template={template} locale={locale}>
        {children}
      </DefaultTemplateLayout>
      <Chatbot />
      {/* <CookieConsent /> is mounted globally in src/app/layout.tsx — do not re-mount here */}
    </div>
  );
}
