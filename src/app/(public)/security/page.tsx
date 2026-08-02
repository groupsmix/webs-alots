/* eslint-disable i18next/no-literal-string -- static security disclosure page */

import { ExternalLink, FileText, Mail, Shield } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sécurité — Oltigo",
  description:
    "Politique de divulgation responsable et coordonnées de sécurité pour Oltigo. Signalez une vulnérabilité en toute confiance.",
};

export default function SecurityPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sécurité</h1>
        <p className="mt-4 text-muted-foreground">
          Nous prenons la sécurité des données de santé très au sérieux. Si vous avez découvert une
          vulnérabilité, voici comment nous la signaler.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-full bg-emerald/10 p-3 text-emerald">
              <Mail className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Contact sécurité</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Envoyez votre rapport directement à notre équipe sécurité.
              </p>
              <a
                href="mailto:security@oltigo.com?subject=Signalement%20de%20vulnérabilité"
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald hover:underline"
              >
                security@oltigo.com
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-full bg-emerald/10 p-3 text-emerald">
              <Shield className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Safe harbor</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Oltigo Health n’engagera pas de poursuites judiciaires contre les chercheurs qui
                signalent des vulnérabilités de bonne foi, dans le respect de notre politique de
                divulgation responsable.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-full bg-emerald/10 p-3 text-emerald">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Ressources</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Le fichier machine-readable security.txt (RFC 9116) est disponible ci-dessous.
              </p>
              <a
                href="/.well-known/security.txt"
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald hover:underline"
              >
                Fichier security.txt (RFC 9116)
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 rounded-lg border border-hairline bg-surface/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Pour toute question sur la conformité, la protection des données patient ou la Loi 09-08,
          contactez notre DPO à{" "}
          <a href="mailto:dpo@oltigo.com" className="font-medium text-emerald hover:underline">
            dpo@oltigo.com
          </a>
          .
        </p>
      </div>
    </section>
  );
}
