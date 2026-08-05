/* eslint-disable i18next/no-literal-string */
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { BreadcrumbJsonLd, JsonLdScript } from "@/components/seo/json-ld";
import { getSiteUrl } from "@/lib/env";
import { buildMetadata } from "@/lib/metadata";
import { getTenant } from "@/lib/tenant";

export const metadata: Metadata = buildMetadata({
  title: "Plan du site — Oltigo",
  description:
    "Retrouvez toutes les pages publiques d'Oltigo : services, fonctionnalités, tarifs, ressources, carrière et mentions légales.",
  path: "/plan-du-site",
});

interface SitemapLink {
  href: string;
  label: string;
}

interface SitemapGroup {
  title: string;
  links: SitemapLink[];
}

const sitemapGroups: SitemapGroup[] = [
  {
    title: "Accueil",
    links: [{ href: "/", label: "Page d’accueil" }],
  },
  {
    title: "Produit",
    links: [
      { href: "/services", label: "Services" },
      { href: "/features/appointments", label: "Rendez-vous" },
      { href: "/features/records", label: "Dossier patient" },
      { href: "/features/whatsapp", label: "Rappels WhatsApp" },
      { href: "/pricing", label: "Tarifs" },
      { href: "/compare", label: "Comparatif" },
      { href: "/register-clinic", label: "Créer votre clinique" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { href: "/api-docs", label: "Documentation API" },
      { href: "/how-to-book", label: "Guide de démarrage" },
      { href: "/faq", label: "FAQ" },
      { href: "/tutoriel", label: "Tutoriels" },
      { href: "/status", label: "Statut" },
      { href: "/blog", label: "Blog" },
      { href: "/plan-du-site", label: "Plan du site" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { href: "/about", label: "À propos" },
      { href: "/contact", label: "Contact" },
      { href: "/carriere", label: "Carrières" },
      { href: "/partenaires", label: "Partenaires" },
      { href: "/versions", label: "Versions" },
      { href: "/testimonials", label: "Témoignages" },
    ],
  },
  {
    title: "Légal",
    links: [
      { href: "/privacy", label: "Confidentialité" },
      { href: "/terms", label: "Conditions" },
      { href: "/sub-processors", label: "Sous-traitants" },
      { href: "/security", label: "Sécurité" },
      { href: "/cookies", label: "Cookies" },
      { href: "/accessibility", label: "Accessibilité" },
      { href: "/loi-09-08", label: "Loi 09-08" },
    ],
  },
];

function SitemapSection({ group }: { group: SitemapGroup }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{group.title}</h2>
      <ul className="space-y-2">
        {group.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-block text-sm text-primary underline-offset-4 hover:underline min-h-11"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PlanDuSitePage() {
  await getTenant();
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const siteUrl = getSiteUrl() || "https://oltigo.com";

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Plan du site — Oltigo",
    url: `${siteUrl}/plan-du-site`,
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-16">
      <JsonLdScript data={webPageJsonLd} nonce={nonce} />
      <BreadcrumbJsonLd
        nonce={nonce}
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Plan du site", url: `${siteUrl}/plan-du-site` },
        ]}
      />

      <div className="mb-10">
        <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Navigation
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Plan du site
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Toutes les pages publiques d&apos;Oltigo classées par thème.
        </p>
      </div>

      <nav aria-label="Plan du site">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sitemapGroups.map((group) => (
            <SitemapSection key={group.title} group={group} />
          ))}
        </div>
      </nav>
    </div>
  );
}
