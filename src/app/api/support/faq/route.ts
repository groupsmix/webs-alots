import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import { faqCreateSchema, faqUpdateSchema, faqDeleteSchema } from "@/lib/validations/support";
import { withAuth, type AuthContext } from "@/lib/with-auth";

/**
 * GET /api/support/faq
 * List all FAQs for the current clinic. Supports optional language/category filters.
 */
export const GET = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const url = new URL(request.url);
    const language = url.searchParams.get("language");
    const category = url.searchParams.get("category");

    let query = auth.supabase
      .from("chatbot_faqs")
      .select(
        "id, question, answer, keywords, category, language, sort_order, is_active, created_at, updated_at",
      )
      .eq("clinic_id", clinicId)
      .order("sort_order", { ascending: true });

    if (language) {
      query = query.eq("language", language);
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Failed to fetch FAQs", { context: "support/faq", error, clinicId });
      return apiError("Failed to fetch FAQs", 500, "INTERNAL_ERROR");
    }

    return apiSuccess({ faqs: data ?? [] });
  },
  ["super_admin", "clinic_admin", "receptionist"],
);

/**
 * POST /api/support/faq
 * Create a new FAQ entry.
 */
export const POST = withAuthValidation(
  faqCreateSchema,
  async (data, request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    const { error: insertError, data: faq } = await auth.supabase
      .from("chatbot_faqs")
      .insert({
        clinic_id: clinicId,
        question: data.question,
        answer: data.answer,
        keywords: data.keywords ?? [],
        category: data.category,
        language: data.language,
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to create FAQ", {
        context: "support/faq",
        error: insertError,
        clinicId,
      });
      return apiError("Failed to create FAQ", 500, "INTERNAL_ERROR");
    }

    void logAuditEvent({
      supabase: auth.supabase,
      action: "faq_created",
      type: "config",
      clinicId,
      actor: auth.user.id,
      description: `FAQ created: ${data.question.slice(0, 100)}`,
      metadata: { faqId: faq.id, language: data.language, category: data.category },
    });

    return apiSuccess({ faq }, 201);
  },
  ["super_admin", "clinic_admin"],
);

/**
 * PUT /api/support/faq
 * Update an existing FAQ entry.
 */
export const PUT = withAuthValidation(
  faqUpdateSchema,
  async (data, request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const { id, ...updates } = data;

    const { error: updateError, data: faq } = await auth.supabase
      .from("chatbot_faqs")
      .update({
        question: updates.question,
        answer: updates.answer,
        keywords: updates.keywords,
        category: updates.category,
        language: updates.language,
        sort_order: updates.sort_order,
        is_active: updates.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (updateError) {
      logger.error("Failed to update FAQ", {
        context: "support/faq",
        error: updateError,
        clinicId,
      });
      return apiError("Failed to update FAQ", 500, "INTERNAL_ERROR");
    }

    void logAuditEvent({
      supabase: auth.supabase,
      action: "faq_updated",
      type: "config",
      clinicId,
      actor: auth.user.id,
      description: `FAQ updated: ${id}`,
      metadata: { faqId: id },
    });

    return apiSuccess({ faq });
  },
  ["super_admin", "clinic_admin"],
);

/**
 * DELETE /api/support/faq
 * Delete an FAQ entry.
 */
export const DELETE = withAuthValidation(
  faqDeleteSchema,
  async (data, request: NextRequest, auth: AuthContext) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    const { error: deleteError } = await auth.supabase
      .from("chatbot_faqs")
      .delete()
      .eq("id", data.id)
      .eq("clinic_id", clinicId);

    if (deleteError) {
      logger.error("Failed to delete FAQ", {
        context: "support/faq",
        error: deleteError,
        clinicId,
      });
      return apiError("Failed to delete FAQ", 500, "INTERNAL_ERROR");
    }

    void logAuditEvent({
      supabase: auth.supabase,
      action: "faq_deleted",
      type: "config",
      clinicId,
      actor: auth.user.id,
      description: `FAQ deleted: ${data.id}`,
      metadata: { faqId: data.id },
    });

    return apiSuccess({ deleted: true });
  },
  ["super_admin", "clinic_admin"],
);
