import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * GET /api/nps/doctor-scores?doctorId=...
 *
 * Get NPS scores aggregated per doctor. Optionally filter by a specific doctor.
 * Accessible to clinic_admin and doctor (doctors can only see their own scores).
 */
async function handler(request: NextRequest, auth: AuthContext) {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;
  const doctorId = request.nextUrl.searchParams.get("doctorId");

  if (auth.profile.role === "doctor" && doctorId && doctorId !== auth.profile.id) {
    return apiError("Doctors can only view their own scores", 403, "FORBIDDEN");
  }

  try {
    const supabase = await createTenantClient(clinicId);
    const untypedSupabase = supabase as unknown as SupabaseUntyped;

    let query = untypedSupabase
      .from("nps_surveys")
      .select("doctor_id, score")
      .eq("clinic_id", clinicId)
      .not("score", "is", null);

    if (doctorId) {
      query = query.eq("doctor_id", doctorId);
    } else if (auth.profile.role === "doctor") {
      query = query.eq("doctor_id", auth.profile.id);
    }

    const { data: surveys, error } = await query;

    if (error) {
      logger.error("Failed to fetch NPS scores", {
        context: "api/nps/doctor-scores",
        error,
      });
      return apiInternalError("Failed to fetch NPS scores");
    }

    type SurveyScore = { doctor_id: string; score: number };
    const rows = (surveys ?? []) as SurveyScore[];

    const byDoctor = new Map<
      string,
      { total: number; count: number; promoters: number; detractors: number }
    >();

    for (const row of rows) {
      const existing = byDoctor.get(row.doctor_id) ?? {
        total: 0,
        count: 0,
        promoters: 0,
        detractors: 0,
      };
      existing.total += row.score;
      existing.count += 1;
      if (row.score >= 9) existing.promoters += 1;
      if (row.score <= 6) existing.detractors += 1;
      byDoctor.set(row.doctor_id, existing);
    }

    const scores = Array.from(byDoctor.entries()).map(([id, stats]) => ({
      doctorId: id,
      averageScore: Math.round((stats.total / stats.count) * 10) / 10,
      npsScore: Math.round(((stats.promoters - stats.detractors) / stats.count) * 100),
      totalResponses: stats.count,
      promoters: stats.promoters,
      detractors: stats.detractors,
      passives: stats.count - stats.promoters - stats.detractors,
    }));

    return apiSuccess({ scores });
  } catch (err) {
    logger.error("Failed to fetch NPS scores", {
      context: "api/nps/doctor-scores",
      error: err,
    });
    return apiInternalError("Failed to fetch NPS scores");
  }
}

export const GET = withAuth(handler, ["clinic_admin", "doctor"]);
