"use client";

import { HairlineRule } from "./hairline-rule";

const PRODUCTS = [
  {
    label: "Rendez-vous",
    description:
      "Prise de rendez-vous en ligne pour vos patients. Confirmation automatique, rappels WhatsApp, vue agenda unifiée.",
  },
  {
    label: "Dossier patient",
    description:
      "Dossiers chiffrés AES-256-GCM. Historique complet, ordonnances, résultats — accessibles uniquement par votre équipe.",
  },
  {
    label: "Rappels & WhatsApp",
    description:
      "10 templates Darija pré-approuvés Meta. Rappels automatiques, confirmations, suivi post-consultation.",
  },
];

/**
 * §3.1.4 Product Anatomy — 3 rows × 2 columns.
 * Left = label + description, right = screenshot placeholder.
 * Separated by --rule. No device frames, no rotation, no shadows.
 */
export function ProductSection() {
  return (
    <section
      id="product"
      style={{
        backgroundColor: "var(--bone)",
        paddingBlock: "var(--space-9)",
      }}
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
        }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        {PRODUCTS.map((product, i) => (
          <div key={product.label}>
            {i > 0 && <HairlineRule />}
            <div
              className="grid gap-8 md:grid-cols-2 md:items-center"
              style={{ paddingBlock: "var(--space-7)" }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-sans-landing)",
                    fontSize: "var(--text-h3)",
                    lineHeight: "var(--lh-h3)",
                    letterSpacing: "var(--ls-h3)",
                    fontWeight: 500,
                    color: "var(--ink)",
                  }}
                >
                  {product.label}
                </h3>
                <p
                  style={{
                    marginTop: "var(--space-3)",
                    fontFamily: "var(--font-sans-landing)",
                    fontSize: "var(--text-body)",
                    lineHeight: "var(--lh-body)",
                    color: "var(--ink-70)",
                  }}
                >
                  {product.description}
                </p>
              </div>

              {/* Screenshot placeholder — replace with real product PNGs */}
              <div
                style={{
                  aspectRatio: "16 / 10",
                  borderRadius: "var(--radius-landing)",
                  border: "1px solid var(--rule)",
                  backgroundColor: "var(--bone)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono-landing)",
                    fontSize: "var(--text-mono)",
                    color: "var(--ink-60)",
                    textTransform: "uppercase",
                    letterSpacing: "var(--ls-mono)",
                  }}
                >
                  Capture {product.label}
                </span>
              </div>
            </div>
          </div>
        ))}
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
