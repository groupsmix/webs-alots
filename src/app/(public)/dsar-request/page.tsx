import { DSARRequestForm } from "@/components/compliance/dsar-request-form";

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