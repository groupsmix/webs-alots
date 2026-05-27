"use client";

import { HairlineRule } from "./hairline-rule";

const CASE_STUDIES = [
  {
    eyebrow: "CASABLANCA \u00B7 CABINET G\u00C9N\u00C9RALISTE \u00B7 3 M\u00C9DECINS",
    headline: "3 200 RDV en 6 mois, 84 % par WhatsApp.",
    context:
      "Le Cabinet Bennani g\u00E9rait ses rendez-vous par t\u00E9l\u00E9phone et carnet papier. Apr\u00E8s migration vers Oltigo, 84 % des r\u00E9servations passent par le lien WhatsApp envoy\u00E9 automatiquement aux patients.",
    stats: [
      { value: "533", label: "RDV/MOIS" },
      { value: "12%", label: "NO-SHOW" },
      { value: "91%", label: "CONFIRM. WHATSAPP" },
    ],
    quote:
      "On a r\u00E9cup\u00E9r\u00E9 2h par jour que la r\u00E9ceptionniste passait au t\u00E9l\u00E9phone.",
    attribution: "Dr Fatima B., Cabinet Bennani, Casablanca",
    metadata: "EN PRODUCTION DEPUIS \u00B7 2024-09 \u00B7 PLAN PROFESSIONAL",
  },
] as const;

/**
 * Customers page \u2014 concrete, named, attributable evidence.
 * Single column, max-width 760px.
 * If fewer than 4 attributed case studies, show count of remaining.
 */
export function EditorialCustomersContent() {
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
        <h1
          style={{
            fontSize: "var(--text-h1)",
            lineHeight: "var(--lh-h1)",
            letterSpacing: "var(--ls-h1)",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: "var(--space-7)",
          }}
        >
          {"Clients"}
        </h1>

        <div style={{ maxWidth: "760px" }}>
          {CASE_STUDIES.map(({ eyebrow, headline, context, stats, quote, attribution, metadata }) => (
            <div key={headline} className="mb-[var(--space-9)]">
              <HairlineRule />

              {/* Eyebrow */}
              <p
                className="mt-[var(--space-5)]"
                style={{
                  fontFamily: "var(--font-mono-landing)",
                  fontSize: "var(--text-mono)",
                  lineHeight: "var(--lh-mono)",
                  letterSpacing: "var(--ls-mono)",
                  textTransform: "uppercase",
                  color: "var(--ink-60)",
                }}
              >
                {eyebrow}
              </p>

              {/* Headline (a number) */}
              <h2
                className="mt-[var(--space-3)]"
                style={{
                  fontSize: "var(--text-h2)",
                  lineHeight: "var(--lh-h2)",
                  letterSpacing: "var(--ls-h2)",
                  fontWeight: 500,
                  color: "var(--ink)",
                }}
              >
                {headline}
              </h2>

              {/* Context */}
              <p
                className="mt-[var(--space-5)]"
                style={{
                  fontSize: "var(--text-body)",
                  lineHeight: "var(--lh-body)",
                  color: "var(--ink-70)",
                }}
              >
                {context}
              </p>

              {/* Stats row */}
              <div className="mt-[var(--space-5)] grid grid-cols-3 gap-[var(--space-5)]">
                {stats.map(({ value, label }) => (
                  <div key={label}>
                    <p
                      style={{
                        fontSize: "var(--text-h3)",
                        lineHeight: "var(--lh-h3)",
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      {value}
                    </p>
                    <p
                      className="mt-[var(--space-1)]"
                      style={{
                        fontFamily: "var(--font-mono-landing)",
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

              {/* Quote */}
              <blockquote
                className="mt-[var(--space-5)]"
                style={{
                  fontSize: "var(--text-body-lg)",
                  lineHeight: "var(--lh-body-lg)",
                  fontStyle: "italic",
                  color: "var(--ink)",
                }}
              >
                {`\u00AB ${quote} \u00BB`}
              </blockquote>

              {/* Attribution */}
              <p
                className="mt-[var(--space-3)]"
                style={{
                  fontFamily: "var(--font-mono-landing)",
                  fontSize: "var(--text-mono)",
                  lineHeight: "var(--lh-mono)",
                  letterSpacing: "var(--ls-mono)",
                  color: "var(--ink-60)",
                }}
              >
                {`\u2014 ${attribution}`}
              </p>

              {/* Metadata */}
              <p
                className="mt-[var(--space-3)]"
                style={{
                  fontFamily: "var(--font-mono-landing)",
                  fontSize: "var(--text-mono)",
                  lineHeight: "var(--lh-mono)",
                  letterSpacing: "var(--ls-mono)",
                  textTransform: "uppercase",
                  color: "var(--ink-60)",
                }}
              >
                {metadata}
              </p>
            </div>
          ))}

          <HairlineRule />

          {/* Pending studies */}
          <p
            className="mt-[var(--space-5)]"
            style={{
              fontFamily: "var(--font-mono-landing)",
              fontSize: "var(--text-mono)",
              lineHeight: "var(--lh-mono)",
              letterSpacing: "var(--ls-mono)",
              color: "var(--ink-60)",
            }}
          >
            {"3 autres \u00E9tudes en pr\u00E9paration"}
          </p>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </div>
  );
}
