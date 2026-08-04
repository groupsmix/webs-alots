/* eslint-disable i18next/no-literal-string */
import type { Metadata } from "next";
import { getPublicAppVersion } from "@/lib/env";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Journal des versions — Oltigo",
  description:
    "Historique des versions, nouveautés et améliorations de la plateforme Oltigo pour les cabinets médicaux au Maroc.",
  path: "/versions",
});

export default function VersionsPage() {
  const version = getPublicAppVersion();

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Journal des versions</h1>
      <p className="text-muted-foreground mb-8">
        Version actuelle : <strong>{version}</strong>
      </p>

      <section className="space-y-8">
        <VersionEntry
          version="v1.0"
          date="2026"
          items={[
            "Lancement de la plateforme Oltigo (rendez-vous, dossier patient, facturation).",
            "Authentification sécurisée avec 2FA et rôles (admin, médecin, patient, réceptionniste).",
            "Rappels WhatsApp en darija pour les rendez-vous et rappels de vaccination.",
            "Dashboard multi-cabinet avec permissions granulaires.",
            "Chiffrement AES-256-GCM des fichiers patients et conformité Loi 09-08.",
          ]}
        />
        <VersionEntry
          version="v0.9"
          date="2026"
          items={[
            "Bêta fermée avec les premiers cabinets partenaires au Maroc.",
            "Intégration CMI et Stripe pour les paiements en ligne.",
            "API publique documentée pour les partenaires.",
          ]}
        />
      </section>
    </div>
  );
}

function VersionEntry({
  version,
  date,
  items,
}: {
  version: string;
  date: string;
  items: string[];
}) {
  return (
    <article className="border-l-2 border-primary/30 pl-6">
      <h2 className="text-lg font-semibold">{version}</h2>
      <p className="text-sm text-muted-foreground mb-2">{date}</p>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
