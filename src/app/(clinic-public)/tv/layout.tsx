import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "File d'attente",
  description: "Affichage de la file d'attente en temps réel.",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function TvQueueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
