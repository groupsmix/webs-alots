import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catalogue Produits",
  description:
    "Parcourez notre catalogue de médicaments et produits de santé. Recherche par catégorie, disponibilité et prix.",
  openGraph: {
    title: "Catalogue Produits — Pharmacie",
    description: "Parcourez notre catalogue de médicaments et produits de santé.",
  },
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
