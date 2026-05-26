"use client";

import { SectionHeading } from "./section-heading";

const INSURANCES = [
  { code: "CNSS", taux: "70 %", delai: "45 jours", note: "feuille de soins auto-générée" },
  { code: "CNOPS", taux: "80 %", delai: "30 jours", note: "feuille de soins auto-générée" },
  { code: "AMO", taux: "70 %", delai: "60 jours", note: "feuille de soins auto-générée" },
  { code: "RAMED", taux: "100 %", delai: "N/A", note: "carte validée automatiquement" },
];

export function InsuranceSection() {
  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "var(--lab-linen)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <SectionHeading
          fr="L'assurance, déjà programmée."
          ar="التأمين، مبرمج سابقا."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {INSURANCES.map((ins) => (
            <div
              key={ins.code}
              className="rounded-xl border p-6"
              style={{ borderColor: "var(--rule)", backgroundColor: "var(--bone)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)" }}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: "var(--bone-2)", color: "var(--graphite)" }}
              >
                {ins.code[0]}{ins.code[1]}
              </div>
              <p className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
                {ins.code}
              </p>
              <div
                className="space-y-1 text-xs"
                style={{ fontFamily: "var(--font-mono-landing)", color: "var(--ink-60)", fontVariantNumeric: "tabular-nums" }}
              >
                <p>taux remboursement · {ins.taux}</p>
                <p>délai moyen · {ins.delai}</p>
                <p>{ins.note}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm" style={{ color: "var(--ink-60)" }}>
          Aucune saisie manuelle de plus que nécessaire.
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
