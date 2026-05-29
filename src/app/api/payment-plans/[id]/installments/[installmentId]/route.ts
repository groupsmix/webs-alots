import { apiSuccess, apiError, apiNotFound } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { paymentPlansTable, paymentPlanInstallmentsTable, invoicesTable } from "@/lib/billing-db";
import { logger } from "@/lib/logger";
import { installmentUpdateSchema } from "@/lib/validations/billing";

/**
 * PATCH /api/payment-plans/[id]/installments/[installmentId]
 * Update an installment status (e.g. mark as paid).
 */
export const PATCH = withAuthValidation(
  installmentUpdateSchema,
  async (body, request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Clinic context required", 403);

    const url = request.nextUrl;
    const segments = url.pathname.split("/");
    const planId = segments[segments.indexOf("payment-plans") + 1];
    const installmentId = segments[segments.length - 1];

    // nosemgrep: semgrep.tenant-scoping
    const { data: plan, error: planError } = await paymentPlansTable(supabase)
      .select("id, invoice_id, status") // nosemgrep: semgrep.tenant-scoping
      .eq("id", planId)
      .eq("clinic_id", clinicId)
      .single();

    if (planError || !plan) return apiNotFound("Payment plan not found");

    const { status, payment_method, notes } = body;

    const updateFields: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (payment_method !== undefined) updateFields.payment_method = payment_method;
    if (notes !== undefined) updateFields.notes = notes;
    if (status === "paid") updateFields.paid_at = new Date().toISOString();

    // nosemgrep: semgrep.tenant-scoping
    const { data: updated, error: updateError } = await paymentPlanInstallmentsTable(supabase)
      .update(updateFields)
      .eq("id", installmentId)
      .eq("plan_id", planId)
      .eq("clinic_id", clinicId)
      .select() // nosemgrep: semgrep.tenant-scoping
      .single();

    if (updateError) {
      logger.error("Failed to update installment", {
        context: "installments/update",
        error: updateError,
      });
      return apiError("Failed to update installment", 500);
    }
    if (!updated) return apiNotFound("Installment not found");

    if (status === "paid") {
      // nosemgrep: semgrep.tenant-scoping
      const { count: pendingCount } = await paymentPlanInstallmentsTable(supabase)
        .select("id", { count: "exact", head: true }) // nosemgrep: semgrep.tenant-scoping
        .eq("plan_id", planId)
        .eq("clinic_id", clinicId)
        .in("status", ["pending", "overdue"]);

      if (pendingCount === 0) {
        // nosemgrep: semgrep.tenant-scoping
        await paymentPlansTable(supabase)
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", planId)
          .eq("clinic_id", clinicId);
      }

      // nosemgrep: semgrep.tenant-scoping
      const { data: paidInstallments } = await paymentPlanInstallmentsTable(supabase)
        .select("amount_centimes") // nosemgrep: semgrep.tenant-scoping
        .eq("plan_id", planId)
        .eq("clinic_id", clinicId)
        .eq("status", "paid");

      if (paidInstallments) {
        const totalPaid = paidInstallments.reduce(
          (sum: number, inst: { amount_centimes: number }) => sum + inst.amount_centimes,
          0,
        );
        // nosemgrep: semgrep.tenant-scoping
        await invoicesTable(supabase)
          .update({
            amount_paid_centimes: totalPaid,
            status: pendingCount === 0 ? "paid" : "partially_paid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", plan.invoice_id)
          .eq("clinic_id", clinicId);
      }
    }

    await logAuditEvent({
      supabase,
      action: "installment.updated",
      type: "payment",
      clinicId,
      actor: profile.id,
      description: `Installment ${installmentId} marked as ${status}`,
      metadata: { installment_id: installmentId, plan_id: planId, status },
    });

    return apiSuccess({ installment: updated });
  },
  STAFF_ROLES,
);
