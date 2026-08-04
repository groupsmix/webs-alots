/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import { CalendarDays, CheckCircle, ClipboardList, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { BreadcrumbJsonLd, JsonLdScript } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button-variants";
import { getSiteUrl } from "@/lib/env";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Tutoriel — Prendre rendez-vous avec Oltigo",
  description:
    "Guide étape par étape pour créer un rendez-vous en ligne, recevoir le rappel WhatsApp et confirmer sa venue avec Oltigo.",
  path: "/tutoriel",
});

export default async function TutorialPage() {
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const siteUrl = getSiteUrl() || "https://oltigo.com";

  const steps = [
    {
      icon: CalendarDays,
      title: "Choisissez votre créneau",
      text: "Rendez-vous sur la page de réservation du cabinet, sélectionnez le médecin, la date et l'heure qui vous conviennent.",
    },
    {
      icon: ClipboardList,
      title: "Renseignez vos informations",
      text: "Saisissez votre nom, téléphone et motif de consultation. Si c'est votre première visite, cochez la case correspondante.",
    },
    {
      icon: MessageCircle,
      title: "Recevez le rappel WhatsApp",
      text: "24 h avant votre rendez-vous, vous recevez un message en darija. Répondez « oui » pour confirmer ou « non » pour annuler.",
    },
    {
      icon: CheckCircle,
      title: "Consultez votre dossier",
      text: "Le jour J, présentez-vous à l'accueil. Le médecin consulte votre historique dans Oltigo pour un suivi complet.",
    },
  ];

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Prendre rendez-vous avec Oltigo",
    description:
      "Guide étape par étape pour créer un rendez-vous en ligne, recevoir le rappel WhatsApp et confirmer sa venue.",
    totalTime: "PT5M",
    estimatedCost: { "@type": "MonetaryAmount", currency: "MAD", value: "0" },
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.text,
    })),
  };

  const speakableSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Tutoriel — Prendre rendez-vous avec Oltigo",
    url: `${siteUrl}/tutoriel`,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["#how-to-intro"],
    },
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <JsonLdScript data={howToSchema} nonce={nonce} />
      <JsonLdScript data={speakableSchema} nonce={nonce} />
      <BreadcrumbJsonLd
        nonce={nonce}
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Tutoriel", url: `${siteUrl}/tutoriel` },
        ]}
      />

      <h1 className="text-3xl font-bold mb-4">Comment prendre rendez-vous avec Oltigo ?</h1>
      <p id="how-to-intro" className="text-lg text-muted-foreground mb-10">
        En 4 étapes simples, réservez votre consultation en ligne, recevez un rappel WhatsApp en
        darija et arrivez préparé(e) à votre rendez-vous.
      </p>

      <ol className="relative border-s border-border ms-4 space-y-10 mb-12">
        {steps.map((step, index) => (
          <li key={step.title} className="ms-8">
            <span className="absolute flex items-center justify-center w-8 h-8 -start-4 rounded-full bg-primary/10 text-primary font-semibold text-sm ring-4 ring-background">
              {index + 1}
            </span>
            <step.icon className="size-6 text-primary mb-2" aria-hidden="true" />
            <h2 className="text-xl font-semibold mb-2">{step.title}</h2>
            <p className="text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="bg-muted rounded-2xl p-6 md:p-8 text-center" id="tutorial-cta">
        <p className="text-muted-foreground mb-4">
          Vous êtes praticien ? Votre cabinet peut proposer la réservation en ligne dès aujourd'hui.
        </p>
        <Link href="/register-clinic" className={buttonVariants({ size: "lg" })}>
          Ouvrir un compte gratuit
        </Link>
      </div>
    </div>
  );
}
