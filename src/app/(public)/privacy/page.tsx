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
          <p>Dans le cadre de nos services, nous traitons uniquement les données suivantes :</p>
          <ul>
            <li>
              <strong>Données de contact :</strong> nom, prénom, adresse e-mail, numéro de
              téléphone.
            </li>
            <li>
              <strong>Données de rendez-vous :</strong> dates, heures et cabinet concerné.
            </li>
            <li>
              <strong>Données de facturation :</strong> montants, méthodes et statuts de paiement
              (les données de carte sont traitées par nos prestataires de paiement).
            </li>
            <li>
              <strong>Données de connexion :</strong> adresse IP, type de navigateur, pages
              visitées.
            </li>
          </ul>
          <p>
            Oltigo ne collecte ni ne stocke aucune donnée clinique, diagnostique ou de dossier
            médical (diagnostics, ordonnances, résultats d&apos;analyses, notes cliniques).
          </p>
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
            <li>Gestion des rendez-vous et des listes d&apos;attente.</li>
            <li>Communication avec les patients (rappels, confirmations).</li>
            <li>Facturation et traitement des paiements.</li>
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
          divulgation ou destruction. Les coordonnées des patients sont chiffrées au repos.
        </p>
      ),
    },
    {
      id: "partage",
      number: "05",
      title: "Partage des Données",
      children: (
        <>
          <p>
            Vos données personnelles ne sont partagées qu&apos;avec le cabinet auprès duquel vous
            prenez rendez-vous et avec les sous-traitants techniques strictement nécessaires au
            fonctionnement du service. Nous ne vendons ni ne louons vos données à des tiers.
          </p>
          <p>Nos sous-traitants (sous-processeurs) sont :</p>
          <ul>
            <li>
              <strong>Hébergement et base de données :</strong> Supabase et Cloudflare (Workers,
              R2).
            </li>
            <li>
              <strong>Paiements :</strong> Stripe et CMI (Centre Monétique Interbancaire).
            </li>
            <li>
              <strong>Messagerie :</strong> Meta (API WhatsApp Business) et Twilio (SMS/WhatsApp de
              secours).
            </li>
            <li>
              <strong>E-mails transactionnels :</strong> Resend.
            </li>
            <li>
              <strong>Supervision et mesure d&apos;audience :</strong> Sentry et Plausible
              Analytics.
            </li>
            <li>
              <strong>Assistants IA opérationnels :</strong> OpenAI (analyses et assistants pour les
              gérants, sans aucune donnée clinique).
            </li>
          </ul>
          <p>
            La liste détaillée et à jour figure sur notre page{" "}
            <a href="/sub-processors">Sous-traitants</a>.
          </p>
        </>
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
      id: "mineurs",
      number: "08",
      title: "Données des Mineurs",
      children: (
        <>
          <p>
            Conformément à la loi marocaine n° 09-08 et au RGPD (article 8), le traitement des
            données personnelles des mineurs (moins de 18 ans) nécessite le consentement préalable
            d&apos;un parent ou tuteur légal.
          </p>
          <ul>
            <li>
              <strong>Enregistrement réservé aux adultes :</strong> en l&apos;absence d&apos;un flux
              de consentement parental complet, l&apos;enregistrement d&apos;un patient dont la date
              de naissance indique un âge inférieur à 18 ans est refusé.
            </li>
            <li>
              <strong>Pas de profilage :</strong> aucune analyse comportementale, publicité ciblée
              ou traitement automatisé à des fins de profilage n&apos;est effectué sur les données
              des patients.
            </li>
            <li>
              <strong>Droits du tuteur :</strong> le parent ou tuteur légal peut exercer les droits
              d&apos;accès, de rectification et de suppression pour le compte d&apos;un mineur dont
              les coordonnées figureraient dans le système.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "contact",
      number: "09",
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
