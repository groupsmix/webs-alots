import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Chatbot } from "@/components/chatbot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Health SaaS Platform — Gestion Médicale en Ligne",
    template: "%s | Health SaaS Platform",
  },
  description:
    "Plateforme SaaS multi-tenant pour la gestion de cabinets médicaux, dentaires et pharmacies au Maroc. Prise de rendez-vous, dossiers patients, ordonnances et plus.",
  keywords: [
    "gestion cabinet médical",
    "logiciel médecin",
    "logiciel dentiste",
    "logiciel pharmacie",
    "rendez-vous médical en ligne",
    "SaaS santé Maroc",
    "dossier patient électronique",
    "plateforme médicale",
  ],
  authors: [{ name: "Health SaaS Platform" }],
  openGraph: {
    type: "website",
    locale: "fr_MA",
    siteName: "Health SaaS Platform",
    title: "Health SaaS Platform — Gestion Médicale en Ligne",
    description:
      "Plateforme SaaS multi-tenant pour la gestion de cabinets médicaux, dentaires et pharmacies au Maroc.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Chatbot />
      </body>
    </html>
  );
}
