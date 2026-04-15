import type { MetadataRoute } from "next";
import { getCurrentSite } from "@/lib/site-context";
import { listPublishedContent } from "@/lib/dal/content";
import { listCategories } from "@/lib/dal/categories";
import { listActiveProducts } from "@/lib/dal/products";
import { logger } from "@/lib/logger";

const MAX_CONTENT_URLS = 5_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let site;
  try {
    site = await getCurrentSite();
  } catch (err) {
    logger.warn("Sitemap: failed to resolve site, returning empty sitemap", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  const baseUrl = `https://${site.domain}`;

  const staticEntries: MetadataRoute.Sitemap = site.seo.sitemapStaticPages.map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency as MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: page.priority,
  }));

  let dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const [content, categories, products] = await Promise.all([
      listPublishedContent(site.id, undefined, MAX_CONTENT_URLS),
      listCategories(site.id),
      listActiveProducts(site.id),
    ]);

    const contentEntries: MetadataRoute.Sitemap = content.map((item) => ({
      url: `${baseUrl}/${item.type}/${item.slug}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
      url: `${baseUrl}/category/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
      url: `${baseUrl}/products/${product.slug}`,
      lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    dynamicEntries = [...contentEntries, ...categoryEntries, ...productEntries];
  } catch (err) {
    logger.warn("Sitemap: failed to fetch dynamic entries, returning static pages only", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return [...staticEntries, ...dynamicEntries];
}
