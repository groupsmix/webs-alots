/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import { Building2, Handshake, Mail, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { BreadcrumbJsonLd, JsonLdScript } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSiteUrl } from "@/lib/env";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Partenaires",
  description:
    "Devenez partenaire Oltigo : intégrations, revendeurs, laboratoires et institutions de santé au Maroc.",
  path: "/partenaires",
});

export default async function PartnersPage() {
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const siteUrl = getSiteUrl() || "https://oltigo.com";

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Oltigo",
    url: siteUrl,
    logo: `${siteUrl}/logo.svg`,
    partner: [
      { "@type": "Organization", name: "Laboratoires d'analyses", url: `${siteUrl}/partenaires` },
      { "@type": "Organization", name: "Centres d'imagerie", url: `${siteUrl}/partenaires` },
      { "@type": "Organization", name: "Assureurs et mutuelles", url: `${siteUrl}/partenaires` },
    ],
  };

  const partnerTypes = [
    {
      icon: Stethoscope,
      title: "Acteurs de santé",
      desc: "Laboratoires, centres d'imagerie, pharmacies et spécialistes connectés au dossier patient.",
    },
    {
      icon: Building2,
      title: "Institutions",
      desc: "Hôpitaux, cliniques et groupements médicaux souhaitant déployer Oltigo à l'échelle.",
    },
    {
      icon: Handshake,
      title: "Intégrateurs & revendeurs",
      desc: "Accompagnez vos clients dans la transition digitale avec une commission récurrente.",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <JsonLdScript data={orgSchema} nonce={nonce} />
      <BreadcrumbJsonLd
        nonce={nonce}
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Partenaires", url: `${siteUrl}/partenaires` },
        ]}
      />

      <h1 className="text-3xl font-bold mb-4">Partenaires</h1>
      <p className="text-lg text-muted-foreground mb-10">
        Oltigo s'ouvre aux partenariats stratégiques avec des acteurs de la santé, des laboratoires,
        des institutions et des intégrateurs pour offrir aux cabinets médicaux marocains une
        expérience fluide et sécurisée.
      </p>

      <section className="grid gap-6 md:grid-cols-3 mb-12">
        {partnerTypes.map((type) => (
          <Card key={type.title}>
            <CardHeader>
              <type.icon className="size-6 text-primary mb-2" aria-hidden="true" />
              <CardTitle className="text-lg">{type.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{type.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2 mb-12">
        <div className="border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-3">Intégrations API</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Connectez votre système à Oltigo via notre API REST documentée : rendez-vous, patients,
            documents et notifications.
          </p>
          <a href="/api-docs" className={buttonVariants({ variant: "outline" })}>
            Voir la documentation API
          </a>
        </div>
        <div className="border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-3">Devenir revendeur</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Accompagnez les cabinets dans leur adoption et bénéficiez d'un programme de commissions
            récurrentes.
          </p>
          <a
            href="mailto:contact@oltigo.com"
            className={buttonVariants({ variant: "outline" })}
            data-event="cta-partners-email"
          >
            <Mail className="size-4 mr-2" aria-hidden="true" />
            Nous contacter
          </a>
        </div>
      </section>

      <section className="bg-muted rounded-2xl p-6 md:p-8 text-center">
        <h2 className="text-xl font-semibold mb-3">Parlez-nous de votre projet</h2>
        <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
          Contactez-nous avec un descriptif de votre activité et de la collaboration que vous
          imaginez. Nous étudions chaque proposition sous une semaine.
        </p>
        <a href="mailto:contact@oltigo.com" className={buttonVariants({ size: "lg" })}>
          Envoyer une proposition
        </a>
      </section>
    </div>
  );
}
