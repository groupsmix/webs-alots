import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Envoyer une Ordonnance",
  description:
    "Envoyez votre ordonnance en ligne. Nous préparons vos médicaments et vous notifions par WhatsApp quand ils sont prêts.",
  openGraph: {
    title: "Envoyer une Ordonnance",
    description: "Envoyez votre ordonnance en ligne et récupérez vos médicaments rapidement.",
  },
};

export default function PrescriptionUploadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
