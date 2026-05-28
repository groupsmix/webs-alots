import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingLocaleProvider } from "@/components/landing/landing-locale-provider";
import { FullComparisonTable } from "@/components/marketing/comparison-table";

export const metadata: Metadata = {
  title: "Comparatif — Oltigo vs IYADA, SmartDoc, CABIDOC, Pratisoft",
  description:
    "Comparez Oltigo avec les autres solutions de gestion de cabinet médical au Maroc : IYADA, SmartDoc, CABIDOC et Pratisoft. IA, WhatsApp, QR, multi-tenant et plus.",
  openGraph: {
    title: "Comparatif — Oltigo vs concurrents | Oltigo",
    description:
      "Tableau comparatif complet des fonctionnalités : tarifs, IA, WhatsApp, facturation assurance, ordonnances QR et plus.",
  },
};

export default function ComparePage() {
  return (
    <LandingLocaleProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <LandingHeader />
        <main className="flex-1">
          {/* Header */}
          <div className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6">
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
              <span className="text-muted-foreground">01 — </span>Comparatif complet
            </p>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Oltigo vs la concurrence
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Découvrez pourquoi Oltigo est la solution la plus complète pour les professionnels de
              santé au Maroc.
            </p>
            <div className="mt-8 h-px w-full bg-border" />
          </div>

          {/* Full comparison table */}
          <div className="pb-20">
            <FullComparisonTable />
          </div>
        </main>
        <LandingFooter />
      </div>
    </LandingLocaleProvider>
  );
}
