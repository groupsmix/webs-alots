/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button-variants";
import { getSiteUrl } from "@/lib/env";
import { buildMetadata } from "@/lib/metadata";
import ApiDocsContent from "./_content";

export const metadata: Metadata = buildMetadata({
  title: "Documentation API",
  description:
    "Documentation interactive de l'API Oltigo. Endpoints, authentification et exemples d'intégration pour les partenaires et développeurs.",
  path: "/api-docs",
});

const curlExample = `curl -X GET \
  https://oltigo.com/api/v1/appointments \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"`;

const jsExample = `const response = await fetch("https://oltigo.com/api/v1/appointments", {
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
});
const { data } = await response.json();`;

const pyExample = `import requests

resp = requests.get(
    "https://oltigo.com/api/v1/appointments",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
)
data = resp.json()`;

const createPatientExample = `curl -X POST https://oltigo.com/api/v1/patients \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Amal Ben",
    "phone": "+212612345678",
    "date_of_birth": "1990-05-15",
    "gender": "F"
  }'`;

export default async function ApiDocsPage() {
  const h = await headers();
  const nonce = h.get("x-nonce") || undefined;
  const siteUrl = getSiteUrl() || "https://oltigo.com";

  return (
    <>
      <BreadcrumbJsonLd
        nonce={nonce}
        items={[
          { name: "Accueil", url: siteUrl },
          { name: "Documentation API", url: `${siteUrl}/api-docs` },
        ]}
      />
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
            <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
            Télécharger OpenAPI (JSON)
          </a>
        </div>
      </header>

      <section className="container mx-auto px-4 pb-12">
        <h2 className="text-xl font-semibold mb-4">Exemples d'intégration</h2>
        <p className="text-muted-foreground mb-6">
          Obtenez un jeton API depuis votre tableau de bord (Espace clinique → Intégrations), puis
          interrogez l'API REST v1.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <CodeCard title="Lister les rendez-vous — cURL" code={curlExample} language="bash" />
          <CodeCard title="Lister les rendez-vous — JavaScript" code={jsExample} language="js" />
          <CodeCard title="Lister les rendez-vous — Python" code={pyExample} language="python" />
          <CodeCard title="Créer un patient" code={createPatientExample} language="bash" />
        </div>
      </section>

      <ApiDocsContent />
    </>
  );
}

function CodeCard({ title, code, language }: { title: string; code: string; language: string }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-muted px-4 py-2 border-b border-border flex justify-between items-center">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{language}</span>
      </div>
      <pre className="bg-black text-white text-sm overflow-x-auto p-4">
        <code>{code}</code>
      </pre>
    </div>
  );
}
