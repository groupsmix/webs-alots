import type { MetadataRoute } from "next";

/**
 * Robots.txt configuration.
 * Next.js serves this at /robots.txt automatically.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/services", "/contact", "/book", "/reviews", "/blog", "/blog/", "/location", "/how-to-book", "/testimonials"],
        // Audit 7.5 — disallow annuaire management/edit routes from crawling
        disallow: ["/admin/", "/super-admin/", "/doctor/", "/patient/", "/receptionist/", "/pharmacist/", "/api/", "/auth/", "/annuaire/manage/", "/annuaire/edit/", "/annuaire/admin/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
