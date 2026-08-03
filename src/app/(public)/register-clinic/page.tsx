import type { Metadata } from "next";
import { headers } from "next/headers";
import { RegisterForm } from "@/components/onboarding/register-form";
import { t, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Créer votre clinique",
  description:
    "Inscrivez votre cabinet médical gratuitement sur Oltigo. Obtenez votre propre site web et commencez à recevoir des patients en ligne.",
  path: "/register-clinic",
});

export default async function RegisterPage() {
  const h = await headers();
  const locale: Locale =
    (h.get("x-locale") as Locale) || (h.get("x-tenant-locale") as Locale) || "fr";

  const form = (
    <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center px-4 py-12">
      <h1 className="sr-only">{t(locale, "registerClinic.pageHeading")}</h1>
      <RegisterForm />
    </div>
  );

  // Both root and subdomain layouts already provide the surrounding chrome.
  return form;
}
