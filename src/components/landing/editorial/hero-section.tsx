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
    <section style={{ backgroundColor: "var(--bone)" }}>
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
        }}
      >
        {/* eslint-disable i18next/no-literal-string */}

        {/* Spacer: --space-9 (96px) */}
        <div style={{ height: "var(--space-9)" }} />

        {/* Mono eyebrow */}
        <div
          className="flex items-center gap-2"
          style={{
            fontFamily: "var(--font-mono-landing)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            letterSpacing: "var(--ls-mono)",
            textTransform: "uppercase",
            fontWeight: 500,
            color: "var(--ink-60)",
          }}
        >
          V 16.0 · RÉGION CASABLANCA · STATUT <StatusDot />
        </div>

        {/* Spacer */}
        <div style={{ height: "var(--space-5)" }} />

        {/* Display headline — 75% width */}
        <h1
          style={{
            fontFamily: "var(--font-sans-landing)",
            fontSize: "clamp(2.5rem, 5vw, var(--text-display))",
            lineHeight: "var(--lh-display)",
            letterSpacing: "var(--ls-display)",
            fontWeight: 500,
            color: "var(--ink)",
            maxWidth: "75%",
          }}
        >
          La plateforme complète pour gérer votre cabinet médical.
        </h1>

        {/* Spacer */}
        <div style={{ height: "var(--space-5)" }} />

        {/* Subhead — 58% width */}
        <p
          style={{
            fontFamily: "var(--font-sans-landing)",
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--lh-body-lg)",
            color: "var(--ink-70)",
            maxWidth: "58%",
          }}
        >
          Créez le site de votre cabinet, gérez les rendez-vous et développez
          votre activité facilement.
        </p>

        {/* Spacer */}
        <div style={{ height: "var(--space-6)" }} />

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Primary CTA */}
          <Link
            href="/register-clinic"
            className="group inline-flex items-center gap-2"
            style={{
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-small)",
              fontWeight: 500,
              height: 44,
              paddingInline: 24,
              borderRadius: "var(--radius-landing)",
              backgroundColor: "var(--oltigo-green)",
              color: "var(--bone)",
              textDecoration: "none",
              transition: `opacity var(--duration) var(--easing)`,
            }}
          >
            Ouvrir un compte
            <ArrowRight
              style={{
                width: 16,
                height: 16,
                transition: `transform var(--duration) var(--easing)`,
              }}
              className="group-hover:translate-x-0.5"
            />
          </Link>

          {/* Ghost CTA */}
          <a
            href="#contact"
            style={{
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-small)",
              fontWeight: 500,
              color: "var(--oltigo-green)",
              textDecoration: "none",
              textUnderlineOffset: 4,
              transition: `text-decoration var(--duration) var(--easing)`,
            }}
            className="hover:underline"
          >
            Parler aux ventes →
          </a>
        </div>

        {/* Spacer: --space-10 (128px) */}
        <div style={{ height: "var(--space-10)" }} />

        {/* Trust hairline (top) */}
        <HairlineRule />

        {/* Trust strip: 4 stat blocks */}
        <div style={{ paddingBlock: "var(--space-5)" }}>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <StatBlock value="99,95%" label="Disponibilité" />
            <StatBlock value="AES-256-GCM" label="Chiffrement" />
            <StatBlock value="Loi 09-08" label="Conforme" />
            <StatBlock value="< 200 ms" label="P95 écriture RDV" />
          </div>
        </div>

        {/* Trust hairline (bottom) */}
        <HairlineRule />

        {/* Spacer: --space-9 */}
        <div style={{ height: "var(--space-9)" }} />

        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
