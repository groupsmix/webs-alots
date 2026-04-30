/* eslint-disable i18next/no-literal-string */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de Confidentialité",
  description:
    "Politique de confidentialité et protection des données personnelles. Conformité RGPD et loi marocaine 09-08.",
  openGraph: {
    title: "Politique de Confidentialité",
    description:
      "Politique de confidentialité et protection des données personnelles.",
  },
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl prose prose-gray">
        <h1 className="text-3xl font-bold mb-8">Politique de Confidentialité</h1>

        <p className="text-muted-foreground mb-6">
          Dernière mise à jour : mars 2026
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
          <p className="text-muted-foreground mb-4">
            La présente politique de confidentialité décrit comment Oltigo
            (&quot;nous&quot;, &quot;notre&quot;, &quot;la plateforme&quot;)
            collecte, utilise et protège vos données personnelles conformément
            au Règlement Général sur la Protection des Données (RGPD) et à la
            loi marocaine n° 09-08 relative à la protection des personnes
            physiques à l&apos;égard du traitement des données à caractère
            personnel.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            2. Données Collectées
          </h2>
          <p className="text-muted-foreground mb-4">
            Dans le cadre de nos services, nous pouvons collecter les données
            suivantes :
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>
              <strong>Données d&apos;identification :</strong> nom, prénom,
              adresse e-mail, numéro de téléphone.
            </li>
            <li>
              <strong>Données de santé :</strong> informations médicales
              fournies lors de la prise de rendez-vous (motif de consultation,
              antécédents médicaux).
            </li>
            <li>
              <strong>Données de connexion :</strong> adresse IP, type de
              navigateur, pages visitées.
            </li>
            <li>
              <strong>Données de rendez-vous :</strong> dates, heures,
              praticiens consultés.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            3. Finalités du Traitement
          </h2>
          <p className="text-muted-foreground mb-4">
            Vos données sont traitées pour les finalités suivantes :
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Gestion des rendez-vous et du suivi médical.</li>
            <li>Communication avec les patients (rappels, confirmations).</li>
            <li>Amélioration de nos services et de l&apos;expérience utilisateur.</li>
            <li>Respect des obligations légales et réglementaires.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            4. Protection des Données
          </h2>
          <p className="text-muted-foreground mb-4">
            Nous mettons en œuvre des mesures techniques et organisationnelles
            appropriées pour protéger vos données personnelles contre tout
            accès non autorisé, modification, divulgation ou destruction. Les
            données de santé font l&apos;objet de mesures de protection
            renforcées.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            5. Partage des Données
          </h2>
          <p className="text-muted-foreground mb-4">
            Vos données personnelles ne sont partagées qu&apos;avec les
            praticiens et le personnel médical impliqués dans votre prise en
            charge. Nous ne vendons ni ne louons vos données à des tiers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            6. Conservation des Données
          </h2>
          <p className="text-muted-foreground mb-4">
            Vos données sont conservées pendant la durée nécessaire aux
            finalités pour lesquelles elles ont été collectées, et conformément
            aux délais de conservation prévus par la réglementation en vigueur.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">7. Vos Droits</h2>
          <p className="text-muted-foreground mb-4">
            Conformément à la réglementation applicable, vous disposez des
            droits suivants :
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>
              <strong>Droit d&apos;accès :</strong> obtenir une copie de vos
              données personnelles.
            </li>
            <li>
              <strong>Droit de rectification :</strong> corriger des données
              inexactes ou incomplètes.
            </li>
            <li>
              <strong>Droit de suppression :</strong> demander l&apos;effacement
              de vos données.
            </li>
            <li>
              <strong>Droit d&apos;opposition :</strong> vous opposer au
              traitement de vos données.
            </li>
            <li>
              <strong>Droit à la portabilité :</strong> recevoir vos données
              dans un format structuré.
            </li>
          </ul>
          <p className="text-muted-foreground mb-4">
            Pour exercer ces droits, veuillez nous contacter via notre page de
            contact.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            8. Protection des Donnees des Mineurs
          </h2>
          <p className="text-muted-foreground mb-4">
            Conformement a la loi marocaine 09-08 et au RGPD, nous accordons une
            attention particuliere a la protection des donnees des patients
            mineurs (moins de 18 ans). L&apos;inscription d&apos;un patient
            mineur requiert le consentement explicite d&apos;un parent ou tuteur
            legal. Les donnees du tuteur sont enregistrees et liees au dossier du
            mineur. Le tuteur legal dispose de tous les droits d&apos;acces, de
            rectification et de suppression sur les donnees de son enfant. Aucun
            traitement de donnees de sante d&apos;un mineur n&apos;est effectue
            sans le consentement prealable du titulaire de l&apos;autorite
            parentale. Un registre des consentements est maintenu a des fins
            d&apos;audit.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">9. Contact</h2>
          <p className="text-muted-foreground mb-4">
            Pour toute question relative à cette politique de confidentialité ou
            à la protection de vos données, vous pouvez nous contacter via
            notre{" "}
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
