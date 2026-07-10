import type { Metadata } from "next";
import { OltigoPublicShell } from "@/components/landing/oltigo/public-shell";
import { RegisterForm } from "@/components/onboarding/register-form";
import { getTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Créer votre clinique — Oltigo",
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

  const form = (
    <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center px-4 py-12">
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
