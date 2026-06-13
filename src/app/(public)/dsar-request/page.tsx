/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */
import { DSARRequestForm } from "@/components/compliance/dsar-request-form";

export const metadata = {
  title: "Demande d'exercice de droits | Oltigo",
  description:
    "Demandez l'accès, la rectification, la suppression ou la portabilité de vos données personnelles. Réponse sous 30 jours conformément à la loi marocaine n°09-08.",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function DSARRequestPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-medium">Demande d&apos;exercice de droits</h1>
      <p className="mb-2 text-sm text-muted-foreground">
        Loi marocaine n°09-08 relative à la protection des personnes physiques.
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        Vous pouvez demander l&apos;accès, la rectification, la suppression, la portabilité ou
        l&apos;opposition au traitement de vos données personnelles. Nous répondrons sous 30 jours.
      </p>
      <DSARRequestForm />
    </div>
  );
}
