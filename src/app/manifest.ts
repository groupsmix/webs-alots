import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getDirection, type Locale } from "@/lib/i18n";

/**
 * Web App Manifest for PWA support.
 * Next.js serves this at /manifest.webmanifest automatically.
 *
 * Audit 7.8 — lang and dir are now resolved dynamically from the
 * x-tenant-locale request header instead of being hardcoded to "fr" / "ltr".
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";
  const dir = getDirection(locale);

  return {
    name: "Oltigo — Gestion Médicale",
    short_name: "Oltigo",
    description:
      "Plateforme SaaS multi-tenant pour la gestion de cabinets médicaux, dentaires et pharmacies au Maroc.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    categories: ["health", "medical", "business"],
    lang: locale,
    dir,
    prefer_related_applications: false,
    icons: [
      {
        src: "/favicon.ico",
        sizes: "64x64",
        type: "image/x-icon",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Prendre rendez-vous",
        short_name: "RDV",
        url: "/book",
        description: "Réserver un rendez-vous médical en ligne",
      },
      {
        name: "Nos services",
        short_name: "Services",
        url: "/services",
        description: "Voir les services disponibles",
      },
      {
        name: "Contact",
        short_name: "Contact",
        url: "/contact",
        description: "Nous contacter",
      },
    ],
  };
}
