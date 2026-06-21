import type { Metadata } from "next";
import type { ReactNode } from "react";

// NAV-3: give this client-component page a specific browser-tab title.
// Client pages cannot export `metadata`, so a metadata-only server layout
// sets it; the root template ("%s | Oltigo") composes it to "Website Builder | Oltigo".
export const metadata: Metadata = {
  title: "Website Builder",
};

export default function WebsiteBuilderLayout({ children }: { children: ReactNode }) {
  return children;
}
