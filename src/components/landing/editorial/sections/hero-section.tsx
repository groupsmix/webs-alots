"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../../landing-locale-provider";
import { HairlineRule } from "../hairline-rule";
import { StatusDot } from "../status-dot";

const TRUST_STATS = [
  { value: "99,95%", label: "DISPONIBILIT\u00C9", desc: "90 derniers jours" },
  { value: "AES-256-GCM", label: "CHIFFREMENT", desc: "IV unique par envoi" },
  { value: "LOI 09-08", label: "CONFORME", desc: "Traitement enregistr\u00E9 CNDP" },
  { value: "< 200 MS", label: "P95 \u00C9CRITURE RDV", desc: "Cloudflare Workers" },
] as const;

/**
 * Hero — pixel-level spec from \u00A74.1/4.2.
 *
 * Desktop 1440: nav(64) + space(96) + eyebrow(20) + gap(24)
 *   + headline(~144) + gap(24) + subhead(~60) + gap(32)
 *   + CTAs(44) + gap(128) + trust strip.
 *
 * Mobile 390: compact layout with 2\u00D72 trust grid.
 */
export function HeroSection() {
  const { t } = useLandingLocale();

  return (
    <section
      style={{ backgroundColor: "var(--bone)" }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
        }}
      >
        {/* Top spacing */}
        <div style={{ height: "var(--space-9)" }} />

        {/* Mono eyebrow */}
        {/* eslint-disable i18next/no-literal-string */}
        <div
          className="flex items-center gap-[var(--space-2)]"
          style={{
            fontFamily: "var(--font-mono-landing)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            letterSpacing: "var(--ls-mono)",
            textTransform: "uppercase",
            color: "var(--ink-60)",
          }}
        >
          <span>{"V 16.0"}</span>
          <span>{"\u00B7"}</span>
          <span>{"R\u00C9GION CASABLANCA"}</span>
          <span>{"\u00B7"}</span>
          <span className="inline-flex items-center gap-[var(--space-1)]">
            {"STATUT"}
            <StatusDot variant="operational" />
          </span>
        </div>

        {/* Gap: eyebrow → headline */}
        <div style={{ height: "var(--space-5)" }} />

        {/* Display headline */}
        <h1
          style={{
            fontSize: "var(--text-display)",
            lineHeight: "var(--lh-display)",
            letterSpacing: "var(--ls-display)",
            fontWeight: 500,
            color: "var(--ink)",
            maxWidth: "75%",
          }}
        >
          {t("landing.heroTitle1" as TranslationKey)}{" "}
          {t("landing.heroTitle2" as TranslationKey)}
        </h1>

        {/* Gap: headline → subhead */}
        <div style={{ height: "var(--space-5)" }} />

        {/* Subhead */}
        <p
          style={{
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--lh-body-lg)",
            color: "var(--ink-70)",
            maxWidth: "58.33%",
          }}
        >
          {t("landing.heroSubtitle")}
        </p>

        {/* Gap: subhead → CTAs */}
        <div style={{ height: "var(--space-6)" }} />

        {/* CTA row */}
        <div className="flex flex-wrap items-center gap-[var(--space-5)]">
          {/* Primary CTA */}
          <Link
            href="/register-clinic"
            className="landing-btn group inline-flex items-center gap-[var(--space-2)]"
            style={{
              height: "44px",
              paddingInline: "var(--space-5)",
              backgroundColor: "var(--oltigo-green)",
              color: "var(--bone)",
              borderRadius: "var(--radius-landing)",
              fontSize: "var(--text-small)",
              fontWeight: 500,
              textDecoration: "none",
              transitionProperty: "background-color",
              transitionDuration: "var(--duration)",
              transitionTimingFunction: "var(--easing)",
            }}
          >
            {t("landing.ctaOpenAccount" as TranslationKey)}
            <ArrowRight
              size={16}
              strokeWidth={1.5}
              className="cta-arrow transition-transform"
              style={{
                transitionDuration: "var(--duration)",
                transitionTimingFunction: "var(--easing)",
              }}
            />
          </Link>

          {/* Ghost CTA */}
          <Link
            href="/contact"
            className="inline-flex items-center gap-[var(--space-2)] transition-colors"
            style={{
              fontSize: "var(--text-small)",
              fontWeight: 500,
              color: "var(--oltigo-green)",
              textDecoration: "none",
              transitionDuration: "var(--duration)",
            }}
          >
            {t("landing.ctaTalkToSales" as TranslationKey)}
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </div>

        {/* Gap: CTAs → trust hairline */}
        <div style={{ height: "var(--space-10)" }} />

        {/* Trust strip */}
        <HairlineRule />

        <div
          className="grid grid-cols-2 gap-[var(--space-5)] py-[var(--space-5)] lg:grid-cols-4"
          style={{
            fontFamily: "var(--font-mono-landing)",
          }}
        >
          {TRUST_STATS.map(({ value, label }) => (
            <div key={label}>
              <p
                style={{
                  fontSize: "var(--text-small)",
                  fontWeight: 500,
                  color: "var(--ink)",
                  lineHeight: "var(--lh-small)",
                }}
              >
                {value}
              </p>
              <p
                className="mt-[var(--space-1)]"
                style={{
                  fontSize: "var(--text-mono)",
                  lineHeight: "var(--lh-mono)",
                  letterSpacing: "var(--ls-mono)",
                  textTransform: "uppercase",
                  color: "var(--ink-60)",
                }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        <HairlineRule />
        {/* eslint-enable i18next/no-literal-string */}

        {/* Gap to next section */}
        <div style={{ height: "var(--space-9)" }} />
      </div>
    </section>
  );
}
