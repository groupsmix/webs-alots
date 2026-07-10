import type { Metadata } from "next";
import { LandingLocaleProvider } from "@/components/landing/landing-locale-provider";
import { Pricing } from "@/components/landing/oltigo/components/sections/pricing";
import { OltigoPublicShell } from "@/components/landing/oltigo/public-shell";
import { PricingContent } from "@/components/landing/pricing-content";
import { getTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Tarifs — Plans et Abonnements",
  description:
    "Découvrez nos plans tarifaires adaptés à chaque cabinet médical. Du plan gratuit au plan Enterprise, trouvez l'offre qui vous convient.",
  openGraph: {
    title: "Tarifs — Plans et Abonnements | Oltigo",
    description: "Plans tarifaires pour professionnels de santé. Commencez gratuitement.",
  },
};

export default async function PricingPage() {
  const tenant = await getTenant();

  // Subdomain → render legacy pricing inside the tenant public layout.
  if (tenant) {
    return (
      <LandingLocaleProvider>
        <PricingContent />
      </LandingLocaleProvider>
    );
  }

  // Root domain → Oltigo landing chrome with the dedicated pricing section.
  return (
    <OltigoPublicShell mainClassName="pt-16">
      <Pricing />
    </OltigoPublicShell>
  );
}
