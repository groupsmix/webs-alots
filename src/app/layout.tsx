import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getTenant } from "@/lib/tenant";
import { clinicConfig } from "@/config/clinic.config";
import { TenantProvider } from "@/components/tenant-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { PlausibleScript } from "@/components/plausible-script";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { getDirection, type Locale } from "@/lib/i18n";

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
    default: "Oltigo — Gestion Médicale en Ligne",
    template: "%s | Oltigo",
  },
  description:
    "Plateforme de gestion de cabinets médicaux, dentaires et pharmacies au Maroc. Prise de rendez-vous en ligne, dossiers patients, ordonnances et plus.",
  keywords: [
    "gestion cabinet médical",
    "logiciel médecin",
    "logiciel dentiste",
    "logiciel pharmacie",
    "rendez-vous médical en ligne",
    "SaaS santé Maroc",
    "dossier patient électronique",
    "plateforme médicale",
    "إدارة العيادات الطبية",
    "حجز موعد طبي",
  ],
  authors: [{ name: "Oltigo" }],
  alternates: {
    languages: {
      "fr": "https://oltigo.com",
      "ar": "https://oltigo.com?lang=ar",
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_MA",
    alternateLocale: ["ar_MA"],
    siteName: "Oltigo",
    title: "Oltigo — Gestion Médicale en Ligne",
    description:
      "Plateforme de gestion de cabinets médicaux, dentaires et pharmacies au Maroc.",
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
  const locale: Locale = (clinicConfig.locale as Locale) ?? "fr";
  const dir = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify({
              "@context": "https://schema.org",
              "@type": "MedicalBusiness",
              name: tenant?.clinicName || clinicConfig.name || "Oltigo",
              description: tenant
                ? `${tenant.clinicName} — Cabinet ${tenant.clinicType || "médical"} professionnel. Prenez rendez-vous en ligne.`
                : "Plateforme SaaS pour la gestion de cabinets médicaux, dentaires et pharmacies au Maroc.",
              url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com",
              "@id":
                (process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com") +
                "/#organization",
              ...(clinicConfig.contact.phone && {
                telephone: clinicConfig.contact.phone,
              }),
              ...(clinicConfig.contact.email && {
                email: clinicConfig.contact.email,
              }),
              ...(clinicConfig.contact.address && {
                address: {
                  "@type": "PostalAddress",
                  streetAddress: clinicConfig.contact.address,
                  addressLocality: clinicConfig.contact.city ?? "",
                  addressCountry: "MA",
                },
              }),
              currenciesAccepted: clinicConfig.currency,
              potentialAction: {
                "@type": "ReserveAction",
                target:
                  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com") +
                  "/book",
                name: "Prendre rendez-vous en ligne",
              },
            }),
          }}
        />
        <ThemeProvider>
          <ToastProvider>
            <TenantProvider tenant={tenant}>
              {children}
            </TenantProvider>
            <OfflineIndicator />
            <PerformanceMonitor />
            <ServiceWorkerRegister />
          </ToastProvider>
        </ThemeProvider>
        <PlausibleScript />
      </body>
    </html>
  );
}
