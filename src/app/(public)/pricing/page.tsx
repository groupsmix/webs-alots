import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingLocaleProvider } from "@/components/landing/landing-locale-provider";
import { PricingContent } from "@/components/landing/pricing-content";
import { getTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Tarifs — Plans et Abonnements",
  description:
    "Découvrez nos plans tarifaires adaptés à chaque cabinet médical. Du plan gratuit au plan Enterprise, trouvez l'offre qui vous convient.",
  openGraph: {
    title: "Tarifs — Plans et Abonnements | Oltigo",
    description:
      "Plans tarifaires pour professionnels de santé. Commencez gratuitement.",
  },
};

export default async function PricingPage() {
  const tenant = await getTenant();

  // Root domain → show pricing with SaaS landing chrome
  if (!tenant) {
    return (
      <LandingLocaleProvider>
        <div className="flex min-h-screen flex-col bg-white">
          <LandingHeader />
          <main className="flex-1">
            <PricingContent />
          </main>
          <LandingFooter />
        </div>
      </LandingLocaleProvider>
    );
  }

  // Subdomain → rendered inside tenant layout (header/footer from layout.tsx)
  return (
    <LandingLocaleProvider>
      <PricingContent />
    </LandingLocaleProvider>
  );
}
