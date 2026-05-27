import type { Metadata } from "next";
import { EditorialPageShell } from "@/components/landing/editorial/editorial-page-shell";
import { EditorialPricingContent } from "@/components/landing/editorial/editorial-pricing-content";
import { LandingLocaleProvider } from "@/components/landing/landing-locale-provider";
import { PricingContent } from "@/components/landing/pricing-content";
import { getTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Tarifs \u2014 Plans et Abonnements",
  description:
    "D\u00E9couvrez nos plans tarifaires adapt\u00E9s \u00E0 chaque cabinet m\u00E9dical. Du plan gratuit au plan Enterprise, trouvez l\u2019offre qui vous convient.",
  openGraph: {
    title: "Tarifs \u2014 Plans et Abonnements | Oltigo",
    description:
      "Plans tarifaires pour professionnels de sant\u00E9. Commencez gratuitement.",
  },
};

export default async function PricingPage() {
  const tenant = await getTenant();

  if (!tenant) {
    return (
      <EditorialPageShell>
        <EditorialPricingContent />
      </EditorialPageShell>
    );
  }

  return (
    <LandingLocaleProvider>
      <PricingContent />
    </LandingLocaleProvider>
  );
}
