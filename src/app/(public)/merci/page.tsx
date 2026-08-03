/* eslint-disable i18next/no-literal-string, react/no-unescaped-entities */
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Merci pour votre demande",
  description:
    "Votre demande de démonstration a bien été prise en compte. L'équipe Oltigo vous recontactera sous 24 heures.",
  path: "/merci",
  noIndex: true,
});

export default function MerciPage() {
  return (
    <main className="container mx-auto flex min-h-[70vh] flex-col items-center justify-center px-4 py-24 text-center">
      <CheckCircle2 className="h-16 w-16 text-emerald" aria-hidden="true" />
      <h1 className="mt-6 text-3xl font-bold">Merci pour votre demande</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Nous avons bien reçu vos coordonnées. Un membre de l'équipe Oltigo vous contactera sous 24
        heures pour vous montrer la plateforme sur vos cas réels.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/register-clinic"
          className={buttonVariants({ variant: "default", size: "lg" })}
          data-event="conversion-thank-you-register"
        >
          Créer votre clinique
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/services"
          className={buttonVariants({ variant: "outline", size: "lg" })}
          data-event="conversion-thank-you-features"
        >
          Découvrir les fonctionnalités
        </Link>
      </div>
    </main>
  );
}
