"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HairlineRule } from "./hairline-rule";
import { StatBlock } from "./stat-block";
import { StatusDot } from "./status-dot";

/**
 * §3.1 / §4.1 Hero — editorial-institutional.
 * Mono eyebrow → display headline → body-lg subhead → CTAs → trust strip.
 */
export function EditorialHero() {
  return (
    <section className="bg-[var(--bone)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {/* eslint-disable i18next/no-literal-string */}

        {/* Spacer: --space-9 (96px) */}
        <div className="h-[var(--space-9)]" />

        {/* Mono eyebrow */}
        <div className="flex items-center gap-2 font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase font-medium text-[var(--ink-60)]">
          V 16.0 · RÉGION CASABLANCA · STATUT <StatusDot />
        </div>

        {/* Spacer */}
        <div className="h-[var(--space-5)]" />

        {/* Display headline — 75% width */}
        <h1 className="font-[var(--font-sans-landing)] text-[length:clamp(2.5rem,5vw,var(--text-display))] leading-[var(--lh-display)] tracking-[var(--ls-display)] font-medium text-[var(--ink)] max-w-full md:max-w-[75%]">
          La plateforme complète pour gérer votre cabinet médical.
        </h1>

        {/* Spacer */}
        <div className="h-[var(--space-5)]" />

        {/* Subhead — 58% width */}
        <p className="font-[var(--font-sans-landing)] text-[length:var(--text-body-lg)] leading-[var(--lh-body-lg)] text-[var(--ink-70)] max-w-full md:max-w-[58%]">
          Créez le site de votre cabinet, gérez les rendez-vous et développez votre activité
          facilement.
        </p>

        {/* Spacer */}
        <div className="h-[var(--space-6)]" />

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Primary CTA */}
          <Link
            href="/register-clinic"
            className="group inline-flex items-center gap-2 font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium h-11 px-6 rounded-[var(--radius-landing)] bg-[var(--oltigo-green)] text-[var(--bone)] no-underline transition-opacity duration-[var(--duration)] ease-[var(--easing)]"
          >
            Ouvrir un compte
            <ArrowRight className="size-4 transition-transform duration-[var(--duration)] ease-[var(--easing)] group-hover:translate-x-0.5" />
          </Link>

          {/* Ghost CTA */}
          <a
            href="#contact"
            className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--oltigo-green)] no-underline underline-offset-4 transition-[text-decoration] duration-[var(--duration)] ease-[var(--easing)] hover:underline"
          >
            Parler aux ventes →
          </a>
        </div>

        {/* Spacer: --space-10 (128px) */}
        <div className="h-[var(--space-10)]" />

        {/* Trust hairline (top) */}
        <HairlineRule />

        {/* Trust strip: 4 stat blocks */}
        <div className="py-[var(--space-5)]">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
            <StatBlock value="50+" label="Cabinets" />
            <StatBlock value="10 000+" label="RDV gérés" />
            <StatBlock value="99,95%" label="Disponibilité" />
            <StatBlock value="AES-256-GCM" label="Chiffrement" />
            <StatBlock value="Loi 09-08" label="Conforme" />
            <StatBlock value="< 200 ms" label="P95 écriture RDV" />
          </div>
        </div>

        {/* Trust hairline (bottom) */}
        <HairlineRule />

        {/* Spacer: --space-9 */}
        <div className="h-[var(--space-9)]" />

        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
