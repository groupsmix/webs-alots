"use client";

import { ArrowRight, Check, X, Minus } from "lucide-react";
import Link from "next/link";
import {
  COMPETITORS,
  COMPARISON_FEATURES,
  CATEGORY_LABELS,
  getFeaturesByCategory,
  type FeatureSupport,
  type ComparisonCategory,
} from "@/lib/competitor-comparison";

function SupportIcon({ value }: { value: FeatureSupport }) {
  switch (value) {
    case "full":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center text-primary">
          <Check className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Inclus</span>
        </span>
      );
    case "partial":
      return (
        <span
          className="inline-flex h-6 w-6 items-center justify-center"
          style={{ color: "var(--signal-amber)" }}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Partiel</span>
        </span>
      );
    case "none":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground/40">
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Non inclus</span>
        </span>
      );
  }
}

/**
 * Compact comparison section for the landing page.
 * Shows a subset of features with a link to the full comparison.
 */
function _ComparisonSection() {
  const grouped = getFeaturesByCategory();
  const highlightCategories: ComparisonCategory[] = ["pricing", "ai", "whatsapp", "prescriptions"];

  const previewFeatures = highlightCategories.flatMap((cat) => grouped[cat]?.slice(0, 2) ?? []);

  return (
    <section id="comparatif" className="bg-muted py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Comparatif
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Pourquoi choisir Oltigo ?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Comparez les fonctionnalités d&apos;Oltigo avec les autres solutions du marché marocain.
          </p>
        </div>

        {/* Desktop table */}
        <div className="mt-12 hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  Fonctionnalité
                </th>
                {COMPETITORS.map((c) => (
                  <th
                    key={c.id}
                    className={`px-4 py-4 text-center font-semibold ${
                      c.highlight ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewFeatures.map((feature, idx) => (
                <tr
                  key={feature.label}
                  className={idx % 2 === 0 ? "bg-transparent" : "bg-muted/50"}
                >
                  <td className="py-3 pr-4 text-foreground">{feature.label}</td>
                  {COMPETITORS.map((c) => (
                    <td key={c.id} className="px-4 py-3 text-center">
                      <SupportIcon value={feature.values[c.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mt-12 space-y-4 md:hidden">
          {previewFeatures.map((feature) => (
            <div key={feature.label} className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 font-medium text-foreground">{feature.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {COMPETITORS.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <SupportIcon value={feature.values[c.id]} />
                    <span
                      className={
                        c.highlight ? "font-semibold text-primary" : "text-muted-foreground"
                      }
                    >
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <SupportIcon value="full" />
            <span>Inclus</span>
          </div>
          <div className="flex items-center gap-2">
            <SupportIcon value="partial" />
            <span>Partiel</span>
          </div>
          <div className="flex items-center gap-2">
            <SupportIcon value="none" />
            <span>Non disponible</span>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/compare"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voir le comparatif complet
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Full comparison table for the dedicated /compare page.
 * Shows all features grouped by category.
 */
export function FullComparisonTable() {
  const grouped = getFeaturesByCategory();
  const categories = Object.keys(grouped) as ComparisonCategory[];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Legend */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <SupportIcon value="full" />
          <span>Inclus</span>
        </div>
        <div className="flex items-center gap-2">
          <SupportIcon value="partial" />
          <span>Partiel</span>
        </div>
        <div className="flex items-center gap-2">
          <SupportIcon value="none" />
          <span>Non disponible</span>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b border-border">
              <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                Fonctionnalité
              </th>
              {COMPETITORS.map((c) => (
                <th
                  key={c.id}
                  className={`px-4 py-4 text-center font-semibold ${
                    c.highlight ? "text-primary" : "text-foreground"
                  }`}
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <>
                <tr key={`cat-${category}`}>
                  <td
                    colSpan={COMPETITORS.length + 1}
                    className="pb-2 pt-6 font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary"
                  >
                    {CATEGORY_LABELS[category]}
                  </td>
                </tr>
                {grouped[category].map((feature, idx) => (
                  <tr
                    key={feature.label}
                    className={idx % 2 === 0 ? "bg-transparent" : "bg-muted/50"}
                  >
                    <td className="py-3 pr-4 text-foreground">{feature.label}</td>
                    {COMPETITORS.map((c) => (
                      <td key={c.id} className="px-4 py-3 text-center">
                        <SupportIcon value={feature.values[c.id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: grouped cards */}
      <div className="space-y-8 md:hidden">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="space-y-3">
              {grouped[category].map((feature) => (
                <div key={feature.label} className="rounded-lg border border-border bg-card p-4">
                  <p className="mb-3 font-medium text-foreground">{feature.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {COMPETITORS.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        <SupportIcon value={feature.values[c.id]} />
                        <span
                          className={
                            c.highlight ? "font-semibold text-primary" : "text-muted-foreground"
                          }
                        >
                          {c.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Score summary */}
      <div className="mt-12 rounded-lg border border-border bg-muted p-8 text-center">
        <p className="text-lg font-semibold text-foreground">
          Oltigo couvre{" "}
          <span className="text-primary">
            {COMPARISON_FEATURES.filter((f) => f.values.oltigo === "full").length}
          </span>{" "}
          fonctionnalités sur <span className="text-primary">{COMPARISON_FEATURES.length}</span> —
          plus que tout autre concurrent.
        </p>
        <Link
          href="/register-clinic"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Commencer gratuitement
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
