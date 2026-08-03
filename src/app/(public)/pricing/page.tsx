import type { Metadata } from "next";
import { headers } from "next/headers";
import { LandingLocaleProvider } from "@/components/landing/landing-locale-provider";
import { Pricing } from "@/components/landing/oltigo/components/sections/pricing";
import { PricingContent } from "@/components/landing/pricing-content";
import { getRootDomain } from "@/lib/env";
import { t, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { getTenant } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const h = await headers();
  const locale = (h.get("x-tenant-locale") as Locale) || "fr";
  const rootDomain = getRootDomain() || "oltigo.com";
  const siteUrl = tenant ? `https://${tenant.subdomain}.${rootDomain}` : undefined;
  const clinicName = tenant?.clinicName || t(locale, "public.clinicFallback");
  const title = tenant ? `Tarifs — ${clinicName}` : "Tarifs — Plans et Abonnements";
  const description = tenant
    ? `Découvrez les tarifs de ${clinicName}. Plans adaptés à chaque cabinet médical.`
    : "Découvrez nos plans tarifaires adaptés à chaque cabinet médical. Du plan gratuit au plan Enterprise, trouvez l'offre qui vous convient.";

  return buildMetadata({
    title,
    description,
    path: "/pricing",
    locale,
    siteUrl,
  });
}

export default async function PricingPage() {
  const tenant = await getTenant();

  // Subdomain → render legacy pricing inside the tenant public layout.
  if (tenant) {
    return (
      <LandingLocaleProvider>
        <PricingContent />
      </LandingLocaleProvider>
    );
  }

  // Root domain → Oltigo landing chrome with the dedicated pricing section.
  return <Pricing headingAs="h1" />;
}
