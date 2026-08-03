import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";
import ApiDocsContent from "./_content";

export const metadata: Metadata = buildMetadata({
  title: "Documentation API",
  description:
    "Documentation interactive de l'API Oltigo. Endpoints, authentification et exemples d'intégration pour les partenaires et développeurs.",
  path: "/api-docs",
});

export default function ApiDocsPage() {
  return <ApiDocsContent />;
}
