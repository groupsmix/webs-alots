/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import { CheckCircle, Mail } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { BreadcrumbJsonLd, JsonLdScript } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSiteUrl } from "@/lib/env";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Carrières",
  description:
    "Rejoignez Oltigo et contribuez à bâtir le système d'exploitation des cabinets médicaux au Maroc. Découvrez nos postes ouverts et notre culture.",
  path: "/carriere",
});

export default async function CareersPage() {
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const siteUrl = getSiteUrl() || "https://oltigo.com";

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Oltigo",
    url: siteUrl,
    logo: `${siteUrl}/logo.svg`,
    sameAs: [`${siteUrl}/about`],
    description: "Système d'exploitation des cabinets médicaux au Maroc.",
  };

  const benefits = [
    "Salaire compétitif et stock-options (BSPCE)",
    "Télétravail partiel et horaires flexibles",
    "Mutuelle premium et budget bien-être",
    "MacBook Pro et outils à la pointe",
    "Apprentissage continu et conférences",
  ];

  const teams = [
    { title: "Produit & Tech", desc: "Next.js, TypeScript, Supabase, Cloudflare Workers." },
    { title: "Sécurité & Compliance", desc: "Audit, chiffrement, conformité Loi 09-08." },
    { title: "Design & UX", desc: "Interfaces simples, accessibles et mobile-first." },
    { title: "Customer Success", desc: "Accompagnement des cabinets partenaires." },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <JsonLdScript data={organizationSchema} nonce={nonce} />
      <BreadcrumbJsonLd
        nonce={nonce}
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Carrières", url: `${siteUrl}/carriere` },
        ]}
      />

      <h1 className="text-3xl font-bold mb-4">Carrières</h1>
      <p className="text-lg text-muted-foreground mb-10">
        Nous construisons le système d'exploitation discret des cabinets médicaux au Maroc. Vous
        souhaitez avoir un impact concret sur la santé digitale ? Rejoignez-nous.
      </p>

      <section className="grid gap-6 md:grid-cols-2 mb-12">
        <Card>
          <CardHeader>
            <CardTitle>Nos valeurs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Sécurité avant tout : les données de santé méritent le plus haut niveau de protection.",
              "Simplicité radicale : chaque fonctionnalité doit supprimer de la friction.",
              "Impact local : Oltigo est pensé pour les réalités marocaines.",
            ].map((value) => (
              <p key={value} className="flex gap-2 text-sm">
                <CheckCircle className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                {value}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pourquoi nous rejoindre ?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Nos équipes</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <div key={team.title} className="border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-1">{team.title}</h3>
              <p className="text-sm text-muted-foreground">{team.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Postes ouverts</h2>
        <p className="text-muted-foreground mb-6">
          Aucun poste ouvert pour le moment. Nous avons cependant toujours envie de rencontrer des
          profils passionnés par la santé, la tech et l'impact au Maroc.
        </p>
      </section>

      <section className="bg-muted rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-semibold mb-3">Candidature spontanée</h2>
        <p className="text-muted-foreground mb-4">
          Envoyez votre CV et une courte note en précisant le type de rôle qui vous intéresse. Nous
          vous répondrons sous une semaine.
        </p>
        <a
          href="mailto:contact@oltigo.com"
          className={buttonVariants({ size: "lg" })}
          data-event="cta-careers-email"
        >
          <Mail className="size-4 mr-2" aria-hidden="true" />
          Envoyer ma candidature
        </a>
      </section>
    </div>
  );
}
