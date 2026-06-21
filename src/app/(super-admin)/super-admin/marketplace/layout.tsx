import type { Metadata } from "next";
import type { ReactNode } from "react";

// NAV-3: specific browser-tab title for this client-component page.
// Composes via the root template into "Marketplace | Oltigo".
export const metadata: Metadata = {
  title: "Marketplace",
};

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return children;
}
