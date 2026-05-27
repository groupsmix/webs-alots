import type { Metadata } from "next";
import { EditorialCustomersContent } from "@/components/landing/editorial/editorial-customers-content";
import { EditorialPageShell } from "@/components/landing/editorial/editorial-page-shell";

export const metadata: Metadata = {
  title: "Clients \u2014 Oltigo Health",
  description:
    "\u00C9tudes de cas de cabinets m\u00E9dicaux utilisant Oltigo pour g\u00E9rer rendez-vous, dossiers et notifications.",
  openGraph: {
    title: "Clients \u2014 Oltigo Health",
    description: "\u00C9tudes de cas de cabinets m\u00E9dicaux au Maroc.",
  },
};

export default function CustomersPage() {
  return (
    <EditorialPageShell>
      <EditorialCustomersContent />
    </EditorialPageShell>
  );
}
