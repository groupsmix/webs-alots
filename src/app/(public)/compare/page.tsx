import type { Metadata } from "next";
import { OltigoPublicShell } from "@/components/landing/oltigo/public-shell";
import { FullComparisonTable } from "@/components/marketing/comparison-table";
import { getTenant } from "@/lib/tenant";

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

function PageHeader() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6">
      <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
        <span className="text-muted-foreground">01 — </span>Comparatif complet
      </p>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Oltigo vs la concurrence
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Découvrez pourquoi Oltigo est la solution la plus complète pour les professionnels de santé
        au Maroc.
      </p>
      <div className="mt-8 h-px w-full bg-border" />
    </div>
  );
}

export default async function ComparePage() {
  const tenant = await getTenant();

  const content = (
    <>
      <PageHeader />
      <div className="pb-20">
        <FullComparisonTable />
      </div>
    </>
  );

  // Subdomain → render inside the tenant public layout (light theme).
  if (tenant) {
    return content;
  }

  // Root domain → Oltigo landing chrome with the comparison table on a light canvas.
  return (
    <OltigoPublicShell mainClassName="min-h-screen bg-background pt-16 text-foreground">
      {content}
    </OltigoPublicShell>
  );
}
