/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Politique de cookies",
  description:
    "Découvrez les cookies et technologies similaires utilisés sur Oltigo et comment gérer vos préférences.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Politique de cookies</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p>
          Cette politique explique comment Oltigo utilise les cookies et technologies similaires
          pour améliorer votre expérience et mesurer l'audience de ses pages publiques.
        </p>

        <h2>1. Que sont les cookies ?</h2>
        <p>
          Les cookies sont de petits fichiers texte déposés sur votre appareil lorsque vous visitez
          un site web. Ils permettent de mémoriser vos préférences, de sécuriser votre session et de
          collecter des statistiques d'usage anonymisées.
        </p>

        <h2>2. Catégories de cookies utilisés</h2>
        <ul>
          <li>
            <strong>Fonctionnels :</strong> indispensables au fonctionnement du site (langue,
            session, sécurité). Ils ne peuvent pas être désactivés.
          </li>
          <li>
            <strong>Analytiques :</strong> utilisés de manière anonyme pour comprendre comment les
            visiteurs naviguent sur le site (Plausible Analytics). Ces cookies ne permettent pas
            d'identifier une personne.
          </li>
          <li>
            <strong>Marketing :</strong> utilisés pour mesurer l'efficacité des campagnes et
            améliorer la pertinence des messages. Ils nécessitent votre consentement explicite.
          </li>
        </ul>

        <h2>3. Cookies déposés sur Oltigo</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2 pr-4">Cookie</th>
                <th className="text-start py-2 pr-4">Catégorie</th>
                <th className="text-start py-2 pr-4">Finalité</th>
                <th className="text-start py-2">Durée</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2 pr-4">oltigo_consent</td>
                <td className="py-2 pr-4">Fonctionnel</td>
                <td className="py-2 pr-4">Mémorise votre choix de consentement cookies</td>
                <td className="py-2">12 mois</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4">__Secure-next-auth.session-token</td>
                <td className="py-2 pr-4">Fonctionnel</td>
                <td className="py-2 pr-4">Authentification sécurisée</td>
                <td className="py-2">Session</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4">plausible_*</td>
                <td className="py-2 pr-4">Analytique</td>
                <td className="py-2 pr-4">Statistiques d'audience anonymes</td>
                <td className="py-2">Session</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>4. Gestion des préférences</h2>
        <p>
          Lors de votre première visite, une bannière de consentement vous permet d'accepter ou de
          refuser les cookies analytiques et marketing. Vous pouvez modifier votre choix à tout
          moment via le bandeau de cookies ou en supprimant les cookies de votre navigateur.
        </p>

        <h2>5. Durée de conservation</h2>
        <p>
          Les cookies fonctionnels sont conservés le temps nécessaire à votre session. Les cookies
          analytiques sont conservés pendant 12 mois maximum. Les cookies marketing sont conservés
          pendant 6 mois maximum.
        </p>

        <h2>6. Contact</h2>
        <p>
          Pour toute question relative à cette politique, contactez-nous à l'adresse{" "}
          <a href="mailto:contact@oltigo.com">contact@oltigo.com</a>.
        </p>
      </div>
    </div>
  );
}
