import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EditorialContactContent } from "@/components/landing/editorial/editorial-contact-content";
import { EditorialPageShell } from "@/components/landing/editorial/editorial-page-shell";
import { ContactForm } from "@/components/public/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { getTenant } from "@/lib/tenant";
import { defaultWebsiteConfig } from "@/lib/website-config";

export const metadata: Metadata = {
  title: "Contact \u2014 Nous Joindre",
  description:
    "Contactez notre cabinet m\u00E9dical par t\u00E9l\u00E9phone, WhatsApp ou email. Acc\u00E8s facile, formulaire de contact et adresse.",
  openGraph: {
    title: "Contact \u2014 Nous Joindre",
    description: "Contactez notre cabinet m\u00E9dical par t\u00E9l\u00E9phone, WhatsApp ou email.",
  },
};

export default async function ContactPage() {
  const tenant = await getTenant();

  if (!tenant) {
    return (
      <EditorialPageShell>
        <EditorialContactContent />
      </EditorialPageShell>
    );
  }

  const cfg = defaultWebsiteConfig.contact;

  const contactInfo = [
    { icon: Phone, label: "T\u00E9l\u00E9phone", value: cfg.phone },
    { icon: MessageCircle, label: "WhatsApp", value: cfg.whatsapp },
    { icon: Mail, label: "Email", value: cfg.email },
    { icon: MapPin, label: "Adresse", value: cfg.address },
  ];

  const whatsappLink = `https://wa.me/${cfg.whatsapp.replace(/\s+/g, "")}?text=${encodeURIComponent(cfg.whatsappMessage)}`;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: `${baseUrl}/contact`,
    mainEntity: {
      "@type": "MedicalBusiness",
      name: cfg.title,
      telephone: cfg.phone,
      email: cfg.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: cfg.address,
      },
    },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(contactSchema) }}
      />
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-3xl font-bold">{cfg.title}</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">{cfg.subtitle}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {contactInfo.map((info) => (
              <Card key={info.label}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <info.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{info.label}</p>
                    <p className="text-sm text-muted-foreground">{info.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* eslint-disable i18next/no-literal-string */}
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{"\u00C9crivez-nous sur WhatsApp"}</p>
                <p className="text-sm text-muted-foreground">
                  {"R\u00E9ponses rapides pendant les heures de travail"}
                </p>
              </div>
              <Link
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                {"Ouvrir WhatsApp"}
              </Link>
            </CardContent>
          </Card>
          {/* eslint-enable i18next/no-literal-string */}
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
