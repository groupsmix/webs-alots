import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Détail Produit",
  description:
    "Consultez les détails d'un produit pharmaceutique : composition, posologie, prix et disponibilité.",
  openGraph: {
    title: "Détail Produit — Pharmacie",
    description: "Détails complets du produit pharmaceutique.",
  },
};

export default function ProductDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
