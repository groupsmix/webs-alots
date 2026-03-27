import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { getPublicBranding } from "@/lib/data/public";
import { getTenant } from "@/lib/tenant";
import { AnalyticsScript } from "@/components/analytics-script";
import { CookieConsent } from "@/components/cookie-consent";
import { Chatbot } from "@/components/chatbot";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenant();

  // Root domain (no tenant) → render children directly.
  // The landing page provides its own header/footer.
  if (!tenant) {
    return <>{children}</>;
  }

  // Subdomain → wrap with clinic branding, header, and footer
  const branding = await getPublicBranding();

  // Analytics IDs from branding config (stored in clinic's JSONB config)
  const brandingRecord = branding as unknown as Record<string, unknown>;
  const gaId = (brandingRecord.gaId as string | undefined) ?? null;
  const gtmId = (brandingRecord.gtmId as string | undefined) ?? null;

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
      <AnalyticsScript gaId={gaId} gtmId={gtmId} />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        Aller au contenu principal
      </a>
      <PublicHeader
        logoUrl={branding.logoUrl}
        clinicName={branding.clinicName}
      />
      <main id="main-content" className="flex-1">{children}</main>
      <PublicFooter clinicName={branding.clinicName} />
      <Chatbot />
      <CookieConsent />
    </div>
  );
}
