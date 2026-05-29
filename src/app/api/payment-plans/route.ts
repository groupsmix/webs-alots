import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { invoicesTable, paymentPlansTable, paymentPlanInstallmentsTable } from "@/lib/billing-db";
import { logger } from "@/lib/logger";
import { paymentPlanCreateSchema } from "@/lib/validations/billing";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/payment-plans
 * List payment plans for the current clinic.
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Clinic context required", 403);

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const patientId = url.searchParams.get("patient_id");
  const invoiceId = url.searchParams.get("invoice_id");

  // nosemgrep: semgrep.tenant-scoping
  let query = paymentPlansTable(supabase)
    .select("*", { count: "exact" }) // nosemgrep: semgrep.tenant-scoping
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (patientId) query = query.eq("patient_id", patientId);
  if (invoiceId) query = query.eq("invoice_id", invoiceId);

  const { data, error, count } = await query;
  if (error) {
    logger.error("Failed to list payment plans", { context: "payment-plans/list", error });
    return apiError("Failed to list payment plans", 500);
  }

  return apiSuccess({ payment_plans: data, total: count ?? 0 });
}, STAFF_ROLES);

/**
 * POST /api/payment-plans
 * Create a payment plan with auto-generated installments.
 */
export const POST = withAuthValidation(
  paymentPlanCreateSchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Clinic context required", 403);

    const { invoice_id, num_installments, frequency, start_date, notes } = body;

    // nosemgrep: semgrep.tenant-scoping
    const { data: invoice, error: invoiceError } = await invoicesTable(supabase)
      .select("id, patient_id, total_centimes, amount_paid_centimes, status") // nosemgrep: semgrep.tenant-scoping
      .eq("id", invoice_id)
      .eq("clinic_id", clinicId)
      .single();

    if (invoiceError || !invoice) return apiNotFound("Invoice not found");

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return apiError("Cannot create a plan for a paid or cancelled invoice", 400);
    }

    const remainingAmount = invoice.total_centimes - invoice.amount_paid_centimes;
    if (remainingAmount <= 0) {
      return apiError("Invoice is already fully paid", 400);
    }

    // nosemgrep: semgrep.tenant-scoping
    const { data: plan, error: planError } = await paymentPlansTable(supabase)
      .insert({
        clinic_id: clinicId,
        invoice_id,
        patient_id: invoice.patient_id,
        total_centimes: remainingAmount,
        num_installments,
        frequency: frequency ?? "monthly",
        status: "active",
        start_date,
        notes: notes ?? null,
        created_by: profile.id,
      })
      .select() // nosemgrep: semgrep.tenant-scoping
      .single();

    if (planError) {
      logger.error("Failed to create payment plan", {
        context: "payment-plans/create",
        error: planError,
      });
      return apiError("Failed to create payment plan", 500);
    }

    const installmentAmount = Math.floor(remainingAmount / num_installments);
    const remainder = remainingAmount - installmentAmount * num_installments;
    const freq = frequency ?? "monthly";

    const installments = [];
    for (let i = 0; i < num_installments; i++) {
      const dueDate = computeDueDate(start_date, i, freq);
      installments.push({
        clinic_id: clinicId,
        plan_id: plan.id,
        installment_number: i + 1,
        amount_centimes: installmentAmount + (i === num_installments - 1 ? remainder : 0),
        due_date: dueDate,
        status: "pending",
      });
    }

    // nosemgrep: semgrep.tenant-scoping
    const { data: insertedInstallments, error: installError } = await paymentPlanInstallmentsTable(
      supabase,
    )
      .insert(installments)
      .select(); // nosemgrep: semgrep.tenant-scoping

    if (installError) {
      logger.error("Failed to create installments", {
        context: "payment-plans/create-installments",
        error: installError,
      });
      return apiError("Failed to create installments", 500);
    }

    await logAuditEvent({
      supabase,
      action: "payment_plan.created",
      type: "payment",
      clinicId,
      actor: profile.id,
      description: `Payment plan created for invoice ${invoice_id} with ${num_installments} installments`,
      metadata: {
        plan_id: plan.id,
        invoice_id,
        num_installments,
        total_centimes: remainingAmount,
      },
    });

    return apiSuccess({ plan, installments: insertedInstallments }, 201);
  },
  STAFF_ROLES,
);

function computeDueDate(startDate: string, index: number, frequency: string): string {
  const date = new Date(startDate + "T00:00:00Z");
  switch (frequency) {
    case "weekly":
      date.setUTCDate(date.getUTCDate() + index * 7);
      break;
    case "biweekly":
      date.setUTCDate(date.getUTCDate() + index * 14);
      break;
    case "monthly":
    default:
      date.setUTCMonth(date.getUTCMonth() + index);
      break;
  }
  return date.toISOString().slice(0, 10);
}
