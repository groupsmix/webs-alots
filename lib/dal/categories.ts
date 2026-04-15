import { getServiceClient, getAnonClient } from "@/lib/supabase-server";
import type { CategoryRow, TaxonomyType } from "@/types/database";
import { assertRows, assertRow, rowOrNull, hasStringProp } from "./type-guards";

const TABLE = "categories";

/** Columns that exist in all schema versions */
const BASE_COLUMNS = "id, site_id, name, slug, taxonomy_type, created_at" as const;

/** List all categories for a site, ordered by name */
export async function listCategories(siteId: string): Promise<CategoryRow[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(BASE_COLUMNS)
    .eq("site_id", siteId)
    .order("name", { ascending: true });

  if (error) throw error;
  return assertRows<CategoryRow>(data);
}

/** List categories for a site filtered by taxonomy type */
export async function listCategoriesByTaxonomy(
  siteId: string,
  taxonomyType: TaxonomyType,
): Promise<CategoryRow[]> {
  const sb = getAnonClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(BASE_COLUMNS)
    .eq("site_id", siteId)
    .eq("taxonomy_type", taxonomyType)
    .order("name", { ascending: true });

  if (error) throw error;
  return assertRows<CategoryRow>(data);
}

/** Get a single category by id */
export async function getCategoryById(siteId: string, id: string): Promise<CategoryRow | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(BASE_COLUMNS)
    .eq("site_id", siteId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return rowOrNull<CategoryRow>(data);
}

/** Get a single category by slug */
export async function getCategoryBySlug(siteId: string, slug: string): Promise<CategoryRow | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select(BASE_COLUMNS)
    .eq("site_id", siteId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return rowOrNull<CategoryRow>(data);
}

/** List categories with product counts, sorted by product count descending */
export async function listCategoriesWithProductCount(
  siteId: string,
  taxonomyType?: TaxonomyType,
  limit = 20,
): Promise<(CategoryRow & { product_count: number })[]> {
  const sb = getServiceClient();
  let query = sb.from(TABLE).select(BASE_COLUMNS).eq("site_id", siteId);

  if (taxonomyType) {
    query = query.eq("taxonomy_type", taxonomyType);
  }

  const { data, error } = await query;

  if (error) throw error;
  const categories = assertRows<CategoryRow>(data);

  const categoriesWithCount = await Promise.all(
    categories.map(async (cat) => {
      const { count } = await sb
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("site_id", siteId)
        .eq("category_id", cat.id)
        .eq("status", "active");

      return { ...cat, product_count: count ?? 0 };
    }),
  );

  return categoriesWithCount.sort((a, b) => b.product_count - a.product_count).slice(0, limit);
}
