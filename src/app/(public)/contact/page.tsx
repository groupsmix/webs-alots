import type { Metadata } from "next";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { safeJsonLdStringify } from "@/lib/json-ld";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — Nous Joindre",
  description:
    "Contactez notre cabinet médical par téléphone, WhatsApp ou email. Accès facile, formulaire de contact et adresse.",
  openGraph: {
    title: "Contact — Nous Joindre",
    description: "Contactez notre cabinet médical par téléphone, WhatsApp ou email.",
  },
};

export default function ContactPage() {
  const cfg = defaultWebsiteConfig.contact;

  const contactInfo = [
    { icon: Phone, label: "Phone", value: cfg.phone },
    { icon: MessageCircle, label: "WhatsApp", value: cfg.whatsapp },
    { icon: Mail, label: "Email", value: cfg.email },
    { icon: MapPin, label: "Address", value: cfg.address },
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
        // SAFETY: JSON.stringify of a server-controlled object built from static
        // config values (defaultWebsiteConfig). No user-sourced content.
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(contactSchema) }}
      />
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{cfg.title}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {cfg.subtitle}
        </p>
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
                <p className="font-medium">Chat with us on WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  Quick responses during working hours
                </p>
              </div>
              <Link
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Open WhatsApp
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send us a Message</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" placeholder="+212 6XX XX XX XX" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="your@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" placeholder="How can we help?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" placeholder="Your message..." rows={4} />
              </div>
              <Button type="button" className="w-full">
                Send Message
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
