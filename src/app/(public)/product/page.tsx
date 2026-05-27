import type { Metadata } from "next";
import { EditorialPageShell } from "@/components/landing/editorial/editorial-page-shell";
import { EditorialProductContent } from "@/components/landing/editorial/editorial-product-content";

export const metadata: Metadata = {
  title: "Produit \u2014 Oltigo Health",
  description:
    "Rendez-vous, dossier patient, rappels WhatsApp, facturation, r\u00F4les et export. Tout ce dont votre cabinet a besoin.",
  openGraph: {
    title: "Produit \u2014 Oltigo Health",
    description: "Documentation produit pour cliniques ind\u00E9pendantes au Maroc.",
  },
};

export default function ProductPage() {
  return (
    <EditorialPageShell>
      <EditorialProductContent />
    </EditorialPageShell>
  );
}
