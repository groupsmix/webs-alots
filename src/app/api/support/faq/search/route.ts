import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { sanitizeIlike } from "@/lib/sanitize-ilike";
import { createClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import { faqSearchSchema, safeParse } from "@/lib/validations";

/**
 * GET /api/support/faq/search?q=...&language=...&category=...&limit=...
 * Public FAQ search endpoint for chatbot and patient-facing pages.
 * Uses PostgreSQL full-text search with French text search config.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;
  const url = new URL(request.url);
  const parsedInput = safeParse(faqSearchSchema, {
    query: url.searchParams.get("q")?.trim() || undefined,
    language: url.searchParams.get("language") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsedInput.success) {
    return apiValidationError(parsedInput.error);
  }
  const { query, language, category, limit } = parsedInput.data;

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
  const safeQuery = sanitizeIlike(query);
  if (safeQuery.length > 0) {
    dbQuery = dbQuery.or(`question.ilike.%${safeQuery}%,answer.ilike.%${safeQuery}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    logger.error("FAQ search failed", { context: "support/faq/search", error, clinicId });
    return apiError("Search failed", 500, "INTERNAL_ERROR");
  }

  return apiSuccess({ results: data ?? [], query, total: data?.length ?? 0 });
}
