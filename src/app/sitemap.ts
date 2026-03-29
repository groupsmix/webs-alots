import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase-server";
import { getAllPosts } from "@/lib/blog";

/**
 * Dynamic sitemap for public-facing pages.
 * Next.js serves this at /sitemap.xml automatically.
 *
 * Generates entries for the root domain AND every active clinic subdomain,
 * so Google can discover clinic-specific pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oltigo.com";
  const rootDomain = process.env.ROOT_DOMAIN ?? "oltigo.com";
  const now = new Date();

  // Static pages on the root domain
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
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  const entries: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  // Static blog post pages
  const blogPosts = getAllPosts();
  for (const post of blogPosts) {
    entries.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // Dynamic clinic subdomain pages
  try {
    const supabase = await createClient();
    const { data: clinics } = await supabase
      .from("clinics")
      .select("subdomain, updated_at")
      .eq("status", "active")
      .not("subdomain", "is", null);

    if (clinics) {
      const clinicPublicPages = [
        "/",
        "/services",
        "/about",
        "/book",
        "/reviews",
        "/contact",
      ];

      for (const clinic of clinics) {
        if (!clinic.subdomain) continue;
        const clinicBase = `https://${clinic.subdomain}.${rootDomain}`;
        const modified = clinic.updated_at
          ? new Date(clinic.updated_at)
          : now;

        for (const page of clinicPublicPages) {
          entries.push({
            url: `${clinicBase}${page}`,
            lastModified: modified,
            changeFrequency: "weekly",
            priority: page === "/" ? 0.9 : 0.7,
          });
        }
      }
    }
  } catch (err) {
    // If DB is unavailable, return static entries only
    console.error("[sitemap] Failed to fetch clinic subdomains:", err);
  }

  return entries;
}
