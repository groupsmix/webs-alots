import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mes Résultats",
  description: "Consultez vos résultats d'analyses médicales en toute sécurité.",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function MyResultsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
