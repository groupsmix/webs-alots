"use client";

import { HairlineRule } from "../hairline-rule";
import { StatBlock } from "../stat-block";

const CLAIMS = [
  {
    value: "99,95%",
    label: "DISPONIBILIT\u00C9",
    description: "90 derniers jours. Cloudflare Workers, edges Casablanca + UE.",
  },
  {
    value: "AES-256-GCM",
    label: "CHIFFREMENT",
    description: "Chiffrement par fichier pour documents patients. IV unique par envoi.",
  },
  {
    value: "Loi 09-08",
    label: "CONFORME",
    description: "Traitement enregistr\u00E9 CNDP.",
  },
  {
    value: "< 200 ms",
    label: "P95 \u00C9CRITURE RDV",
    description: "Latence p95 \u00E9criture rendez-vous.",
  },
] as const;

/**
 * Four claims with evidence \u2014 four columns, hairline-separated, no cards.
 * Last-refreshed mono caption below.
 */
export function ClaimsSection() {
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
        {/* eslint-disable i18next/no-literal-string */}
        <div className="grid grid-cols-1 gap-[var(--space-7)] sm:grid-cols-2 lg:grid-cols-4">
          {CLAIMS.map(({ value, label }) => (
            <StatBlock
              key={label}
              value={value}
              label={label}
            />
          ))}
        </div>

        {/* Last refreshed caption */}
        <p
          className="mt-[var(--space-7)]"
          style={{
            fontFamily: "var(--font-mono-landing)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            letterSpacing: "var(--ls-mono)",
            color: "var(--ink-60)",
          }}
        >
          {"derni\u00E8re mise \u00E0 jour 2026-05-27 09:14 UTC"}
        </p>
        {/* eslint-enable i18next/no-literal-string */}

        <HairlineRule className="mt-[var(--space-7)]" />
      </div>
    </section>
  );
}
