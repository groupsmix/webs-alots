import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promotions Pharmacie",
  description:
    "Découvrez nos promotions en cours sur les médicaments et produits de santé. Offres limitées à durée déterminée.",
  openGraph: {
    title: "Promotions Pharmacie — Offres en cours",
    description: "Promotions et remises sur médicaments et produits de santé.",
  },
};

export default function PromotionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
