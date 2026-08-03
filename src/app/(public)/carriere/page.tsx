/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Carrières",
  description:
    "Rejoignez Oltigo et contribuez à bâtir le système d'exploitation des cabinets médicaux au Maroc. Découvrez nos postes ouverts et notre culture.",
  path: "/carriere",
});

export default function CareersPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Carrières</h1>
      <p className="text-muted-foreground mb-8">
        Nous n'avons pas de poste ouvert pour le moment, mais nous sommes toujours à la recherche de
        talents passionnés par la santé, la tech et l'impact au Maroc.
      </p>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Envoyez-nous votre candidature spontanée</h2>
        <p>
          Envoyez votre CV et une courte note à{" "}
          <a href="mailto:contact@oltigo.com" className="text-primary underline">
            contact@oltigo.com
          </a>{" "}
          et précisez le type de rôle qui vous intéresse.
        </p>
      </section>
    </div>
  );
}
