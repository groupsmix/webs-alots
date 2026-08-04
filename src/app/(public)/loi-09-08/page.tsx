/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Loi 09-08 — Protection des données personnelles",
  description:
    "Comment Oltigo respecte la Loi 09-08 marocaine et les exigences de la CNDP pour la protection des données de santé.",
  path: "/loi-09-08",
});

export default function Loi0908Page() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Loi 09-08 et protection des données</h1>

      <p className="text-muted-foreground mb-8">
        Oltigo est conçu pour accompagner les cabinets médicaux marocains dans le respect de la{" "}
        <strong>Loi n° 09-08</strong> relative à la protection des données personnelles et des{" "}
        <strong>directives de la CNDP</strong>.
      </p>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold">Ce que prévoit la Loi 09-08</h2>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            <strong>Consentement :</strong> toute collecte de données personnelles doit être fondée
            sur un consentement libre, éclairé et spécifique du patient.
          </li>
          <li>
            <strong>Finalité déterminée :</strong> les données ne peuvent être utilisées que pour
            les finalités déclarées (gestion des rendez-vous, dossier médical, facturation).
          </li>
          <li>
            <strong>Durée de conservation :</strong> les données ne sont conservées que pendant la
            durée nécessaire à leur finalité, avec des durées médicales et fiscales distinctes.
          </li>
          <li>
            <strong>Sécurité :</strong> le responsable de traitement doit mettre en œuvre des
            mesures techniques et organisationnelles adaptées (chiffrement, contrôle d'accès,
            traçabilité).
          </li>
          <li>
            <strong>Droits des personnes :</strong> accès, rectification, opposition et effacement,
            sous réserve des obligations légales.
          </li>
        </ul>

        <h2 className="text-xl font-semibold">Les engagements d'Oltigo</h2>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            Isolement strict des données par cabinet (multi-tenant) grâce au Row Level Security.
          </li>
          <li>Chiffrement AES-256-GCM des fichiers patients et des sauvegardes R2.</li>
          <li>Connexions en TLS 1.3, authentification renforcée et journalisation des accès.</li>
          <li>Hébergement Cloudflare R2 et Supabase sur des régions adaptées au Maroc.</li>
          <li>Politique de conservation paramétrable et exports de données sur demande.</li>
        </ul>

        <h2 className="text-xl font-semibold">Contact CNDP</h2>
        <p className="text-muted-foreground">
          Pour plus d'informations sur la Loi 09-08, consultez le site de la{" "}
          <a
            href="https://www.cndp.ma/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Commission Nationale de contrôle de la protection des Données à caractère Personnel
            (CNDP)
          </a>{" "}
          du Maroc.
        </p>
      </section>
    </div>
  );
}
