import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FeatureDetailView } from "@/components/landing/oltigo/components/sections/feature-detail-view";
import { dictionaries as landingDictionaries } from "@/components/landing/oltigo/i18n/dictionaries";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { getSiteUrl } from "@/lib/env";
import { type Locale } from "@/lib/i18n";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/metadata";

const FEATURE_SLUGS = ["appointments", "records", "whatsapp"] as const;
type FeatureSlug = (typeof FEATURE_SLUGS)[number];

const DESCRIPTIONS: Record<FeatureSlug, string> = {
  appointments:
    "Page de réservation en ligne, agenda multi-praticiens et rappels automatiques pour réduire les absences de votre cabinet médical.",
  records:
    "Dossier patient chiffré AES-256-GCM, historique, ordonnances et documents en un seul endroit sécurisé.",
  whatsapp:
    "Rappels de rendez-vous en darija approuvés par Meta, envoyés automatiquement avant chaque consultation.",
};

const HOW_TO_STEPS: Record<FeatureSlug, { name: string; text: string }[]> = {
  appointments: [
    {
      name: "Partager la page de réservation",
      text: "Intégrez le lien sur votre site ou annuaire.",
    },
    {
      name: "Choisir le créneau",
      text: "Le patient sélectionne praticien, motif et horaire disponible.",
    },
    { name: "Recevoir la confirmation", text: "Email et rappel WhatsApp partent automatiquement." },
    { name: "Gérer dans l'agenda", text: "Retrouvez tous les rendez-vous dans un agenda partagé." },
  ],
  records: [
    {
      name: "Créer le dossier",
      text: "Saisissez les informations ou importez votre fichier existant.",
    },
    {
      name: "Enregistrer la consultation",
      text: "Rédigez notes, prescriptions et pièces jointes.",
    },
    {
      name: "Chiffrer et stocker",
      text: "Les données sont chiffrées AES-256-GCM sur l'infrastructure marocaine.",
    },
    { name: "Consulter en sécurité", text: "Accès contrôlé et traçable pour votre équipe." },
  ],
  whatsapp: [
    { name: "Activer le modèle", text: "Choisissez un modèle de rappel pré-approuvé par Meta." },
    { name: "Planifier l'envoi", text: "Définissez l'heure du rappel avant chaque rendez-vous." },
    {
      name: "Recevoir la confirmation",
      text: "Le patient reçoit le message en darija et répond OUI.",
    },
    {
      name: "Suivre les confirmations",
      text: "L'agenda affiche les statuts confirmé / absent en direct.",
    },
  ],
};

interface FeaturePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return FEATURE_SLUGS.map((slug) => ({ slug }));
}

function isFeatureSlug(slug: string): slug is FeatureSlug {
  return FEATURE_SLUGS.includes(slug as FeatureSlug);
}

export async function generateMetadata({ params }: FeaturePageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isFeatureSlug(slug)) return {};

  const h = await headers();
  const locale = ((h.get("x-locale") as Locale | null) ||
    (h.get("x-tenant-locale") as Locale) ||
    "fr") as Locale;
  const landingDict =
    (landingDictionaries as Record<string, (typeof landingDictionaries)["fr"] | undefined>)[
      locale
    ] ?? landingDictionaries.fr;
  const feature = landingDict.features.find((f) => f.id === slug);

  return buildMetadata({
    title: feature?.title ?? "Fonctionnalité",
    description: DESCRIPTIONS[slug],
    path: `/features/${slug}`,
    locale,
  });
}

export default async function FeaturePage({ params }: FeaturePageProps) {
  const { slug } = await params;
  if (!isFeatureSlug(slug)) notFound();

  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const locale = ((h.get("x-locale") as Locale | null) ||
    (h.get("x-tenant-locale") as Locale) ||
    "fr") as Locale;
  const landingDict =
    (landingDictionaries as Record<string, (typeof landingDictionaries)["fr"] | undefined>)[
      locale
    ] ?? landingDictionaries.fr;
  const feature = landingDict.features.find((f) => f.id === slug);
  if (!feature) notFound();

  const siteUrl = getSiteUrl() || "https://oltigo.com";
  const pageUrl = `${siteUrl}/features/${slug}`;

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: feature.title,
    description: DESCRIPTIONS[slug],
    url: pageUrl,
    step: HOW_TO_STEPS[slug].map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      url: `${pageUrl}#step-${index + 1}`,
    })),
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: feature.title,
    description: DESCRIPTIONS[slug],
    url: pageUrl,
    provider: {
      "@type": "Organization",
      name: "Oltigo",
      url: siteUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(howToSchema) }}
      />
      <BreadcrumbJsonLd
        nonce={nonce}
        items={[
          { name: "Accueil", url: siteUrl },
          { name: landingDict.featuresHeading.title, url: `${siteUrl}/services` },
          { name: feature.title, url: pageUrl },
        ]}
      />
      <FeatureDetailView slug={slug} />
    </>
  );
}
