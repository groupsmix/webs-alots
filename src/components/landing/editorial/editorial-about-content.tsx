"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

const PRINCIPLES = [
  {
    num: "01",
    title: "Donn\u00E9es du cabinet",
    body: "Les donn\u00E9es patients appartiennent au cabinet. Nous fournissons l\u2019outil et la sauvegarde.",
  },
  {
    num: "02",
    title: "Conformit\u00E9 d\u2019abord",
    body: "Loi 09-08 et CNDP avant toute fonctionnalit\u00E9.",
  },
  {
    num: "03",
    title: "Pas d\u2019exp\u00E9rimentation sur la production",
    body: "Les changements sensibles passent par un environnement de staging s\u00E9par\u00E9.",
  },
  {
    num: "04",
    title: "Compatibilit\u00E9 avec le d\u00E9part",
    body: "Vos donn\u00E9es sont exportables, lisibles et chiffr\u00E9es, \u00E0 tout moment.",
  },
] as const;

/**
 * Editorial about page \u2014 institutional, not team-grid.
 *
 * 1. One paragraph (max 80 words).
 * 2. Operating principles (4 items, hairline-separated).
 * 3. Soci\u00E9t\u00E9 metadata block.
 */
export function EditorialAboutContent() {
  const { t } = useLandingLocale();

  return (
    <div style={{ backgroundColor: "var(--bone)", color: "var(--ink)" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingTop: "var(--space-9)",
          paddingBottom: "var(--space-9)",
        }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        {/* 1. One paragraph */}
        <div style={{ maxWidth: "720px" }}>
          <h1
            style={{
              fontSize: "var(--text-h1)",
              lineHeight: "var(--lh-h1)",
              letterSpacing: "var(--ls-h1)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            {t("landing.footerAbout")}
          </h1>
          <p
            className="mt-[var(--space-5)]"
            style={{
              fontSize: "var(--text-body-lg)",
              lineHeight: "var(--lh-body-lg)",
              color: "var(--ink-70)",
            }}
          >
            {"Oltigo Health a \u00E9t\u00E9 fond\u00E9 \u00E0 Casablanca pour combler le vide r\u00E9glementaire dans le SaaS clinique au Maroc. La plateforme g\u00E8re rendez-vous, dossiers patients, prescriptions, facturation et notifications WhatsApp derri\u00E8re un sous-domaine par cabinet. Chaque d\u00E9cision technique est subordonn\u00E9e \u00E0 la Loi 09-08 et \u00E0 la protection des donn\u00E9es de sant\u00E9."}
          </p>
        </div>

        {/* 2. Operating principles */}
        <div className="mt-[var(--space-9)]">
          <h2
            style={{
              fontSize: "var(--text-h2)",
              lineHeight: "var(--lh-h2)",
              letterSpacing: "var(--ls-h2)",
              fontWeight: 500,
              color: "var(--ink)",
              marginBottom: "var(--space-7)",
            }}
          >
            {"Principes de fonctionnement"}
          </h2>

          {PRINCIPLES.map(({ num, title, body }) => (
            <div key={num}>
              <HairlineRule />
              <div className="py-[var(--space-5)]">
                <h3
                  style={{
                    fontSize: "var(--text-body)",
                    lineHeight: "var(--lh-body)",
                    fontWeight: 500,
                    color: "var(--ink)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono-landing)",
                      fontSize: "var(--text-mono)",
                      letterSpacing: "var(--ls-mono)",
                      color: "var(--ink-60)",
                      marginInlineEnd: "var(--space-3)",
                    }}
                  >
                    {num}
                  </span>
                  {title}
                </h3>
                <p
                  className="mt-[var(--space-2)]"
                  style={{
                    fontSize: "var(--text-body)",
                    lineHeight: "var(--lh-body)",
                    color: "var(--ink-70)",
                    maxWidth: "720px",
                    paddingInlineStart: "calc(var(--text-mono) * 3 + var(--space-3))",
                  }}
                >
                  {body}
                </p>
              </div>
            </div>
          ))}
          <HairlineRule />
        </div>

        {/* 3. Soci\u00E9t\u00E9 */}
        <div className="mt-[var(--space-9)]">
          <h2
            style={{
              fontSize: "var(--text-h2)",
              lineHeight: "var(--lh-h2)",
              letterSpacing: "var(--ls-h2)",
              fontWeight: 500,
              color: "var(--ink)",
              marginBottom: "var(--space-5)",
            }}
          >
            {"Soci\u00E9t\u00E9"}
          </h2>

          <address
            className="not-italic"
            style={{
              fontFamily: "var(--font-mono-landing)",
              fontSize: "var(--text-mono)",
              lineHeight: 1.8,
              letterSpacing: "var(--ls-mono)",
              color: "var(--ink-60)",
            }}
          >
            <p>{"Oltigo Health / MediaHoly"}</p>
            <p>{t("landing.footerRegistration" as TranslationKey)}</p>
            <p>{"Casablanca, Maroc"}</p>
            <p>{"DPO : dpo@oltigo.com"}</p>
          </address>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </div>
  );
}
