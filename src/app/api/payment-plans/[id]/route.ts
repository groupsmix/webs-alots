import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { paymentPlansTable, paymentPlanInstallmentsTable } from "@/lib/billing-db";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/payment-plans/[id]
 * Fetch a single payment plan with its installments.
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Clinic context required", 403);

  const url = request.nextUrl;
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  // nosemgrep: semgrep.tenant-scoping
  const { data: plan, error } = await paymentPlansTable(supabase)
    .select("*") // nosemgrep: semgrep.tenant-scoping
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (error || !plan) return apiNotFound("Payment plan not found");

  // nosemgrep: semgrep.tenant-scoping
  const { data: installments } = await paymentPlanInstallmentsTable(supabase)
    .select("*") // nosemgrep: semgrep.tenant-scoping
    .eq("plan_id", id)
    .eq("clinic_id", clinicId)
    .order("installment_number", { ascending: true });

  return apiSuccess({ plan, installments: installments ?? [] });
}, STAFF_ROLES);

/**
 * DELETE /api/payment-plans/[id]
 * Cancel a payment plan.
 */
export const DELETE = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Clinic context required", 403);

  const url = request.nextUrl;
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  // nosemgrep: semgrep.tenant-scoping
  const { data: plan, error: fetchError } = await paymentPlansTable(supabase)
    .select("id, status") // nosemgrep: semgrep.tenant-scoping
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (fetchError || !plan) return apiNotFound("Payment plan not found");

  if (plan.status === "completed") {
    return apiError("Cannot cancel a completed plan", 400);
  }

  const now = new Date().toISOString();

  // nosemgrep: semgrep.tenant-scoping
  const { error: planError } = await paymentPlansTable(supabase)
    .update({ status: "cancelled", updated_at: now })
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (planError) {
    logger.error("Failed to cancel payment plan", {
      context: "payment-plans/cancel",
      error: planError,
    });
    return apiError("Failed to cancel payment plan", 500);
  }

  // nosemgrep: semgrep.tenant-scoping
  const { error: installError } = await paymentPlanInstallmentsTable(supabase)
    .update({ status: "cancelled", updated_at: now })
    .eq("plan_id", id)
    .eq("clinic_id", clinicId)
    .eq("status", "pending");

  if (installError) {
    logger.error("Failed to cancel installments", {
      context: "payment-plans/cancel-installments",
      error: installError,
    });
  }

  await logAuditEvent({
    supabase,
    action: "payment_plan.cancelled",
    type: "payment",
    clinicId,
    actor: profile.id,
    description: `Payment plan ${id} cancelled`,
    metadata: { plan_id: id },
  });

  return apiSuccess({ cancelled: true });
}, STAFF_ROLES);
