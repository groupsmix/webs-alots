import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nos Services",
  description:
    "Découvrez nos services médicaux : consultations, examens, soins spécialisés. Tarifs transparents et prise de rendez-vous en ligne.",
  openGraph: {
    title: "Nos Services",
    description: "Découvrez nos services médicaux et prenez rendez-vous en ligne.",
  },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
