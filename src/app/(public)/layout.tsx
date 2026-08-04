import { headers } from "next/headers";
import { Chatbot } from "@/components/chatbot";
import { ConsentGatedAnalytics } from "@/components/consent-gated-analytics";
import { DemoBanner } from "@/components/demo-banner";
import { PublicRootLayout } from "@/components/landing/oltigo/public-root-layout";
import { DynamicFooter } from "@/components/public/dynamic-footer";
import { DynamicHeader } from "@/components/public/dynamic-header";
import { PublicFooter } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/header";
import { WebSiteJsonLd } from "@/components/seo/json-ld";
import { getPublicBranding, type ClinicBranding } from "@/lib/data/public";
import { getRootDomain, getSiteUrl } from "@/lib/env";
import { buildPublicThemeStyle } from "@/lib/public-theme";
import { getTemplate } from "@/lib/templates";
import { getTenant } from "@/lib/tenant";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant();
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;

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

  // Template-aware header/footer: the clinic's chosen template can swap the
  // header/footer layout. "top-sticky"/"classic-3col" keep the default
  // components; other variants use the dynamic (template-driven) ones.
  const template = getTemplate(branding.templateId);
  const useOriginalHeader = template.headerVariant === "top-sticky";
  const useOriginalFooter = template.footerVariant === "classic-3col";

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
      {useOriginalHeader ? (
        <PublicHeader
          logoUrl={branding.logoUrl}
          clinicName={branding.clinicName}
          sectionVisibility={branding.sectionVisibility}
          phone={branding.phone}
          email={branding.email}
          address={branding.address}
        />
      ) : (
        <DynamicHeader
          logoUrl={branding.logoUrl}
          clinicName={branding.clinicName}
          phone={branding.phone}
          email={branding.email}
          address={branding.address}
          headerVariant={template.headerVariant}
          template={template}
        />
      )}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {useOriginalFooter ? (
        <PublicFooter
          clinicName={branding.clinicName}
          phone={branding.phone ?? undefined}
          email={branding.email ?? undefined}
          address={branding.address ?? undefined}
        />
      ) : (
        <DynamicFooter
          clinicName={branding.clinicName}
          footerVariant={template.footerVariant}
          template={template}
          phone={branding.phone}
          email={branding.email}
          address={branding.address}
        />
      )}
      <Chatbot />
      {/* <CookieConsent /> is mounted globally in src/app/layout.tsx — do not re-mount here */}
    </div>
  );
}
