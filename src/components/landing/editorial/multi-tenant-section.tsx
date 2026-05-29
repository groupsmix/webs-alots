"use client";

import { HairlineRule } from "./hairline-rule";

/**
 * §3.1.6 Multi-tenant primitive.
 * One paragraph + mono subdomain diagram. Separated by hairlines.
 */
export function MultiTenantSection() {
  return (
    <section className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {/* eslint-disable i18next/no-literal-string */}
        <div className="max-w-full md:max-w-[720px]">
          <h2 className="font-[var(--font-sans-landing)] text-[length:var(--text-h2)] leading-[var(--lh-h2)] tracking-[var(--ls-h2)] font-medium text-[var(--ink)]">
            Un sous-domaine par cabinet. Aucune donnée n&apos;est partagée entre cabinets.
          </h2>

          <p className="mt-[var(--space-5)] font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)]">
            Chaque cabinet dispose de son propre espace isolé. Les données patients, rendez-vous et
            configurations sont strictement cloisonnées par Row Level Security et chiffrement par
            fichier.
          </p>
        </div>

        <div className="mt-[var(--space-7)]">
          <HairlineRule />
          <div className="flex flex-wrap items-center gap-4 py-[var(--space-4)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
            <span>cabinet-a.oltigo.com</span>
            <span className="text-[var(--rule)]">│</span>
            <span>cabinet-b.oltigo.com</span>
            <span className="text-[var(--rule)]">│</span>
            <span>cabinet-c.oltigo.com</span>
          </div>
          <HairlineRule />
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
