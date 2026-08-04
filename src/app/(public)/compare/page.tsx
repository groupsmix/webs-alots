/* eslint-disable i18next/no-literal-string */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { OltigoPublicShell } from "@/components/landing/oltigo/public-shell";
import { FullComparisonTable } from "@/components/marketing/comparison-table";
import { BreadcrumbJsonLd, JsonLdScript } from "@/components/seo/json-ld";
import { getSiteUrl } from "@/lib/env";
import { buildMetadata } from "@/lib/metadata";
import { getTenant } from "@/lib/tenant";

export const metadata: Metadata = buildMetadata({
  title: "Comparatif — Oltigo vs IYADA, SmartDoc, CABIDOC, Pratisoft",
  description:
    "Comparez Oltigo avec les autres solutions de gestion de cabinet médical au Maroc : IYADA, SmartDoc, CABIDOC et Pratisoft. IA, WhatsApp, QR, multi-tenant et plus.",
  path: "/compare",
});

const faqs = [
  {
    q: "Quelle est la meilleure solution de gestion de cabinet médical au Maroc ?",
    a: "Oltigo est le choix le plus complet pour les cabinets marocains : plan gratuit, rappels WhatsApp en darija, facturation CNSS/CNOPS, ordonnances QR, sous-domaine personnalisé et conformité Loi 09-08.",
  },
  {
    q: "Oltigo vs Doctolib : quelles sont les différences ?",
    a: "Doctolib est centré sur le marché français et européen. Oltigo est conçu pour le Maroc : tarifs en MAD, rappels darija, facturation assurance marocaine et hébergement conforme CNDP.",
  },
  {
    q: "Oltigo est-il gratuit ?",
    a: "Oui, Oltigo propose un plan gratuit avec les fonctionnalités essentielles. Les plans Starter, Pro et Entreprise débloquent l'IA, le multi-cabinet et les rappels avancés.",
  },
  {
    q: "Mes données patient sont-elles hébergées au Maroc ?",
    a: "Oltigo héberge et chiffre les données au repos (AES-256-GCM) et respecte la Loi 09-08 relative à la protection des données à caractère personnel au Maroc.",
  },
];

function PageHeader() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6">
      <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
        <span className="text-muted-foreground">01 — </span>Comparatif complet
      </p>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Oltigo vs la concurrence
      </h1>
      <p id="speakable-summary" className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Découvrez pourquoi Oltigo est la solution la plus complète pour les professionnels de santé
        au Maroc. Plan gratuit, rappels WhatsApp darija, IA, facturation CNSS/CNOPS et conformité
        Loi 09-08.
      </p>
      <div className="mt-8 h-px w-full bg-border" />
    </div>
  );
}

function AeoFAQ() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-20 pt-8" aria-labelledby="compare-faq-heading">
      <h2 id="compare-faq-heading" className="mb-8 text-2xl font-bold tracking-tight">
        Questions fréquentes sur le comparatif
      </h2>
      <div className="space-y-6">
        {faqs.map((faq, index) => (
          <details
            key={index}
            className="group rounded-lg border border-border bg-card p-5"
            open={index === 0}
          >
            <summary className="cursor-pointer list-none font-medium text-foreground group-open:mb-3">
              {faq.q}
            </summary>
            <p className="text-muted-foreground">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default async function ComparePage() {
  const tenant = await getTenant();
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const siteUrl = getSiteUrl() || "https://oltigo.com";

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Comparatif — Oltigo vs IYADA, SmartDoc, CABIDOC, Pratisoft",
    url: `${siteUrl}/compare`,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["#speakable-summary"],
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  const content = (
    <>
      <BreadcrumbJsonLd
        nonce={nonce}
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Comparatif", url: `${siteUrl}/compare` },
        ]}
      />
      <JsonLdScript data={webPageJsonLd} nonce={nonce} />
      <JsonLdScript data={faqJsonLd} nonce={nonce} />
      <PageHeader />
      <div className="pb-8">
        <FullComparisonTable />
      </div>
      <AeoFAQ />
    </>
  );

  if (tenant) {
    return content;
  }

  return (
    <OltigoPublicShell mainClassName="min-h-screen bg-background pt-16 text-foreground">
      {content}
    </OltigoPublicShell>
  );
}
