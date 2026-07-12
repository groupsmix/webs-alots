import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import {
  computeInsurancePartialPayment,
  transitionInvoiceStatus,
  type InvoiceState,
  type InvoiceStatus,
} from "@/lib/billing/invoice-state-machine";
import { invoicesTable, invoiceLineItemsTable } from "@/lib/billing-db";
import { logger } from "@/lib/logger";
import { invoiceUpdateSchema } from "@/lib/validations/billing";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/invoices/[id]
 * Fetch a single invoice with its line items.
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Clinic context required", 403);

  const url = request.nextUrl;
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  // nosemgrep: semgrep.tenant-scoping
  const { data: invoice, error } = await invoicesTable(supabase)
    .select("*") // nosemgrep: semgrep.tenant-scoping
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (error || !invoice) return apiNotFound("Invoice not found");

  // nosemgrep: semgrep.tenant-scoping
  const { data: lineItems } = await invoiceLineItemsTable(supabase)
    .select("*") // nosemgrep: semgrep.tenant-scoping
    .eq("invoice_id", id)
    .eq("clinic_id", clinicId)
    .order("sort_order", { ascending: true });

  return apiSuccess({ invoice, line_items: lineItems ?? [] });
}, STAFF_ROLES);

/**
 * PATCH /api/invoices/[id]
 * Update invoice status, payment info, etc.
 */
export const PATCH = withAuthValidation(
  invoiceUpdateSchema,
  async (body, request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Clinic context required", 403);

    const url = request.nextUrl;
    const segments = url.pathname.split("/");
    const id = segments[segments.length - 1];

    // nosemgrep: semgrep.tenant-scoping
    const { data: existing, error: fetchError } = await invoicesTable(supabase)
      .select(
        "id, status, invoice_number, total_centimes, amount_paid_centimes, payment_method, insurance_type, insurance_ref", // nosemgrep: semgrep.tenant-scoping
      )
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !existing) return apiNotFound("Invoice not found");

    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.tax_rate !== undefined) updateFields.tax_rate = body.tax_rate;
    if (body.discount_centimes !== undefined)
      updateFields.discount_centimes = body.discount_centimes;
    if (body.payment_method !== undefined) updateFields.payment_method = body.payment_method;
    if (body.insurance_type !== undefined) updateFields.insurance_type = body.insurance_type;
    if (body.insurance_ref !== undefined) updateFields.insurance_ref = body.insurance_ref;
    if (body.notes !== undefined) updateFields.notes = body.notes;
    if (body.due_date !== undefined) updateFields.due_date = body.due_date;

    let auditEvent: {
      action: string;
      description: string;
      metadata: Record<string, unknown>;
    } | null = null;

    if (body.status !== undefined) {
      const invoiceState: InvoiceState = {
        id: existing.id,
        status: existing.status as InvoiceStatus,
        totalCentimes: existing.total_centimes ?? 0,
        amountPaidCentimes: existing.amount_paid_centimes ?? 0,
        paymentMethod: existing.payment_method ?? null,
        insuranceType: existing.insurance_type ?? null,
        insuranceRef: existing.insurance_ref ?? null,
        invoiceNumber: existing.invoice_number,
        clinicId,
      };

      const transition = transitionInvoiceStatus(invoiceState, {
        targetStatus: body.status,
        amountPaidCentimes: body.amount_paid_centimes,
        policyNumber: body.policy_number,
        actorId: profile.id,
      });

      if (!transition.ok) {
        return apiError(transition.error, 400, transition.code ?? "INVOICE_TRANSITION_ERROR");
      }

      // For insurance-driven partially_paid, compute the patient/insurance split.
      if (
        body.status === "partially_paid" &&
        invoiceState.paymentMethod === "insurance" &&
        invoiceState.insuranceType
      ) {
        const policyNumber = body.policy_number || invoiceState.insuranceRef || "";
        const partialPayment = await computeInsurancePartialPayment(invoiceState, policyNumber);
        Object.assign(updateFields, partialPayment.updateFields);
        auditEvent = partialPayment.audit;
      } else {
        Object.assign(updateFields, transition.result.updateFields);
        auditEvent = transition.result.audit;
      }
    }

    if (
      body.amount_paid_centimes !== undefined &&
      updateFields.amount_paid_centimes === undefined
    ) {
      updateFields.amount_paid_centimes = body.amount_paid_centimes;
    }

    // nosemgrep: semgrep.tenant-scoping
    const { data: updated, error: updateError } = await invoicesTable(supabase)
      .update(updateFields)
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select() // nosemgrep: semgrep.tenant-scoping
      .single();

    if (updateError) {
      logger.error("Failed to update invoice", { context: "invoices/update", error: updateError });
      return apiError("Failed to update invoice", 500);
    }

    if (auditEvent) {
      await logAuditEvent({
        supabase,
        action: auditEvent.action,
        type: "payment",
        clinicId,
        actor: profile.id,
        description: auditEvent.description,
        metadata: { ...auditEvent.metadata, actor_id: profile.id },
      });
    } else {
      await logAuditEvent({
        supabase,
        action: "invoice.updated",
        type: "payment",
        clinicId,
        actor: profile.id,
        description: `Invoice ${existing.invoice_number} updated`,
        metadata: { invoice_id: id, changes: Object.keys(updateFields) },
      });
    }

    return apiSuccess({ invoice: updated });
  },
  STAFF_ROLES,
);

/**
 * DELETE /api/invoices/[id]
 * Soft-delete: sets status to cancelled.
 */
export const DELETE = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Clinic context required", 403);

  const url = request.nextUrl;
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  // nosemgrep: semgrep.tenant-scoping
  const { data: existing, error: fetchError } = await invoicesTable(supabase)
    .select("id, invoice_number, status") // nosemgrep: semgrep.tenant-scoping
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (fetchError || !existing) return apiNotFound("Invoice not found");

  if (existing.status === "paid") {
    return apiError("Cannot cancel a paid invoice", 400, "INVOICE_PAID");
  }

  // nosemgrep: semgrep.tenant-scoping
  const { error: updateError } = await invoicesTable(supabase)
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (updateError) {
    logger.error("Failed to cancel invoice", { context: "invoices/delete", error: updateError });
    return apiError("Failed to cancel invoice", 500);
  }

  await logAuditEvent({
    supabase,
    action: "invoice.cancelled",
    type: "payment",
    clinicId,
    actor: profile.id,
    description: `Invoice ${existing.invoice_number} cancelled`,
    metadata: { invoice_id: id },
  });

  return apiSuccess({ cancelled: true });
}, STAFF_ROLES);
