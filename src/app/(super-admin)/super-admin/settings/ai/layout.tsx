import type { Metadata } from "next";
import type { ReactNode } from "react";

// NAV-3: specific browser-tab title for this client-component page.
// Composes via the root template into "AI Configuration | Oltigo".
export const metadata: Metadata = {
  title: "AI Configuration",
};

export default function AiSettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
