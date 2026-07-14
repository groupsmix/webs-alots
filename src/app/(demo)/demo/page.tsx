import type { Metadata } from "next";
import { headers } from "next/headers";
import { DemoLoginCard } from "@/components/demo/demo-login-card";
import { t, type Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  // Root layout's title template appends " | Oltigo"; omit the brand here so
  // it does not render twice.
  title: "Démo",
  description:
    "Explorez la plateforme Oltigo en mode démo. Connectez-vous en un clic en tant que Docteur, Réceptionniste ou Patient.",
};

export default async function DemoPage() {
  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50/70 via-white to-white">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <h1 className="sr-only">{t(locale, "demo.pageHeading")}</h1>
        <DemoLoginCard />
      </main>
    </div>
  );
}
