import { Clock, CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { RootServicesView } from "@/components/landing/oltigo/components/sections/root-services-view";
import { dictionaries as landingDictionaries } from "@/components/landing/oltigo/i18n/dictionaries";
import { BreadcrumbJsonLd, JsonLdScript } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { getPublicBranding, getPublicServices } from "@/lib/data/public";
import { getRootDomain, getSiteUrl } from "@/lib/env";
import type { Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";
import { getTenant } from "@/lib/tenant";
import { defaultWebsiteConfig } from "@/lib/website-config";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const h = await headers();
  const locale = ((h.get("x-locale") as Locale | null) ||
    (h.get("x-tenant-locale") as Locale) ||
    "fr") as Locale;
  const rootDomain = getRootDomain() || "oltigo.com";
  const siteUrl = tenant ? `https://${tenant.subdomain}.${rootDomain}` : undefined;

  if (!tenant) {
    return buildMetadata({
      title: "Fonctionnalités",
      description:
        "Découvrez les fonctionnalités Oltigo : rendez-vous en ligne, dossier patient chiffré, rappels WhatsApp, paiements et plus. Conçu pour les cabinets médicaux au Maroc.",
      path: "/services",
      locale,
    });
  }

  const branding = await getPublicBranding();
  const clinicName = branding.clinicName || tenant.clinicName || "Cabinet";
  return buildMetadata({
    title: `Nos Services — ${clinicName}`,
    description:
      "Découvrez nos services médicaux, consultations, soins et traitements. Tarifs transparents et prise de rendez-vous en ligne.",
    path: "/services",
    locale,
    siteUrl,
  });
}

export default async function ServicesPage() {
  const tenant = await getTenant();
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const locale = ((h.get("x-locale") as Locale | null) ||
    (h.get("x-tenant-locale") as Locale) ||
    "fr") as Locale;

  // Root marketing domain → SaaS feature page
  if (!tenant) {
    const siteUrl = getSiteUrl() || "https://oltigo.com";
    const landingDict =
      (landingDictionaries as Record<string, (typeof landingDictionaries)["fr"] | undefined>)[
        locale
      ] ?? landingDictionaries.fr;

    const softwareSchema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Oltigo Health",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      url: `${siteUrl}/services`,
      description:
        "Plateforme complète pour gérer votre cabinet médical : rendez-vous, dossiers patients chiffrés, rappels WhatsApp en darija.",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "999",
        priceCurrency: "MAD",
        offerCount: 4,
      },
    };

    const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: landingDict.features.map((feature, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: feature.title,
        description: feature.tagline,
        url: `${siteUrl}/features/${feature.id}`,
      })),
    };

    return (
      <>
        <JsonLdScript data={softwareSchema} nonce={nonce} />
        <JsonLdScript data={itemListSchema} nonce={nonce} />
        <BreadcrumbJsonLd
          nonce={nonce}
          items={[
            { name: "Accueil", url: siteUrl },
            { name: landingDict.featuresHeading.title, url: `${siteUrl}/services` },
          ]}
        />
        <RootServicesView />
      </>
    );
  }

  // Subdomain → clinic service catalog
  const branding = await getPublicBranding();

  const cfg = defaultWebsiteConfig.services;

  const services = await getPublicServices();
  const rootDomain = getRootDomain() || "oltigo.com";
  const canonicalUrl = `https://${tenant.subdomain}.${rootDomain}`;

  const servicesSchema = {
    "@context": "https://schema.org",
    "@id": `${canonicalUrl}/#services`,
    "@type": "MedicalBusiness",
    url: `${canonicalUrl}/services`,
    name: cfg.title,
    provider: {
      "@type": "MedicalOrganization",
      name: branding.clinicName || tenant.clinicName,
      url: canonicalUrl,
      ...(branding.logoUrl ? { logo: branding.logoUrl } : {}),
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Medical Services",
      itemListElement: services
        .filter((s) => s.active)
        .map((s) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "MedicalProcedure",
            name: s.name,
            description: s.description,
          },
          price: s.price,
          priceCurrency: s.currency,
        })),
    },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <JsonLdScript data={servicesSchema} nonce={nonce} />
      <BreadcrumbJsonLd
        nonce={nonce}
        items={[
          { name: "Accueil", url: canonicalUrl },
          { name: cfg.title, url: `${canonicalUrl}/services` },
        ]}
      />
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{cfg.title}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">{cfg.subtitle}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services
          .filter((s) => s.active)
          .map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <CardTitle>{service.name}</CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {service.duration} min
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <CreditCard className="h-4 w-4" />
                    {service.price} {service.currency}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/book" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Prendre rendez-vous
                </Link>
              </CardFooter>
            </Card>
          ))}
      </div>
    </div>
  );
}
