"use client";

import { HairlineRule } from "./hairline-rule";

/**
 * §3.1.6 Multi-tenant primitive.
 * One paragraph + mono subdomain diagram. Separated by hairlines.
 */
export function MultiTenantSection() {
  return (
    <section
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
        <div style={{ maxWidth: 720 }}>
          <h2
            style={{
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-h2)",
              lineHeight: "var(--lh-h2)",
              letterSpacing: "var(--ls-h2)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Un sous-domaine par cabinet. Aucune donnée n&apos;est partagée entre cabinets.
          </h2>

          <p
            style={{
              marginTop: "var(--space-5)",
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-body)",
              lineHeight: "var(--lh-body)",
              color: "var(--ink-70)",
            }}
          >
            Chaque cabinet dispose de son propre espace isolé. Les données patients, rendez-vous et
            configurations sont strictement cloisonnées par Row Level Security et chiffrement par
            fichier.
          </p>
        </div>

        <div style={{ marginTop: "var(--space-7)" }}>
          <HairlineRule />
          <div
            className="flex flex-wrap items-center gap-4"
            style={{
              paddingBlock: "var(--space-4)",
              fontFamily: "var(--font-mono-landing)",
              fontSize: "var(--text-mono)",
              lineHeight: "var(--lh-mono)",
              letterSpacing: "var(--ls-mono)",
              color: "var(--ink-60)",
            }}
          >
            <span>cabinet-a.oltigo.com</span>
            <span style={{ color: "var(--rule)" }}>│</span>
            <span>cabinet-b.oltigo.com</span>
            <span style={{ color: "var(--rule)" }}>│</span>
            <span>cabinet-c.oltigo.com</span>
          </div>
          <HairlineRule />
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
