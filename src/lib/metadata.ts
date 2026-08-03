import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/env";
import type { Locale } from "@/lib/i18n";

const DEFAULT_SITE_URL = "https://oltigo.com";

function getBaseUrl(): string {
  return getSiteUrl() || DEFAULT_SITE_URL;
}

function getOgLocale(locale: Locale): string {
  switch (locale) {
    case "ar":
    case "ary":
      return "ar_MA";
    case "en":
      return "en_US";
    default:
      return "fr_MA";
  }
}

function getAlternateLocales(locale: Locale): string[] {
  switch (locale) {
    case "ar":
    case "ary":
      return ["fr_MA", "en_US"];
    case "en":
      return ["fr_MA", "ar_MA"];
    default:
      return ["ar_MA", "en_US"];
  }
}

function getLanguageUrl(path: string, locale: Locale): string {
  const base = getBaseUrl();
  const url = `${base}${path}`;
  if (locale === "fr") return url;
  return `${url}?lang=${locale}`;
}

export interface BuildMetadataOptions {
  /** Page title without brand suffix; the root title template appends " | Oltigo". */
  title: string;
  description: string;
  /** Root-relative path (e.g. "/about"). */
  path: string;
  locale?: Locale;
  /** Absolute or root-relative image URL. Defaults to /opengraph-image.png. */
  image?: string;
  imageAlt?: string;
  keywords?: string[];
  /** Override NEXT_PUBLIC_SITE_URL for tenant subdomains. */
  siteUrl?: string;
  /** Set true for noindex/nofollow utility pages (nps, checkin, dsar). */
  noIndex?: boolean;
  ogType?: "website" | "article";
}

/**
 * Build consistent SEO metadata for a public page.
 *
 * Returns title, description, canonical, hreflang (fr/ar/en/x-default),
 * Open Graph and Twitter card tags with a default OG image fallback.
 */
export function buildMetadata({
  title,
  description,
  path,
  locale = "fr",
  image,
  imageAlt,
  keywords,
  siteUrl,
  noIndex = false,
  ogType = "website",
}: BuildMetadataOptions): Metadata {
  const baseUrl = siteUrl ?? getBaseUrl();
  const canonical = `${baseUrl}${path}`;
  const rootBaseUrl = getBaseUrl();
  const ogImage = image ?? `${rootBaseUrl}/opengraph-image.png`;

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    robots: noIndex
      ? { index: false, follow: false, nocache: true, noarchive: true }
      : { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        "x-default": canonical,
        fr: getLanguageUrl(path, "fr"),
        ar: getLanguageUrl(path, "ar"),
        en: getLanguageUrl(path, "en"),
      },
    },
    openGraph: {
      type: ogType,
      locale: getOgLocale(locale),
      alternateLocale: getAlternateLocales(locale),
      siteName: "Oltigo",
      title,
      description,
      url: canonical,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 640,
          alt: imageAlt ?? title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
