import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conformité RGPD & Loi 09-08",
};

export default function CompliancePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Conformité & Protection des Données</h1>
        <p className="text-muted-foreground mt-1">
          RGPD, Loi 09-08, et accord de traitement des données (DPA).
        </p>
      </div>

      {/* DPA Template */}
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">
          Accord de Traitement des Données (DPA)
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          En tant que propriétaire de cabinet utilisant Oltigo, vous agissez en
          tant que responsable de traitement. Oltigo agit en tant que
          sous-traitant. Ce document formalise vos obligations respectives.
        </p>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
          <div className="rounded-md border p-4 bg-muted/30">
            <h3 className="text-base font-medium text-foreground mb-2">
              1. Parties
            </h3>
            <p>
              <strong>Responsable de traitement :</strong> Le propriétaire du
              cabinet (vous), tel qu&apos;identifié dans votre compte Oltigo.
            </p>
            <p>
              <strong>Sous-traitant :</strong> Oltigo, plateforme SaaS de
              gestion médicale.
            </p>
          </div>

          <div className="rounded-md border p-4 bg-muted/30">
            <h3 className="text-base font-medium text-foreground mb-2">
              2. Objet du Traitement
            </h3>
            <p>
              Le sous-traitant traite les données personnelles des patients
              uniquement pour fournir les services de gestion de cabinet définis
              dans le contrat de service, incluant :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Gestion des rendez-vous et de la file d&apos;attente</li>
              <li>Dossiers patients et historique médical</li>
              <li>Facturation et paiements</li>
              <li>Prescriptions et ordonnances</li>
              <li>Communications patient (rappels, confirmations)</li>
            </ul>
          </div>

          <div className="rounded-md border p-4 bg-muted/30">
            <h3 className="text-base font-medium text-foreground mb-2">
              3. Types de Données Traitées
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Données d&apos;identification :</strong> nom, prénom,
                email, téléphone
              </li>
              <li>
                <strong>Données de santé :</strong> motifs de consultation,
                antécédents, prescriptions
              </li>
              <li>
                <strong>Données financières :</strong> montants, modes de
                paiement
              </li>
              <li>
                <strong>Données techniques :</strong> adresse IP, logs de
                connexion
              </li>
            </ul>
          </div>

          <div className="rounded-md border p-4 bg-muted/30">
            <h3 className="text-base font-medium text-foreground mb-2">
              4. Obligations du Sous-traitant
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Traiter les données uniquement sur instruction documentée du
                responsable
              </li>
              <li>
                Garantir la confidentialité des personnes autorisées à traiter
                les données
              </li>
              <li>
                Mettre en oeuvre les mesures techniques et organisationnelles
                appropriées (chiffrement, RLS, audit logs)
              </li>
              <li>
                Notifier le responsable dans les 72 heures en cas de violation
                de données
              </li>
              <li>
                Supprimer les données à l&apos;issue du contrat, sauf obligation
                légale de conservation
              </li>
              <li>
                Mettre à disposition les informations nécessaires pour
                démontrer le respect des obligations
              </li>
            </ul>
          </div>

          <div className="rounded-md border p-4 bg-muted/30">
            <h3 className="text-base font-medium text-foreground mb-2">
              5. Droits des Personnes Concernées
            </h3>
            <p>
              Le sous-traitant aide le responsable à répondre aux demandes
              d&apos;exercice des droits des patients :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Droit d&apos;accès (export des données en JSON/CSV)</li>
              <li>Droit de rectification</li>
              <li>
                Droit à l&apos;effacement (suppression avec délai de grâce de
                30 jours)
              </li>
              <li>Droit à la portabilité</li>
              <li>Droit d&apos;opposition</li>
            </ul>
          </div>

          <div className="rounded-md border p-4 bg-muted/30">
            <h3 className="text-base font-medium text-foreground mb-2">
              6. Sous-traitance Ultérieure
            </h3>
            <p>
              Oltigo utilise les sous-traitants suivants pour fournir le
              service :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Supabase (AWS eu-west)</strong> — Base de données et
                authentification
              </li>
              <li>
                <strong>Cloudflare</strong> — CDN, Workers, stockage R2
              </li>
              <li>
                <strong>Meta (WhatsApp Business API)</strong> — Notifications
                patients
              </li>
            </ul>
          </div>

          <div className="rounded-md border p-4 bg-muted/30">
            <h3 className="text-base font-medium text-foreground mb-2">
              7. Loi Applicable
            </h3>
            <p>
              Le présent accord est soumis au droit marocain, en particulier à
              la loi n° 09-08 relative à la protection des personnes physiques
              à l&apos;égard du traitement des données à caractère personnel,
              ainsi qu&apos;au RGPD pour les résidents de l&apos;UE.
            </p>
            <p className="mt-2">
              <strong>Autorité de contrôle :</strong> CNDP (Commission
              Nationale de contrôle de la protection des Données à caractère
              Personnel), Rabat, Maroc.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href="/privacy"
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Voir la politique de confidentialité
          </a>
          <a
            href="/terms"
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Voir les CGU
          </a>
        </div>
      </section>

      {/* Compliance Status */}
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Posture de Conformité</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Chiffrement des données</span>
            </div>
            <p className="text-xs text-muted-foreground">
              TLS 1.3 en transit, AES-256 au repos (Supabase).
            </p>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Isolation multi-tenant</span>
            </div>
            <p className="text-xs text-muted-foreground">
              RLS PostgreSQL sur chaque table avec clinic_id.
            </p>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Consentement cookies</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Bannière RGPD avec journalisation du consentement.
            </p>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Droit à l&apos;effacement</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Suppression de compte avec délai de grâce de 30 jours.
            </p>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Portabilité des données</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Export JSON/CSV depuis le portail patient.
            </p>
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-sm font-medium">Déclaration CNDP</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommandé : déclarer le traitement auprès de la CNDP.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
