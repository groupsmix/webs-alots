import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getTenant } from "@/lib/tenant";
import { TenantProvider } from "@/components/tenant-provider";
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
  manifest: "/manifest.webmanifest",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getTenant();

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* SAFETY: dangerouslySetInnerHTML is safe here — JSON.stringify of a
            server-controlled object with no user-sourced content. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "MedicalBusiness",
              name: tenant?.clinicName ?? "Health SaaS Platform",
              description:
                "Plateforme SaaS multi-tenant pour la gestion de cabinets m\u00e9dicaux, dentaires et pharmacies au Maroc.",
              url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com",
              "@id":
                (process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com") +
                "/#organization",
              potentialAction: {
                "@type": "ReserveAction",
                target:
                  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com") +
                  "/book",
                name: "Prendre rendez-vous",
              },
            }),
          }}
        />
        <TenantProvider tenant={tenant}>
          {children}
          <Chatbot />
        </TenantProvider>
      </body>
    </html>
  );
}
