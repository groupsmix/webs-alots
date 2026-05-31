/**
 * A70-F1: Public sub-processor list.
 *
 * GDPR Art.28(3)(a) and Moroccan Law 09-08 require that clinic customers
 * (as data controllers) can review the sub-processors Oltigo uses and
 * are notified of changes. This page satisfies that requirement.
 *
 * Route: /sub-processors
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sous-traitants — Oltigo Health",
  description:
    "Liste des sous-traitants d'Oltigo Health et mécanismes de transfert de données conformément au RGPD et à la loi 09-08.",
  robots: { index: true, follow: true },
};

interface SubProcessor {
  name: string;
  data: string;
  region: string;
  transferBasis: string;
  certification: string;
  dpa: string;
}

const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Supabase (PostgreSQL)",
    data: "PHI, PII, jetons d'authentification",
    region: "AWS eu-west-1 (Irlande)",
    transferBasis: "CCT UE",
    certification: "SOC 2 Type II, ISO 27001",
    dpa: "Signé",
  },
  {
    name: "Cloudflare Workers",
    data: "Routage des requêtes, mise en cache (aucune PHI persistante)",
    region: "Edge mondial (transit uniquement)",
    transferBasis: "DPA Cloudflare",
    certification: "SOC 2 Type II, ISO 27001",
    dpa: "Signé",
  },
  {
    name: "Cloudflare R2",
    data: "Fichiers patients chiffrés (AES-256-GCM)",
    region: "Juridiction UE (épinglée¹)",
    transferBasis: "DPA Cloudflare",
    certification: "SOC 2 Type II",
    dpa: "Signé",
  },
  {
    name: "OpenAI",
    data: "Contexte clinique pseudonymisé pour les fonctionnalités IA",
    region: "États-Unis (hébergé sur Azure)",
    transferBasis: "DPA OpenAI + CCT UE + consentement explicite",
    certification: "SOC 2 Type II",
    dpa: "Signé",
  },
  {
    name: "Stripe",
    data: "Références de passerelle de paiement (aucun numéro de carte stocké)",
    region: "États-Unis / UE",
    transferBasis: "DPA Stripe + PCI DSS L1",
    certification: "PCI DSS L1, SOC 2 Type II",
    dpa: "Signé",
  },
  {
    name: "CMI (Centre Monétique Interbancaire)",
    data: "Traitement des paiements en MAD",
    region: "Maroc (traitement domestique)",
    transferBasis: "Prestataire domestique",
    certification: "PCI DSS L1 (AOC sur demande)",
    dpa: "N/A",
  },
  {
    name: "Meta (API WhatsApp Business)",
    data: "Numéros de téléphone, texte de rappel de rendez-vous",
    region: "États-Unis / UE",
    transferBasis: "DPA Meta + CCT UE + consentement explicite",
    certification: "SOC 2 Type II, ISO 27001",
    dpa: "Signé",
  },
  {
    name: "Twilio (WhatsApp / SMS de secours)",
    data: "Numéros de téléphone, texte de notification",
    region: "États-Unis",
    transferBasis: "DPA Twilio + CCT UE",
    certification: "SOC 2 Type II, ISO 27001",
    dpa: "Signé",
  },
  {
    name: "Resend",
    data: "Adresses e-mail, contenu de notification",
    region: "États-Unis",
    transferBasis: "DPA Resend + CCT UE",
    certification: "SOC 2 Type II",
    dpa: "Signé",
  },
  {
    name: "Sentry",
    data: "Télémétrie d'erreurs (PHI entièrement supprimée avant transmission)",
    region: "États-Unis",
    transferBasis: "DPA Sentry + CCT UE",
    certification: "SOC 2 Type II",
    dpa: "Signé",
  },
  {
    name: "Plausible Analytics",
    data: "Statistiques de pages vues anonymisées (non personnelles)",
    region: "UE (Allemagne)",
    transferBasis: "DPA UE",
    certification: "Conforme RGPD (sans cookies)",
    dpa: "Signé",
  },
];

export default function SubProcessorsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Liste des sous-traitants</h1>
        <p className="text-muted-foreground text-sm">
          Dernière mise à jour : 31 mai 2026 · Version 1.0
        </p>
        <p className="mt-4 text-sm text-muted-foreground max-w-2xl">
          Conformément à l&apos;article 28(3)(a) du RGPD et à la loi marocaine 09-08, Oltigo Health
          publie la liste de ses sous-traitants. Les cabinets clients (responsables du traitement)
          peuvent consulter cette liste pour vérifier les autorisations de sous-traitance. Toute
          modification substantielle sera communiquée avec un préavis d&apos;au moins
          <strong> 30 jours</strong>.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-semibold">Sous-traitant</th>
              <th className="text-left p-3 font-semibold">Données traitées</th>
              <th className="text-left p-3 font-semibold">Région</th>
              <th className="text-left p-3 font-semibold">Base de transfert</th>
              <th className="text-left p-3 font-semibold">Certification</th>
              <th className="text-left p-3 font-semibold">DPA</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {SUB_PROCESSORS.map((sp) => (
              <tr key={sp.name} className="hover:bg-muted/50">
                <td className="p-3 font-medium whitespace-nowrap">{sp.name}</td>
                <td className="p-3 text-muted-foreground max-w-xs">{sp.data}</td>
                <td className="p-3 whitespace-nowrap">{sp.region}</td>
                <td className="p-3 text-muted-foreground">{sp.transferBasis}</td>
                <td className="p-3 text-muted-foreground">{sp.certification}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      sp.dpa === "Signé"
                        ? "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {sp.dpa}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-xs text-muted-foreground space-y-2">
        <p>
          ¹ Les buckets R2 contenant des PHI sont épinglés à la juridiction UE via le paramètre
          <code className="mx-1 font-mono">jurisdiction=eu</code>. Voir{" "}
          <code className="font-mono">r2-lifecycle.json</code>.
        </p>
        <p>
          Pour toute question ou opposition à un changement de sous-traitant, contactez :{" "}
          <a href="mailto:dpo@oltigo.health" className="underline hover:text-foreground">
            dpo@oltigo.health
          </a>
        </p>
      </div>
    </main>
  );
}
