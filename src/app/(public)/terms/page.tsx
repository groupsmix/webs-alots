import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description:
    "Conditions générales d'utilisation de la plateforme Oltigo. Règles d'utilisation, responsabilités et droits des utilisateurs.",
  openGraph: {
    title: "Conditions Générales d'Utilisation",
    description:
      "Conditions générales d'utilisation de la plateforme Oltigo.",
  },
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl prose prose-gray">
        <h1 className="text-3xl font-bold mb-8">
          Conditions Générales d&apos;Utilisation
        </h1>

        <p className="text-muted-foreground mb-6">
          Dernière mise à jour : mars 2026
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">1. Objet</h2>
          <p className="text-muted-foreground mb-4">
            Les présentes conditions générales d&apos;utilisation (CGU) régissent
            l&apos;accès et l&apos;utilisation de la plateforme Oltigo
            (&quot;la Plateforme&quot;), un service SaaS de gestion de cabinets
            médicaux, dentaires et pharmacies au Maroc.
          </p>
          <p className="text-muted-foreground mb-4">
            En accédant à la Plateforme, vous acceptez les présentes CGU dans
            leur intégralité. Si vous n&apos;acceptez pas ces conditions, veuillez
            ne pas utiliser la Plateforme.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">2. Définitions</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>
              <strong>Utilisateur :</strong> toute personne accédant à la
              Plateforme, qu&apos;il s&apos;agisse d&apos;un professionnel de
              santé (médecin, dentiste, pharmacien) ou d&apos;un patient.
            </li>
            <li>
              <strong>Client :</strong> le professionnel de santé ou
              l&apos;établissement souscrivant à un abonnement.
            </li>
            <li>
              <strong>Patient :</strong> toute personne utilisant la Plateforme
              pour prendre rendez-vous ou consulter ses informations médicales.
            </li>
            <li>
              <strong>Tenant :</strong> l&apos;espace dédié à un cabinet ou
              établissement de santé sur la Plateforme.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">3. Services</h2>
          <p className="text-muted-foreground mb-4">
            La Plateforme propose les services suivants :
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Gestion des rendez-vous en ligne.</li>
            <li>Gestion des dossiers patients.</li>
            <li>Site web professionnel pour le cabinet.</li>
            <li>Notifications automatiques (WhatsApp, SMS).</li>
            <li>Facturation et comptabilité.</li>
            <li>Ordonnances et prescriptions électroniques.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            4. Inscription et Compte
          </h2>
          <p className="text-muted-foreground mb-4">
            L&apos;inscription nécessite la fourniture d&apos;informations
            exactes et à jour. Chaque utilisateur est responsable de la
            confidentialité de ses identifiants de connexion. Toute activité
            réalisée sous votre compte est de votre responsabilité.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            5. Protection des Données
          </h2>
          <p className="text-muted-foreground mb-4">
            La collecte et le traitement des données personnelles sont régis par
            notre{" "}
            <a href="/privacy" className="text-primary hover:underline">
              Politique de Confidentialité
            </a>
            , conformément au Règlement Général sur la Protection des Données
            (RGPD) et à la loi marocaine n° 09-08 relative à la protection des
            données à caractère personnel.
          </p>
          <p className="text-muted-foreground mb-4">
            Les données de santé sont considérées comme des données sensibles et
            font l&apos;objet de mesures de protection renforcées, conformément
            aux exigences de la CNDP (Commission Nationale de contrôle de la
            protection des Données à caractère Personnel).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            6. Responsabilités
          </h2>
          <h3 className="text-lg font-medium mb-2">6.1 Responsabilité de l&apos;utilisateur</h3>
          <p className="text-muted-foreground mb-4">
            L&apos;utilisateur s&apos;engage à utiliser la Plateforme
            conformément aux lois en vigueur et aux présentes CGU. Il est
            interdit d&apos;utiliser la Plateforme à des fins illicites ou
            portant atteinte aux droits de tiers.
          </p>
          <h3 className="text-lg font-medium mb-2">6.2 Responsabilité d&apos;Oltigo</h3>
          <p className="text-muted-foreground mb-4">
            Oltigo s&apos;engage à fournir un service fiable et sécurisé. La
            Plateforme est fournie &quot;en l&apos;état&quot; et Oltigo ne
            garantit pas une disponibilité ininterrompue. Oltigo ne saurait être
            tenu responsable des décisions médicales prises sur la base des
            informations affichées sur la Plateforme.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            7. Propriété Intellectuelle
          </h2>
          <p className="text-muted-foreground mb-4">
            L&apos;ensemble des éléments de la Plateforme (textes, images, logos,
            code source) est protégé par le droit de la propriété
            intellectuelle. Toute reproduction ou utilisation non autorisée est
            strictement interdite.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            8. Abonnements et Paiements
          </h2>
          <p className="text-muted-foreground mb-4">
            Les tarifs des abonnements sont indiqués sur la page{" "}
            <a href="/pricing" className="text-primary hover:underline">
              Tarifs
            </a>
            . Les paiements sont effectués via les moyens de paiement acceptés
            (CMI, virement bancaire). Les abonnements sont renouvelés
            automatiquement sauf résiliation préalable.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            9. Résiliation
          </h2>
          <p className="text-muted-foreground mb-4">
            L&apos;utilisateur peut résilier son compte à tout moment depuis les
            paramètres de son compte. Conformément au RGPD, une suppression
            complète des données sera effectuée dans un délai de 30 jours
            suivant la demande, sous réserve des obligations légales de
            conservation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            10. Droit Applicable
          </h2>
          <p className="text-muted-foreground mb-4">
            Les présentes CGU sont soumises au droit marocain. Tout litige
            relatif à l&apos;interprétation ou à l&apos;exécution des présentes
            sera soumis aux tribunaux compétents de Casablanca, Maroc.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">11. Contact</h2>
          <p className="text-muted-foreground mb-4">
            Pour toute question relative aux présentes CGU, vous pouvez nous
            contacter via notre{" "}
            <a href="/contact" className="text-primary hover:underline">
              page de contact
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
