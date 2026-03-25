import type { MetadataRoute } from "next";

/**
 * Dynamic sitemap for public-facing pages.
 * Next.js serves this at /sitemap.xml automatically.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com";

  const staticPages = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/services", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/contact", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/book", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/reviews", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/how-to-book", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/location", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/testimonials", priority: 0.6, changeFrequency: "weekly" as const },
  ];

  return staticPages.map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: new Date("2026-03-23"),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
