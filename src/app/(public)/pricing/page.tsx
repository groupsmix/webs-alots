import type { Metadata } from "next";
import { headers } from "next/headers";
import { LandingLocaleProvider } from "@/components/landing/landing-locale-provider";
import { Pricing } from "@/components/landing/oltigo/components/sections/pricing";
import { dictionaries as landingDictionaries } from "@/components/landing/oltigo/i18n/dictionaries";
import { PricingContent } from "@/components/landing/pricing-content";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { getRootDomain, getSiteUrl } from "@/lib/env";
import { t, type Locale } from "@/lib/i18n";
import { safeJsonLdStringify } from "@/lib/json-ld";
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

function buildPricingSchema(
  baseUrl: string,
  tiers: {
    id: string;
    name: string;
    price: string;
    currency: string;
    blurb: string;
    cta: string;
  }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Oltigo Health",
    description: "Plans tarifaires Oltigo pour cabinets médicaux au Maroc.",
    url: `${baseUrl}/pricing`,
    brand: {
      "@type": "Brand",
      name: "Oltigo",
    },
    offers: tiers.map((tier) => ({
      "@type": "Offer",
      name: tier.name,
      description: tier.blurb,
      price: tier.price,
      priceCurrency: tier.currency,
      priceValidUntil: `${new Date().getFullYear()}-12-31`,
      availability: "https://schema.org/InStock",
      url: tier.id === "enterprise" ? `${baseUrl}/#demo` : `${baseUrl}/register-clinic`,
    })),
  };
}

export default async function PricingPage() {
  const tenant = await getTenant();
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const locale = ((h.get("x-locale") as Locale | null) ||
    (h.get("x-tenant-locale") as Locale) ||
    "fr") as Locale;

  const rootDomain = getRootDomain() || "oltigo.com";
  const baseUrl = tenant
    ? `https://${tenant.subdomain}.${rootDomain}`
    : getSiteUrl() || "https://oltigo.com";

  const landingDict =
    (landingDictionaries as Record<string, (typeof landingDictionaries)["fr"] | undefined>)[
      locale
    ] ?? landingDictionaries.fr;
  const tiers = landingDict.pricing.tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    price: tier.price,
    currency: landingDict.pricing.currency,
    blurb: tier.blurb,
    cta: tier.cta,
  }));
  const pricingSchema = buildPricingSchema(baseUrl, tiers);
  const pricingScript = (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(pricingSchema) }}
    />
  );
  const breadcrumb = (
    <BreadcrumbJsonLd
      nonce={nonce}
      items={[
        { name: "Accueil", url: baseUrl },
        { name: landingDict.pricing.title, url: `${baseUrl}/pricing` },
      ]}
    />
  );

  // Subdomain → render legacy pricing inside the tenant public layout.
  if (tenant) {
    return (
      <LandingLocaleProvider>
        {pricingScript}
        {breadcrumb}
        <PricingContent />
      </LandingLocaleProvider>
    );
  }

  // Root domain → Oltigo landing chrome with the dedicated pricing section.
  return (
    <>
      {pricingScript}
      {breadcrumb}
      <Pricing headingAs="h1" />
    </>
  );
}
