import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
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
import { getDirection, type Locale } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Skip-to-content link for keyboard / screen-reader accessibility (WCAG 2.4.1) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Aller au contenu principal
        </a>
        {/* JSON-LD structured data is rendered on public pages only (Issue 59).
            See src/app/(public)/page.tsx for clinic-specific schema. */}
        <ThemeProvider>
          <ToastProvider>
            <TenantProvider tenant={tenant}>
              {children}
            </TenantProvider>
            <OfflineIndicator />
            {process.env.NEXT_PUBLIC_ENABLE_PERF_MONITORING === "true" && (
              <PerformanceMonitor />
            )}
          </ToastProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
        <PlausibleScript />
      </body>
    </html>
  );
}
