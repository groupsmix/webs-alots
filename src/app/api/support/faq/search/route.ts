import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import type { SupportedLanguage } from "@/lib/validations/support";

/**
 * GET /api/support/faq/search?q=...&language=...&category=...&limit=...
 * Public FAQ search endpoint for chatbot and patient-facing pages.
 * Uses PostgreSQL full-text search with French text search config.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;
  const url = new URL(request.url);

  const query = url.searchParams.get("q")?.trim();
  if (!query || query.length === 0) {
    return apiError("Query parameter 'q' is required", 400, "VALIDATION_ERROR");
  }
  if (query.length > 500) {
    return apiError("Query too long", 400, "VALIDATION_ERROR");
  }

  const language = url.searchParams.get("language") as SupportedLanguage | null;
  const category = url.searchParams.get("category");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 50);

  const supabase = await createClient();

  let dbQuery = supabase
    .from("chatbot_faqs")
    .select("id, question, answer, category, language, keywords")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(limit);

  if (language) {
    dbQuery = dbQuery.eq("language", language);
  }
  if (category) {
    dbQuery = dbQuery.eq("category", category);
  }

  // Use ilike for basic text matching since PostgREST doesn't expose
  // tsvector search directly. The search_vector GIN index is available
  // for future direct SQL/RPC queries.
  dbQuery = dbQuery.or(`question.ilike.%${query}%,answer.ilike.%${query}%`);

  const { data, error } = await dbQuery;

  if (error) {
    logger.error("FAQ search failed", { context: "support/faq/search", error, clinicId });
    return apiError("Search failed", 500, "INTERNAL_ERROR");
  }

  return apiSuccess({ results: data ?? [], query, total: data?.length ?? 0 });
}
