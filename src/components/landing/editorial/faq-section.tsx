"use client";

import { HairlineRule } from "./hairline-rule";

const FAQS = [
  {
    question: "Mes données patients sont-elles sécurisées ?",
    answer:
      "Oui. Tous les fichiers patients sont chiffrés avec AES-256-GCM. L\u2019infrastructure est hébergée sur Cloudflare avec isolation par cabinet (Row Level Security). Nous sommes conformes à la Loi 09-08 sur la protection des données personnelles au Maroc.",
  },
  {
    question: "Combien coûte Oltigo ?",
    answer:
      "Nous proposons un plan gratuit pour tester la plateforme, puis des plans à partir de 199 MAD/mois. Le plan Professional à 599 MAD/mois inclut les rappels WhatsApp illimités et le dossier patient chiffré. Aucune carte bancaire n\u2019est requise pour commencer.",
  },
  {
    question: "Combien de temps prend la mise en place ?",
    answer:
      "Vous pouvez créer votre compte et commencer à recevoir des rendez-vous en moins de 10 minutes. La configuration complète (médecins, horaires, templates WhatsApp) prend généralement moins d\u2019une heure.",
  },
  {
    question: "Comment fonctionne l\u2019intégration WhatsApp ?",
    answer:
      "Oltigo utilise l\u2019API officielle Meta Cloud pour WhatsApp Business. 10 templates en darija sont pré-approuvés : rappels de RDV, confirmations, suivi post-consultation. Les messages sont envoyés automatiquement selon vos règles.",
  },
  {
    question: "La plateforme est-elle disponible en plusieurs langues ?",
    answer:
      "Oui. L\u2019interface est disponible en français, arabe (avec support RTL complet) et anglais. Les templates WhatsApp sont en darija pour une meilleure communication avec les patients.",
  },
  {
    question: "Puis-je exporter mes données ?",
    answer:
      "Oui. Vous pouvez exporter vos données patients, rendez-vous et statistiques au format CSV ou PDF à tout moment depuis votre tableau de bord. Vos données vous appartiennent.",
  },
  {
    question: "Oltigo est-il conforme aux réglementations marocaines ?",
    answer:
      "Oui. Oltigo est conforme à la Loi 09-08 relative à la protection des personnes physiques à l\u2019égard du traitement des données à caractère personnel. Le chiffrement AES-256-GCM et l\u2019isolation par cabinet garantissent la confidentialité des données de santé.",
  },
  {
    question: "Y a-t-il un essai gratuit ?",
    answer:
      "Oui. Le plan Free vous permet de tester la plateforme sans limite de temps avec les fonctionnalités de base. Vous pouvez passer à un plan supérieur à tout moment sans interruption de service.",
  },
];

/**
 * FAQ section — native details/summary accordion.
 * Clean editorial styling matching the Stripe Docs + Bloomberg Terminal aesthetic.
 */
export function FaqSection() {
  return (
    <section id="faq" className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {/* eslint-disable i18next/no-literal-string */}
        <HairlineRule />

        <div className="py-[var(--space-7)]">
          <h2 className="font-[var(--font-sans-landing)] text-[length:var(--text-h1)] leading-[var(--lh-h1)] tracking-[var(--ls-h1)] font-medium text-[var(--ink)]">
            Questions fréquentes
          </h2>
          <p
            suppressHydrationWarning
            className="mt-[var(--space-3)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]"
          >
            {FAQS.length} QUESTIONS · MISE À JOUR {new Date().toISOString().slice(0, 7)}
          </p>
        </div>

        <div>
          {FAQS.map((faq, i) => (
            <div key={i}>
              <HairlineRule />
              <details className="group py-[var(--space-5)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-[var(--font-sans-landing)] text-[length:var(--text-body-lg)] leading-[var(--lh-body-lg)] font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <span
                    className="shrink-0 font-[var(--font-mono-landing)] text-[length:var(--text-mono)] text-[var(--ink-60)] transition-transform duration-200 group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-[var(--space-4)] max-w-full md:max-w-[720px] font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)]">
                  {faq.answer}
                </p>
              </details>
            </div>
          ))}
        </div>

        <HairlineRule />
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
