import type { Metadata } from "next";
import { LandingLocaleProvider } from "@/components/landing/landing-locale-provider";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { RegisterForm } from "@/components/onboarding/register-form";

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

export default function RegisterPage() {
  return (
    <LandingLocaleProvider>
      <div className="flex min-h-screen flex-col bg-white">
        <LandingHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <RegisterForm />
        </main>
        <LandingFooter />
      </div>
    </LandingLocaleProvider>
  );
}
