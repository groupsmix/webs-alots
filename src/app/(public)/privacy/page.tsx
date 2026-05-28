import type { Metadata } from "next";
import { LegalDoc, type LegalDocSection } from "@/components/editorial/legal-doc";

export const metadata: Metadata = {
  title: "Politique de Confidentialité",
  description:
    "Politique de confidentialité et protection des données personnelles. Conformité RGPD et loi marocaine 09-08.",
  openGraph: {
    title: "Politique de Confidentialité",
    description: "Politique de confidentialité et protection des données personnelles.",
  },
};

export default function PrivacyPage() {
  const sections: LegalDocSection[] = [
    {
      id: "introduction",
      number: "01",
      title: "Introduction",
      children: (
        <p>
          La présente politique de confidentialité décrit comment Oltigo (&quot;nous&quot;,
          &quot;notre&quot;, &quot;la plateforme&quot;) collecte, utilise et protège vos données
          personnelles conformément au Règlement Général sur la Protection des Données (RGPD) et à
          la loi marocaine n° 09-08 relative à la protection des personnes physiques à l&apos;égard
          du traitement des données à caractère personnel.
        </p>
      ),
    },
    {
      id: "donnees-collectees",
      number: "02",
      title: "Données Collectées",
      children: (
        <>
          <p>Dans le cadre de nos services, nous pouvons collecter les données suivantes :</p>
          <ul>
            <li>
              <strong>Données d&apos;identification :</strong> nom, prénom, adresse e-mail, numéro
              de téléphone.
            </li>
            <li>
              <strong>Données de santé :</strong> informations médicales fournies lors de la prise
              de rendez-vous (motif de consultation, antécédents médicaux).
            </li>
            <li>
              <strong>Données de connexion :</strong> adresse IP, type de navigateur, pages
              visitées.
            </li>
            <li>
              <strong>Données de rendez-vous :</strong> dates, heures, praticiens consultés.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "finalites",
      number: "03",
      title: "Finalités du Traitement",
      children: (
        <>
          <p>Vos données sont traitées pour les finalités suivantes :</p>
          <ul>
            <li>Gestion des rendez-vous et du suivi médical.</li>
            <li>Communication avec les patients (rappels, confirmations).</li>
            <li>Amélioration de nos services et de l&apos;expérience utilisateur.</li>
            <li>Respect des obligations légales et réglementaires.</li>
          </ul>
        </>
      ),
    },
    {
      id: "protection",
      number: "04",
      title: "Protection des Données",
      children: (
        <p>
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
          protéger vos données personnelles contre tout accès non autorisé, modification,
          divulgation ou destruction. Les données de santé font l&apos;objet de mesures de
          protection renforcées.
        </p>
      ),
    },
    {
      id: "partage",
      number: "05",
      title: "Partage des Données",
      children: (
        <p>
          Vos données personnelles ne sont partagées qu&apos;avec les praticiens et le personnel
          médical impliqués dans votre prise en charge. Nous ne vendons ni ne louons vos données à
          des tiers.
        </p>
      ),
    },
    {
      id: "conservation",
      number: "06",
      title: "Conservation des Données",
      children: (
        <p>
          Vos données sont conservées pendant la durée nécessaire aux finalités pour lesquelles
          elles ont été collectées, et conformément aux délais de conservation prévus par la
          réglementation en vigueur.
        </p>
      ),
    },
    {
      id: "vos-droits",
      number: "07",
      title: "Vos Droits",
      children: (
        <>
          <p>Conformément à la réglementation applicable, vous disposez des droits suivants :</p>
          <ul>
            <li>
              <strong>Droit d&apos;accès :</strong> obtenir une copie de vos données personnelles.
            </li>
            <li>
              <strong>Droit de rectification :</strong> corriger des données inexactes ou
              incomplètes.
            </li>
            <li>
              <strong>Droit de suppression :</strong> demander l&apos;effacement de vos données.
            </li>
            <li>
              <strong>Droit d&apos;opposition :</strong> vous opposer au traitement de vos données.
            </li>
            <li>
              <strong>Droit à la portabilité :</strong> recevoir vos données dans un format
              structuré.
            </li>
          </ul>
          <p>Pour exercer ces droits, veuillez nous contacter via notre page de contact.</p>
        </>
      ),
    },
    {
      id: "contact",
      number: "08",
      title: "Contact",
      children: (
        <p>
          Pour toute question relative à cette politique de confidentialité ou à la protection de
          vos données, vous pouvez nous contacter via notre <a href="/contact">page de contact</a>.
        </p>
      ),
    },
  ];

  return (
    <LegalDoc title="Politique de Confidentialité" lastUpdated="MARS 2026" sections={sections} />
  );
}
