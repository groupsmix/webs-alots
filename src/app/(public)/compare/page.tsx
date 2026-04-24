import type { Metadata } from "next";
import { LandingLocaleProvider } from "@/components/landing/landing-locale-provider";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
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
      <div className="flex min-h-screen flex-col bg-white">
        <LandingHeader />
        <main className="flex-1">
          {/* Header */}
          <div className="mx-auto max-w-6xl px-4 pb-12 pt-20 text-center sm:px-6">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
              Comparatif complet
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Oltigo vs la concurrence
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Découvrez pourquoi Oltigo est la solution la plus complète pour
              les professionnels de santé au Maroc.
            </p>
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
