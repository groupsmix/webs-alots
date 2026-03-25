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
        allow: ["/", "/about", "/services", "/contact", "/book", "/reviews", "/blog", "/location", "/how-to-book", "/testimonials"],
        disallow: ["/admin/", "/super-admin/", "/doctor/", "/patient/", "/receptionist/", "/pharmacist/", "/api/", "/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
