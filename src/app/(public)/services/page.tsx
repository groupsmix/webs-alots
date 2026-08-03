import { Clock, CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
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
import { getRootDomain } from "@/lib/env";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/metadata";
import { getTenant } from "@/lib/tenant";
import { defaultWebsiteConfig } from "@/lib/website-config";

export const metadata: Metadata = buildMetadata({
  title: "Nos Services — Cabinet Médical",
  description:
    "Découvrez nos services médicaux, consultations, soins et traitements. Tarifs transparents et prise de rendez-vous en ligne.",
  path: "/services",
});

export default async function ServicesPage() {
  // On the root marketing domain there is no tenant, so there are no
  // clinic-scoped services to show. Send visitors to the product features
  // section instead of rendering an empty, clinic-framed services page.
  const tenant = await getTenant();
  if (!tenant) {
    redirect("/#features");
  }

  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
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
      <script
        type="application/ld+json"
        nonce={nonce}
        // SAFETY: safeJsonLdStringify escapes "<" to prevent </script> injection
        // from database-sourced fields (service name, description, price).
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(servicesSchema) }}
      />
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
