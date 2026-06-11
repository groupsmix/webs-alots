import type { Metadata, Viewport } from "next";
import {
  Inter,
  JetBrains_Mono,
  IBM_Plex_Sans_Arabic,
  Noto_Sans_Arabic,
  Playfair_Display,
} from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { ConsentGatedReplay } from "@/components/consent-gated-replay";
import { CookieConsent } from "@/components/cookie-consent";
import { MaskingBuildSentinel } from "@/components/masking-build-sentinel";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { PlausibleScript } from "@/components/plausible-script";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { TenantProvider } from "@/components/tenant-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { t, isSupportedLocale, type Locale, type TranslationKey } from "@/lib/i18n";
import { getTenant, getLocaleFromTenant, getDirFromLocale } from "@/lib/tenant";

// Editorial typography: Inter for UI/body, JetBrains Mono for metadata/labels.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f0e" },
  ],
};

/**
 * SEO-01: Locale-aware metadata via i18n instead of hardcoded French.
 *
 * Resolution order: x-tenant-locale header (set by middleware from clinic
 * config) > preferred-locale cookie (user preference) > "fr" default.
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  // An explicit ?lang override (set by middleware as x-locale) wins so the
  // crawlable hreflang URL (?lang=ar) gets matching og:locale / canonical.
  const explicitLocale = h.get("x-locale");
  const tenantLocale = h.get("x-tenant-locale") as Locale | null;
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const preferredLocale = cookieStore.get("preferred-locale")?.value as Locale;
  const locale =
    (isSupportedLocale(explicitLocale) ? explicitLocale : null) ||
    tenantLocale ||
    preferredLocale ||
    ("fr" as Locale);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com";

  return {
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
        "x-default": siteUrl,
        fr: siteUrl,
        ar: `${siteUrl}?lang=ar`,
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
  // TASK-018: Derive locale + dir from tenant using canonical helpers.
  // Priority: explicit ?lang override (x-locale, set by middleware) > cookie
  // preference > tenant default. The ?lang override is what makes the
  // hreflang-advertised Arabic URL (?lang=ar) actually render <html dir="rtl">
  // — without it, the publicly-cached page can only ever serve the French
  // default since the cache key does not vary on the preferred-locale cookie.
  const headerStore = await headers();
  const explicitLocale = headerStore.get("x-locale");
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const preferredLocale = cookieStore.get("preferred-locale")?.value as Locale | undefined;
  const tenantLocale = getLocaleFromTenant(tenant) as Locale;
  const locale: Locale =
    (isSupportedLocale(explicitLocale) ? explicitLocale : undefined) ||
    preferredLocale ||
    tenantLocale;
  const dir = getDirFromLocale(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${notoSansArabic.variable} ${playfairDisplay.variable} ${ibmPlexArabic.variable} h-full antialiased`}
    >
      <head>
        {/* PERF-005: Preconnect to Supabase to shave ~100ms off first SSR fetch */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
      </head>
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
            <TenantProvider tenant={tenant}>{children}</TenantProvider>
            <OfflineIndicator />
            {process.env.NEXT_PUBLIC_ENABLE_PERF_MONITORING === "true" && <PerformanceMonitor />}
          </ToastProvider>
        </ThemeProvider>
        {/*
          A69-F1: Cookie / consent banner on ALL pages (public + authenticated).
          The CookieConsent component shows only when no prior choice is stored
          in localStorage, so authenticated users who already accepted are
          unaffected. This satisfies ePrivacy Directive + GDPR Art.7 for any
          EU visitor that lands on a public page.
        */}
        <CookieConsent />
        {/*
          A69-F2: Gate Sentry Replay on session-recording consent.
          Only enables Sentry's Replay integration after the user explicitly
          accepts the "marketing" (session recording) consent category.
          On public pages this was previously firing unconditionally.
        */}
        <ConsentGatedReplay />
        <ServiceWorkerRegister />
        <PlausibleScript />
        {/*
          Audit 2026-06-09 Task 2: invisible sentinel that embeds the
          build-time NEXT_PUBLIC_DATA_MASKING value in the client bundle so
          the post-deploy smoke test can verify PHI masking was baked in.
        */}
        <MaskingBuildSentinel />
      </body>
    </html>
  );
}
