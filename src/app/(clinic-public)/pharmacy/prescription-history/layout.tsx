import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, noarchive: true },
  title: "Historique Ordonnances",
  description:
    "Consultez l'historique de vos ordonnances, le statut de préparation et les rappels de renouvellement.",
  openGraph: {
    title: "Historique Ordonnances",
    description: "Consultez l'historique de vos ordonnances et leur statut.",
  },
};

export default function PrescriptionHistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
