/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import { Link } from "lucide-react";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button-variants";
import { buildMetadata } from "@/lib/metadata";
import ApiDocsContent from "./_content";

export const metadata: Metadata = buildMetadata({
  title: "Documentation API",
  description:
    "Documentation interactive de l'API Oltigo. Endpoints, authentification et exemples d'intégration pour les partenaires et développeurs.",
  path: "/api-docs",
});

export default function ApiDocsPage() {
  return (
    <>
      <header className="container mx-auto px-4 pt-24 pb-8">
        <h1 className="text-3xl font-bold">Documentation API Oltigo</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Référence interactive des endpoints, schémas d'authentification et exemples d'intégration
          pour connecter votre cabinet ou votre partenaire à Oltigo.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/api/docs"
            className={buttonVariants({ variant: "outline", size: "sm" })}
            download
          >
            <Link className="mr-2 h-4 w-4" aria-hidden />
            Télécharger OpenAPI (JSON)
          </a>
        </div>
      </header>
      <ApiDocsContent />
    </>
  );
}
