/* eslint-disable i18next/no-literal-string -- Static legal/compliance page with French content */
import type { Metadata } from "next";
import { LegalDoc, type LegalDocSection } from "@/components/editorial/legal-doc";

export const metadata: Metadata = {
  title: "Déclaration d'accessibilité",
  description:
    "Déclaration de conformité WCAG 2.2 AA de la plateforme Oltigo Health. Engagement en matière d'accessibilité numérique.",
  openGraph: {
    title: "Déclaration d'accessibilité — Oltigo Health",
    description: "Déclaration de conformité WCAG 2.2 AA de la plateforme Oltigo Health.",
  },
};

/**
 * F-A201: WCAG 2.2 AA Accessibility Conformance Statement.
 *
 * Required by the EU Web Accessibility Directive (2016/2102) and
 * Moroccan Law 65-99 (disability rights). This page declares
 * the current state of accessibility conformance and provides
 * contact information for reporting barriers.
 */
export default function AccessibilityPage() {
  const sections: LegalDocSection[] = [
    {
      id: "engagement",
      number: "01",
      title: "Engagement",
      children: (
        <p>
          Oltigo Health s&apos;engage à rendre sa plateforme accessible à toutes les personnes, y
          compris celles en situation de handicap. Nous travaillons continuellement à améliorer
          l&apos;expérience utilisateur et à appliquer les normes d&apos;accessibilité pertinentes.
        </p>
      ),
    },
    {
      id: "norme",
      number: "02",
      title: "Norme de référence",
      children: (
        <p>
          Cette déclaration s&apos;appuie sur les{" "}
          <strong>Web Content Accessibility Guidelines (WCAG) 2.2, niveau AA</strong>, publiées par
          le W3C. Ces directives sont la référence internationale pour l&apos;accessibilité des
          contenus web.
        </p>
      ),
    },
    {
      id: "conformite",
      number: "03",
      title: "État de conformité",
      children: (
        <>
          <p>
            La plateforme Oltigo Health est en <strong>conformité partielle</strong> avec les WCAG
            2.2 niveau AA. Les points suivants sont assurés :
          </p>
          <ul>
            <li>
              <strong>Navigation au clavier</strong> : toutes les fonctionnalités principales sont
              accessibles sans souris.
            </li>
            <li>
              <strong>Contrastes de couleurs</strong> : les combinaisons de couleurs respectent un
              ratio de contraste minimum de 4.5:1 pour le texte normal.
            </li>
            <li>
              <strong>Support RTL</strong> : l&apos;interface est compatible avec les langues
              écrites de droite à gauche (arabe).
            </li>
            <li>
              <strong>Textes alternatifs</strong> : les images significatives disposent
              d&apos;attributs <code>alt</code> descriptifs.
            </li>
            <li>
              <strong>Structure sémantique</strong> : utilisation de balises HTML sémantiques
              (headings, landmarks, labels).
            </li>
            <li>
              <strong>Responsive design</strong> : l&apos;interface s&apos;adapte aux différentes
              tailles d&apos;écran et niveaux de zoom jusqu&apos;à 200%.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "limitations",
      number: "04",
      title: "Limitations connues",
      children: (
        <>
          <p>Malgré nos efforts, certains contenus peuvent ne pas être pleinement accessibles :</p>
          <ul>
            <li>
              Certains composants de calendrier/planification peuvent ne pas être entièrement
              navigables au clavier.
            </li>
            <li>
              Les documents PDF générés (ordonnances, factures) ne sont pas encore balisés pour
              l&apos;accessibilité.
            </li>
            <li>
              Les contenus générés par IA (prescriptions, résumés patients) n&apos;ont pas été
              testés avec des lecteurs d&apos;écran.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "technologies",
      number: "05",
      title: "Technologies utilisées",
      children: (
        <ul>
          <li>HTML5</li>
          <li>CSS3 / Tailwind CSS</li>
          <li>JavaScript / TypeScript (React 19, Next.js 16)</li>
          <li>WAI-ARIA pour les composants interactifs</li>
        </ul>
      ),
    },
    {
      id: "methode",
      number: "06",
      title: "Méthode d'évaluation",
      children: (
        <>
          <p>L&apos;accessibilité d&apos;Oltigo Health est évaluée par :</p>
          <ul>
            <li>
              Tests automatisés avec <code>jest-axe</code> intégrés à la suite de tests CI/CD.
            </li>
            <li>
              Revue manuelle avec les outils Chrome DevTools Accessibility, Lighthouse, et WAVE.
            </li>
            <li>Test avec le lecteur d&apos;écran NVDA (Windows) et VoiceOver (macOS/iOS).</li>
          </ul>
        </>
      ),
    },
    {
      id: "contact",
      number: "07",
      title: "Retour d'information et contact",
      children: (
        <>
          <p>
            Si vous rencontrez un obstacle d&apos;accessibilité sur notre plateforme, nous vous
            invitons à nous contacter :
          </p>
          <ul>
            <li>
              <strong>Email</strong> :{" "}
              <a href="mailto:accessibilite@oltigo.com">accessibilite@oltigo.com</a>
            </li>
            <li>
              <strong>Formulaire de contact</strong> : <a href="/contact">oltigo.com/contact</a>
            </li>
          </ul>
          <p>
            Nous nous engageons à répondre à tout signalement dans un délai de 15 jours ouvrables et
            à proposer une solution alternative si le contenu ne peut pas être rendu accessible
            immédiatement.
          </p>
        </>
      ),
    },
    {
      id: "recours",
      number: "08",
      title: "Voies de recours",
      children: (
        <p>
          Si, après nous avoir contactés, vous estimez que votre signalement n&apos;a pas été traité
          de manière satisfaisante, vous pouvez saisir le Médiateur du Royaume du Maroc ou
          l&apos;autorité compétente en matière d&apos;accessibilité numérique dans votre pays de
          résidence.
        </p>
      ),
    },
  ];

  return (
    <LegalDoc title="Déclaration d'accessibilité" lastUpdated="MAI 2026" sections={sections} />
  );
}
