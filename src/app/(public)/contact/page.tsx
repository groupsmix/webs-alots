import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/public/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicBranding } from "@/lib/data/public";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { getTenant } from "@/lib/tenant";
import { defaultWebsiteConfig } from "@/lib/website-config";

export const metadata: Metadata = {
  title: "Contact — Nous Joindre",
  description:
    "Contactez notre cabinet médical par téléphone, WhatsApp ou email. Accès facile, formulaire de contact et adresse.",
  openGraph: {
    title: "Contact — Nous Joindre",
    description: "Contactez notre cabinet médical par téléphone, WhatsApp ou email.",
  },
};

export default async function ContactPage() {
  const tenant = await getTenant();
  let branding = null;
  if (tenant) {
    branding = await getPublicBranding();
  }

  const defaultCfg = defaultWebsiteConfig.contact;

  const title = branding?.clinicName ? `Contactez ${branding.clinicName}` : defaultCfg.title;
  const subtitle = branding?.clinicName
    ? "Prenez rendez-vous ou posez vos questions."
    : defaultCfg.subtitle;
  const phone = branding?.phone || defaultCfg.phone;
  const email = branding?.email || defaultCfg.email;
  const address = branding?.address || defaultCfg.address;
  // ClinicBranding has no `whatsapp` field — read from the websiteConfig JSONB
  // which mirrors WebsiteConfig.contact, or fall back to the default config.
  const wsCfg = branding?.websiteConfig as { contact?: { whatsapp?: string } } | null;
  const whatsapp = wsCfg?.contact?.whatsapp || defaultCfg.whatsapp;
  const whatsappMessage = defaultCfg.whatsappMessage;

  const contactInfo = [
    { icon: Phone, label: "Téléphone", value: phone },
    { icon: MessageCircle, label: "WhatsApp", value: whatsapp },
    { icon: Mail, label: "Email", value: email },
    { icon: MapPin, label: "Adresse", value: address },
  ];

  const whatsappLink = `https://wa.me/${whatsapp.replace(/\s+/g, "")}?text=${encodeURIComponent(whatsappMessage)}`;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: `${baseUrl}/contact`,
    mainEntity: {
      "@type": "MedicalBusiness",
      name: branding?.clinicName || title,
      telephone: phone,
      email: email,
      address: {
        "@type": "PostalAddress",
        streetAddress: address,
      },
    },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        // SAFETY: JSON.stringify of a server-controlled object built from static
        // config values (defaultWebsiteConfig) and tenant branding.
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(contactSchema) }}
      />
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
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

          {/* WhatsApp CTA */}
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Écrivez-nous sur WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  Réponses rapides pendant les heures de travail
                </p>
              </div>
              <Link
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Ouvrir WhatsApp
              </Link>
            </CardContent>
          </Card>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
