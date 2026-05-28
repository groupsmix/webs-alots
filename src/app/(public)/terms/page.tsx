import type { Metadata } from "next";
import { LegalDoc, type LegalDocSection } from "@/components/editorial/legal-doc";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description:
    "Conditions générales d'utilisation de la plateforme Oltigo. Règles d'utilisation, responsabilités et droits des utilisateurs.",
  openGraph: {
    title: "Conditions Générales d'Utilisation",
    description: "Conditions générales d'utilisation de la plateforme Oltigo.",
  },
};

export default function TermsPage() {
  const sections: LegalDocSection[] = [
    {
      id: "objet",
      number: "01",
      title: "Objet",
      children: (
        <>
          <p>
            Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et
            l&apos;utilisation de la plateforme Oltigo (&quot;la Plateforme&quot;), un service SaaS
            de gestion de cabinets médicaux, dentaires et pharmacies au Maroc.
          </p>
          <p>
            En accédant à la Plateforme, vous acceptez les présentes CGU dans leur intégralité. Si
            vous n&apos;acceptez pas ces conditions, veuillez ne pas utiliser la Plateforme.
          </p>
        </>
      ),
    },
    {
      id: "definitions",
      number: "02",
      title: "Définitions",
      children: (
        <ul>
          <li>
            <strong>Utilisateur :</strong> toute personne accédant à la Plateforme, qu&apos;il
            s&apos;agisse d&apos;un professionnel de santé (médecin, dentiste, pharmacien) ou
            d&apos;un patient.
          </li>
          <li>
            <strong>Client :</strong> le professionnel de santé ou l&apos;établissement souscrivant
            à un abonnement.
          </li>
          <li>
            <strong>Patient :</strong> toute personne utilisant la Plateforme pour prendre
            rendez-vous ou consulter ses informations médicales.
          </li>
          <li>
            <strong>Tenant :</strong> l&apos;espace dédié à un cabinet ou établissement de santé sur
            la Plateforme.
          </li>
        </ul>
      ),
    },
    {
      id: "services",
      number: "03",
      title: "Services",
      children: (
        <>
          <p>La Plateforme propose les services suivants :</p>
          <ul>
            <li>Gestion des rendez-vous en ligne.</li>
            <li>Gestion des dossiers patients.</li>
            <li>Site web professionnel pour le cabinet.</li>
            <li>Notifications automatiques (WhatsApp, SMS).</li>
            <li>Facturation et comptabilité.</li>
            <li>Ordonnances et prescriptions électroniques.</li>
          </ul>
        </>
      ),
    },
    {
      id: "inscription",
      number: "04",
      title: "Inscription et Compte",
      children: (
        <p>
          L&apos;inscription nécessite la fourniture d&apos;informations exactes et à jour. Chaque
          utilisateur est responsable de la confidentialité de ses identifiants de connexion. Toute
          activité réalisée sous votre compte est de votre responsabilité.
        </p>
      ),
    },
    {
      id: "protection-donnees",
      number: "05",
      title: "Protection des Données",
      children: (
        <>
          <p>
            La collecte et le traitement des données personnelles sont régis par notre{" "}
            <a href="/privacy">Politique de Confidentialité</a>, conformément au Règlement Général
            sur la Protection des Données (RGPD) et à la loi marocaine n° 09-08 relative à la
            protection des données à caractère personnel.
          </p>
          <p>
            Les données de santé sont considérées comme des données sensibles et font l&apos;objet
            de mesures de protection renforcées, conformément aux exigences de la CNDP (Commission
            Nationale de contrôle de la protection des Données à caractère Personnel).
          </p>
        </>
      ),
    },
    {
      id: "responsabilites",
      number: "06",
      title: "Responsabilités",
      children: (
        <>
          <h3>6.1 Responsabilité de l&apos;utilisateur</h3>
          <p>
            L&apos;utilisateur s&apos;engage à utiliser la Plateforme conformément aux lois en
            vigueur et aux présentes CGU. Il est interdit d&apos;utiliser la Plateforme à des fins
            illicites ou portant atteinte aux droits de tiers.
          </p>
          <h3>6.2 Responsabilité d&apos;Oltigo</h3>
          <p>
            Oltigo s&apos;engage à fournir un service fiable et sécurisé. La Plateforme est fournie
            &quot;en l&apos;état&quot; et Oltigo ne garantit pas une disponibilité ininterrompue.
            Oltigo ne saurait être tenu responsable des décisions médicales prises sur la base des
            informations affichées sur la Plateforme.
          </p>
        </>
      ),
    },
    {
      id: "propriete-intellectuelle",
      number: "07",
      title: "Propriété Intellectuelle",
      children: (
        <p>
          L&apos;ensemble des éléments de la Plateforme (textes, images, logos, code source) est
          protégé par le droit de la propriété intellectuelle. Toute reproduction ou utilisation non
          autorisée est strictement interdite.
        </p>
      ),
    },
    {
      id: "abonnements",
      number: "08",
      title: "Abonnements et Paiements",
      children: (
        <p>
          Les tarifs des abonnements sont indiqués sur la page <a href="/pricing">Tarifs</a>. Les
          paiements sont effectués via les moyens de paiement acceptés (CMI, virement bancaire). Les
          abonnements sont renouvelés automatiquement sauf résiliation préalable.
        </p>
      ),
    },
    {
      id: "resiliation",
      number: "09",
      title: "Résiliation",
      children: (
        <p>
          L&apos;utilisateur peut résilier son compte à tout moment depuis les paramètres de son
          compte. Conformément au RGPD, une suppression complète des données sera effectuée dans un
          délai de 30 jours suivant la demande, sous réserve des obligations légales de
          conservation.
        </p>
      ),
    },
    {
      id: "droit-applicable",
      number: "10",
      title: "Droit Applicable",
      children: (
        <p>
          Les présentes CGU sont soumises au droit marocain. Tout litige relatif à
          l&apos;interprétation ou à l&apos;exécution des présentes sera soumis aux tribunaux
          compétents de Casablanca, Maroc.
        </p>
      ),
    },
    {
      id: "contact",
      number: "11",
      title: "Contact",
      children: (
        <p>
          Pour toute question relative aux présentes CGU, vous pouvez nous contacter via notre{" "}
          <a href="/contact">page de contact</a>.
        </p>
      ),
    },
  ];

  return (
    <LegalDoc
      title="Conditions Générales d'Utilisation"
      lastUpdated="MARS 2026"
      sections={sections}
    />
  );
}
