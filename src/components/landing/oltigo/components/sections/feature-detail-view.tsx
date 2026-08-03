/* eslint-disable i18next/no-literal-string */
"use client";

import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/landing/oltigo/components/ui/button";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "./section-kit";

const EXTRA_COPY: Record<
  string,
  { intro: string; how: { title: string; body: string }[]; cta: string }
> = {
  appointments: {
    intro:
      "Offrez à vos patients une page de réservation claire et à votre équipe une vue semaine unifiée. Moins d'appels, moins d'absences, plus de temps de soin.",
    how: [
      {
        title: "Partagez votre page",
        body: "Intégrez le lien de réservation sur votre site, WhatsApp ou fiches d'annuaire.",
      },
      {
        title: "Le patient choisit",
        body: "Il sélectionne le praticien, le motif et le créneau disponible en temps réel.",
      },
      {
        title: "Confirmation automatique",
        body: "Un email et un rappel WhatsApp partent instantanément après la réservation.",
      },
      {
        title: "Gestion centralisée",
        body: "Retrouvez tous les rendez-vous dans un agenda partagé, filtrable par praticien.",
      },
    ],
    cta: "Commencer à réduire les absences",
  },
  records: {
    intro:
      "Centralisez l'historique, les ordonnances et les documents de vos patients dans un dossier chiffré conforme à la Loi 09-08.",
    how: [
      {
        title: "Créez le dossier",
        body: "Saisissez les informations principales ou importez votre fichier existant.",
      },
      {
        title: "Enregistrez la consultation",
        body: "Rédigez notes, prescriptions et pièces jointes directement dans le dossier.",
      },
      {
        title: "Chiffrez et stockez",
        body: "Les données sont chiffrées AES-256-GCM et restent sur l'infrastructure marocaine.",
      },
      {
        title: "Consultez en toute sécurité",
        body: "Votre équipe accède au dossier en lecture contrôlée, traçable et cloisonnée.",
      },
    ],
    cta: "Sécuriser mes dossiers patients",
  },
  whatsapp: {
    intro:
      "Envoyez des rappels de rendez-vous en darija, validés par Meta, et recevez une confirmation par simple réponse « OUI ».",
    how: [
      {
        title: "Activez le modèle",
        body: "Choisissez parmi les 10 modèles de rappels pré-approuvés par Meta.",
      },
      {
        title: "Planifiez l'envoi",
        body: "Définissez l'heure du rappel avant chaque rendez-vous, par praticien.",
      },
      {
        title: "Le patient répond",
        body: "Il reçoit le message en darija et confirme en répondant « OUI ».",
      },
      {
        title: "Suivez les confirmations",
        body: "Votre agenda affiche en direct les statuts confirmé / absent.",
      },
    ],
    cta: "Réduire mes absences par WhatsApp",
  },
};

interface FeatureDetailViewProps {
  slug: string;
}

export function FeatureDetailView({ slug }: FeatureDetailViewProps) {
  const { dict, locale } = useI18n();
  const feature = dict.features.find((f) => f.id === slug);
  const extra = EXTRA_COPY[slug];

  if (!feature || !extra) {
    return null;
  }

  const isRtl = locale === "ar";

  return (
    <article className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow={dict.featuresHeading.eyebrow}
          title={feature.title}
          sub={extra.intro}
          as="h1"
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-xl text-text">Ce que ça change pour vous</h2>
            <ul className="mt-5 space-y-3">
              {feature.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-3 text-[14.5px] text-text-secondary">
                  <Check
                    className="mt-0.5 size-[18px] shrink-0 text-emerald"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl text-text">Comment ça marche</h2>
            <ol className="mt-5 space-y-5">
              {extra.how.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="telemetry flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline text-[12px] text-emerald">
                    {isRtl ? (i + 1).toLocaleString("ar-MA") : `0${i + 1}`}
                  </span>
                  <div>
                    <p className="text-[15px] font-medium text-text">{step.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-text-secondary">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <Reveal delay={120}>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              href="/register-clinic"
              data-event={`cta-feature-${slug}`}
            >
              {extra.cta}
              <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.75} />
            </Button>
            <Button variant="ghost" size="lg" href="/services" data-event="cta-feature-back">
              Voir toutes les fonctionnalités
            </Button>
          </div>
        </Reveal>
      </div>
    </article>
  );
}
