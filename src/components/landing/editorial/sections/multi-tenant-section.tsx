"use client";

import { HairlineRule } from "../hairline-rule";

/**
 * Multi-tenant primitive \u2014 a section other clinic-SaaS products never include.
 *
 * One paragraph + mono diagram of subdomain isolation.
 */
export function MultiTenantSection() {
  return (
    <section style={{ backgroundColor: "var(--bone)" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingBlock: "var(--space-9)",
        }}
      >
        <HairlineRule />

        <div className="mt-[var(--space-7)]" style={{ maxWidth: "720px" }}>
          {/* eslint-disable i18next/no-literal-string */}
          <h2
            style={{
              fontSize: "var(--text-h2)",
              lineHeight: "var(--lh-h2)",
              letterSpacing: "var(--ls-h2)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            {"Un sous-domaine par cabinet"}
          </h2>
          <p
            className="mt-[var(--space-5)]"
            style={{
              fontSize: "var(--text-body-lg)",
              lineHeight: "var(--lh-body-lg)",
              color: "var(--ink-70)",
            }}
          >
            {"Un sous-domaine par cabinet. Aucune donn\u00E9e n\u2019est partag\u00E9e entre cabinets. Chaque cabinet dispose de sa propre base de donn\u00E9es isol\u00E9e, prot\u00E9g\u00E9e par des politiques Row Level Security."}
          </p>

          {/* Mono subdomain diagram */}
          <div
            className="mt-[var(--space-7)] flex flex-wrap items-center gap-[var(--space-5)]"
            style={{
              fontFamily: "var(--font-mono-landing)",
              fontSize: "var(--text-mono)",
              lineHeight: "var(--lh-mono)",
              letterSpacing: "var(--ls-mono)",
              color: "var(--ink-60)",
            }}
          >
            <span>{"cabinet-a.oltigo.com"}</span>
            <span style={{ color: "var(--rule)" }}>{"\u2502"}</span>
            <span>{"cabinet-b.oltigo.com"}</span>
            <span style={{ color: "var(--rule)" }}>{"\u2502"}</span>
            <span>{"cabinet-c.oltigo.com"}</span>
          </div>
          {/* eslint-enable i18next/no-literal-string */}
        </div>
      </div>
    </section>
  );
}
