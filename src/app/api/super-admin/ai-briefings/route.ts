/**
 * GET /api/super-admin/ai-briefings
 *
 * Retrieve AI-generated clinic briefings for the super admin dashboard.
 * Supports optional ?clinicId= filter and ?date= (YYYY-MM-DD) filter.
 *
 * OWASP A01: withAuth restricts to super_admin only.
 * OWASP A04: No clinic_id filter needed for super_admin (cross-tenant read).
 * OWASP A03: URL query params validated via Zod before use.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// OWASP A03: Validate URL params with Zod
const querySchema = z.object({
  clinicId: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const { supabase } = auth;
    const { searchParams } = new URL(request.url);

    // OWASP A03: Validate and sanitize URL query parameters
    const parseResult = querySchema.safeParse({
      clinicId: searchParams.get("clinicId") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parseResult.success) {
      return apiError(
        parseResult.error.issues.map((i) => i.message).join("; "),
        400,
        "INVALID_PARAMS",
      );
    }

    const { clinicId, date, limit } = parseResult.data;

    try {
      // Super admin reads all briefings — using admin supabase client bypasses RLS
      // OWASP A04: Super admin is explicitly authorized via withAuth(["super_admin"])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("clinic_ai_briefings")
        .select(
          `
          id,
          clinic_id,
          briefing_date,
          content,
          overall_sentiment,
          ai_model,
          generated_at,
          clinics ( name )
        `,
        )
        .order("generated_at", { ascending: false })
        .limit(limit);

      // Apply optional filters
      if (clinicId) {
        query = query.eq("clinic_id", clinicId);
      }
      if (date) {
        query = query.eq("briefing_date", date);
      }

      const { data: briefings, error } = await query;

      if (error) {
        logger.error("Failed to fetch AI briefings", {
          context: "api/super-admin/ai-briefings",
          error,
        });
        return apiError("Erreur lors de la récupération des briefings", 500, "DB_ERROR");
      }

      return apiSuccess({ briefings: briefings ?? [], count: briefings?.length ?? 0 });
    } catch (err) {
      logger.error("AI briefings fetch failed unexpectedly", {
        context: "api/super-admin/ai-briefings",
        error: err instanceof Error ? err.message : String(err),
      });
      return apiError("Erreur interne du serveur", 500, "INTERNAL_ERROR");
    }
  },
  ["super_admin"],
);
