import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Nos Services",
  description:
    "Découvrez nos services médicaux : consultations, examens, soins spécialisés. Tarifs transparents et prise de rendez-vous en ligne.",
  path: "/services",
});

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
