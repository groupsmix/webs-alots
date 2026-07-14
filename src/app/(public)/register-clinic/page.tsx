import type { Metadata } from "next";
import { headers } from "next/headers";
import { OltigoPublicShell } from "@/components/landing/oltigo/public-shell";
import { RegisterForm } from "@/components/onboarding/register-form";
import { t, type Locale } from "@/lib/i18n";
import { getTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  // Root layout's title template appends " | Oltigo"; omit the brand here so
  // it does not render twice.
  title: "Créer votre clinique",
  description:
    "Inscrivez votre cabinet médical gratuitement sur Oltigo. Obtenez votre propre site web et commencez à recevoir des patients en ligne.",
  openGraph: {
    title: "Créer votre clinique — Oltigo",
    description:
      "Inscrivez votre cabinet médical gratuitement et obtenez votre propre sous-domaine.",
  },
};

export default async function RegisterPage() {
  const tenant = await getTenant();
  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";

  const form = (
    <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center px-4 py-12">
      <h1 className="sr-only">{t(locale, "registerClinic.pageHeading")}</h1>
      <RegisterForm />
    </div>
  );

  // Subdomain → render inside the tenant public layout (light theme).
  if (tenant) {
    return form;
  }

  // Root domain → Oltigo landing chrome with the registration form on a light canvas.
  return (
    <OltigoPublicShell mainClassName="min-h-screen bg-background pt-16 text-foreground">
      {form}
    </OltigoPublicShell>
  );
}
