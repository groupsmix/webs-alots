import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { PlausibleScript } from "@/components/plausible-script";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { TenantProvider } from "@/components/tenant-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { getDirection, t, type Locale, type TranslationKey } from "@/lib/i18n";
import { getTenant } from "@/lib/tenant";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
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

/**
 * SEO-01: Locale-aware metadata via i18n instead of hardcoded French.
 *
 * F-A89-01: The locale is defaulted to "fr" for now (same as the layout).
 * Per-tenant locale headers are not yet implemented. Arabic and English
 * users get a French shell until this is resolved. When per-tenant locale
 * headers are added (see TODO in RootLayout), this will automatically
 * pick up the correct language.
 */
export async function generateMetadata(): Promise<Metadata> {
  // Default locale — will be dynamically resolved once per-tenant locale
  // headers are available (see TODO in RootLayout below).
  const cookieStore = await import("next/headers").then(m => m.cookies());
  const preferredLocale = cookieStore.get("preferred-locale")?.value as Locale;
  const locale = preferredLocale || ("fr" as Locale);

  return {
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
      default: t(locale, "meta.title" as TranslationKey),
      template: t(locale, "meta.titleTemplate" as TranslationKey),
    },
    description: t(locale, "meta.description" as TranslationKey),
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
      locale: locale === "ar" ? "ar_MA" : "fr_MA",
      alternateLocale: locale === "ar" ? ["fr_MA"] : ["ar_MA"],
      siteName: "Oltigo",
      title: t(locale, "meta.ogTitle" as TranslationKey),
      description: t(locale, "meta.ogDescription" as TranslationKey),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getTenant();
  // Audit 7.1 — Resolve locale from request headers instead of hardcoding "fr".
  // The middleware can set x-tenant-locale from the clinic's DB config JSONB.
  // Falls back to "fr" (the Moroccan default) when no header is present.
  const h = await headers();
  const cookieStore = await import("next/headers").then(m => m.cookies());
  const preferredLocale = cookieStore.get("preferred-locale")?.value as Locale;
  const locale: Locale = preferredLocale || (h.get("x-tenant-locale") as Locale) || "fr";
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
          {t(locale, "nav.skipToContent")}
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
