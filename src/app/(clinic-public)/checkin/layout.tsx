import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check-in",
  description: "Enregistrement de votre arrivée à la clinique.",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
