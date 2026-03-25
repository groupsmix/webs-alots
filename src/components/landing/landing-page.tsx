import { LandingHeader } from "./landing-header";
import { HeroSection } from "./hero-section";
import { TrustSection } from "./trust-section";
import { FeaturesSection } from "./features-section";
import { HowItWorksSection } from "./how-it-works-section";
import { DemoSection } from "./demo-section";
import { CtaSection } from "./cta-section";
import { LandingFooter } from "./landing-footer";

/**
 * SaaS landing page shown on the root domain (oltigo.com).
 *
 * This page does NOT load any tenant/clinic data.
 * Clinic websites live on subdomains (e.g. dr-ahmed.oltigo.com).
 */
export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection />
        <TrustSection />
        <FeaturesSection />
        <HowItWorksSection />
        <DemoSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
