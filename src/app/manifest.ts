import type { MetadataRoute } from "next";

/**
 * Web App Manifest for PWA support.
 * Next.js serves this at /manifest.webmanifest automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
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
    lang: "fr",
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
  };
}
