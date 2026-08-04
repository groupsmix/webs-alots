import type { Metadata } from "next";
import { headers } from "next/headers";
import { dictionaries as landingDictionaries } from "@/components/landing/oltigo/i18n/dictionaries";
import { FaqSection } from "@/components/public/sections/faq-section";
import { BreadcrumbJsonLd, JsonLdScript } from "@/components/seo/json-ld";
import { getPublicBranding } from "@/lib/data/public";
import { getRootDomain, getSiteUrl } from "@/lib/env";
import { t, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { getTenant } from "@/lib/tenant";
import { defaultWebsiteConfig } from "@/lib/website-config";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const h = await headers();
  const locale = (h.get("x-tenant-locale") as Locale) || "fr";
  const rootDomain = getRootDomain() || "oltigo.com";
  const siteUrl = tenant ? `https://${tenant.subdomain}.${rootDomain}` : undefined;
  const title = tenant ? `Questions Fréquentes — ${tenant.clinicName}` : "Questions Fréquentes";
  const description =
    "Trouvez les réponses aux questions les plus courantes sur nos services et notre plateforme.";

  return buildMetadata({
    title,
    description,
    path: "/faq",
    locale,
    siteUrl,
  });
}

export default async function FaqPage() {
  const tenant = await getTenant();
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const locale = ((h.get("x-locale") as Locale | null) ||
    (h.get("x-tenant-locale") as Locale) ||
    "fr") as Locale;

  let title: string;
  let subtitle: string | undefined;
  let faqs: { q: string; a: string }[];
  let baseUrl: string;

  if (tenant) {
    const branding = await getPublicBranding();
    const rootDomain = getRootDomain() || "oltigo.com";
    baseUrl = `https://${tenant.subdomain}.${rootDomain}`;
    const wsFaq = (branding.websiteConfig as { faq?: typeof defaultWebsiteConfig.faq } | null)?.faq;
    const source = wsFaq ?? defaultWebsiteConfig.faq;
    title = source.title;
    subtitle = source.subtitle;
    faqs = source.items;
  } else {
    baseUrl = getSiteUrl() || "https://oltigo.com";
    const landingDict =
      (landingDictionaries as Record<string, (typeof landingDictionaries)["fr"] | undefined>)[
        locale
      ] ?? landingDictionaries.fr;
    title = landingDict.faq.title;
    subtitle = undefined;
    faqs = landingDict.faq.items;
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const pageTitle = t(locale, "public.sections.faq-section.questionsFrequentes");

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <JsonLdScript data={faqSchema} nonce={nonce} />
      <BreadcrumbJsonLd
        nonce={nonce}
        items={[
          { name: "Accueil", url: baseUrl },
          { name: pageTitle, url: `${baseUrl}/faq` },
        ]}
      />
      <FaqSection title={title} subtitle={subtitle} faqs={faqs} />
    </div>
  );
}
