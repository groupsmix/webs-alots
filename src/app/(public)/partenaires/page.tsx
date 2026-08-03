/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Partenaires",
  description:
    "Devenez partenaire Oltigo : intégrations, revendeurs, laboratoires et institutions de santé au Maroc.",
  path: "/partenaires",
});

export default function PartnersPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Partenaires</h1>
      <p className="text-muted-foreground mb-8">
        Oltigo s'ouvre aux partenariats avec des acteurs de la santé, des laboratoires, des
        institutions et des intégrateurs pour offrir aux cabinets médicaux marocains une expérience
        fluide et sécurisée.
      </p>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Parlez-nous de votre projet</h2>
        <p>
          Contactez-nous à{" "}
          <a href="mailto:contact@oltigo.com" className="text-primary underline">
            contact@oltigo.com
          </a>{" "}
          avec un descriptif de votre activité et de la collaboration que vous imaginez.
        </p>
      </section>
    </div>
  );
}
