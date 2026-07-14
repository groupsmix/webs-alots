import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { feedbackCreateSchema } from "@/lib/validations/feedback";
import { withAuth, type AuthContext } from "@/lib/with-auth";

/**
 * POST /api/feedback
 * Submit in-app product feedback from any authenticated role. The submitter's
 * role and clinic are taken from the authenticated profile — never trusted from
 * the request body — and surfaced to super_admins as product feedback.
 */
export const POST = withAuthValidation(
  feedbackCreateSchema,
  async (data, _request: NextRequest, auth: AuthContext) => {
    const { error: insertError, data: feedback } = await auth.supabase
      .from("app_feedback")
      .insert({
        clinic_id: auth.profile.clinic_id,
        user_id: auth.profile.id,
        role: auth.profile.role,
        rating: data.rating ?? null,
        message: data.message,
        page_url: data.page_url ?? null,
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      logger.error("Failed to submit feedback", {
        context: "feedback",
        error: insertError,
        role: auth.profile.role,
      });
      return apiError("Failed to submit feedback", 500, "INTERNAL_ERROR");
    }

    if (auth.profile.clinic_id) {
      void logAuditEvent({
        supabase: auth.supabase,
        action: "app_feedback_submitted",
        type: "admin",
        clinicId: auth.profile.clinic_id,
        actor: auth.profile.id,
        description: "In-app product feedback submitted",
        metadata: { feedbackId: feedback?.id, rating: data.rating ?? null },
      });
    }

    return apiSuccess({ id: feedback?.id });
  },
  null,
);

/**
 * GET /api/feedback
 * Super-admin only: list product feedback across all tenants (RLS enforces the
 * super_admin-only cross-tenant read).
 */
export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("per_page") ?? "50", 10) || 50),
    );
    const offset = (page - 1) * perPage;

    let query = auth.supabase
      .from("app_feedback")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to fetch feedback", { context: "feedback", error });
      return apiError("Failed to fetch feedback", 500, "INTERNAL_ERROR");
    }

    return apiSuccess({
      feedback: data ?? [],
      pagination: { page, per_page: perPage, total: count ?? 0 },
    });
  },
  ["super_admin"],
);
