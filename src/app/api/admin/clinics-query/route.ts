import { type NextRequest } from "next/server";
import {
  buildApprovedAdminSql,
  getApprovedAdminQueries,
  selectApprovedAdminQuery,
} from "@/lib/ai/owner-analytics";
import { sanitizeUntrustedText } from "@/lib/ai/sanitize";
import { apiError, apiInternalError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import { clinicAnalyticsQuerySchema } from "@/lib/validations/super-admin";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

async function handlePost(request: NextRequest, auth: AuthContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const parsed = clinicAnalyticsQuerySchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError("Invalid request body");
  }

  const question = sanitizeUntrustedText(parsed.data.question);
  const template = selectApprovedAdminQuery(question);

  if (!template) {
    return apiError(
      "Question non reconnue. Essayez une question sur les cliniques à risque, les onboardings bloqués, les alertes critiques ou le backlog support.",
      400,
      "UNSUPPORTED_QUERY",
    );
  }

  if (parsed.data.clinic_id && !template.supportsClinicFilter) {
    return apiValidationError("This query template does not support clinic_id filtering");
  }

  const sql = buildApprovedAdminSql(template, {
    clinicId: parsed.data.clinic_id ?? null,
    limit: parsed.data.limit,
  });

  try {
    const { data, error } = await auth.supabase.rpc(
      "execute_admin_query" as never,
      { p_sql: sql } as never,
    );

    if (error) {
      logger.error("Approved admin query execution failed", {
        context: "clinics-query",
        template: template.id,
        error: error.message,
      });
      return apiInternalError("Failed to run the approved analytics query");
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "approved_admin_query_executed",
      type: "admin",
      clinicId: parsed.data.clinic_id ?? "system",
      actor: auth.profile.id,
      description: `Executed approved analytics query ${template.id}`,
      metadata: {
        template: template.id,
        clinicId: parsed.data.clinic_id ?? null,
        limit: parsed.data.limit ?? null,
      },
    });

    return apiSuccess({
      template: {
        id: template.id,
        title: template.title,
        description: template.description,
      },
      question,
      rows: Array.isArray(data) ? data : [],
      availableQueries: getApprovedAdminQueries().map((query) => ({
        id: query.id,
        title: query.title,
      })),
    });
  } catch (error) {
    logger.error("Clinics query route failed", {
      context: "clinics-query",
      question,
      error,
    });
    return apiInternalError("Failed to process the analytics query");
  }
}

export const POST = withAuth(handlePost, ALLOWED_ROLES);
