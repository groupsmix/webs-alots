import type { Metadata } from "next";
import { ClinicAboutContent } from "@/components/landing/editorial/clinic-about-content";
import { EditorialAboutContent } from "@/components/landing/editorial/editorial-about-content";
import { EditorialPageShell } from "@/components/landing/editorial/editorial-page-shell";
import { getTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "\u00C0 propos \u2014 Oltigo Health",
  description:
    "L\u2019institution derri\u00E8re la plateforme. Oltigo Health \u2014 syst\u00E8me d\u2019exploitation pour cliniques ind\u00E9pendantes au Maroc.",
  openGraph: {
    title: "\u00C0 propos \u2014 Oltigo Health",
    description: "L\u2019institution derri\u00E8re la plateforme.",
  },
};

export default async function AboutPage() {
  const tenant = await getTenant();

  if (!tenant) {
    return (
      <EditorialPageShell>
        <EditorialAboutContent />
      </EditorialPageShell>
    );
  }

  return <ClinicAboutContent />;
}
