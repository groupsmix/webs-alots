import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { getDirectoryDoctors } from "@/lib/data/directory";
import { DIRECTORY_CITIES, TOP_CITY_SPECIALTY_COMBOS } from "@/lib/directory-constants";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";

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
  //
  // At production *runtime*, SUPABASE_SERVICE_ROLE_KEY is guaranteed to exist
  // because enforceEnvValidation() (called from instrumentation.ts) refuses to
  // boot without it. During `next build` prerendering NODE_ENV is "production"
  // but the key may legitimately be absent (CI builds), so we detect that via
  // NEXT_PHASE and skip gracefully.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const isProductionRuntime = process.env.NODE_ENV === "production" && !isBuildPhase;
  const hasServiceRoleKey = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (isProductionRuntime && !hasServiceRoleKey) {
    throw new Error(
      "[sitemap] SUPABASE_SERVICE_ROLE_KEY is required in production for dynamic sitemap generation. " +
      "Set this environment variable or feature-gate this route if service-role access is intentionally unavailable.",
    );
  }

  if (hasServiceRoleKey) {
    try {
      // Use admin client (service role) so the sitemap query works without
      // authentication cookies. Googlebot won't have session cookies, so the
      // cookie-based createClient() would fail silently on RLS-protected tables.
      const supabase = createAdminClient();
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
      if (isProductionRuntime) throw err;
      logger.warn("Failed to fetch clinic subdomains for sitemap", { context: "sitemap", error: err });
    }
  } else {
    logger.info("Skipping dynamic sitemap generation: Supabase credentials missing (expected in dev/build)", { context: "sitemap" });
  }

  // ── Doctor Directory pages ──

  // Directory index
  entries.push({
    url: `${baseUrl}/annuaire`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  });

  // City pages
  for (const city of DIRECTORY_CITIES) {
    entries.push({
      url: `${baseUrl}/annuaire/${city.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // City + specialty combo pages
  for (const combo of TOP_CITY_SPECIALTY_COMBOS) {
    entries.push({
      url: `${baseUrl}/annuaire/${combo.city}/${combo.specialty}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Individual doctor profile pages
  if (hasServiceRoleKey) {
    try {
      const doctors = await getDirectoryDoctors();
      for (const doctor of doctors) {
        entries.push({
          url: `${baseUrl}/annuaire/${doctor.slug}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    } catch (err) {
      if (isProductionRuntime) throw err;
      logger.warn("Failed to fetch directory doctors for sitemap", { context: "sitemap", error: err });
    }
  }

  return entries;
}
