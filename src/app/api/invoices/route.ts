import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { invoicesTable, invoiceLineItemsTable } from "@/lib/billing-db";
import { logger } from "@/lib/logger";
import { invoiceCreateSchema } from "@/lib/validations/billing";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/invoices
 * List invoices for the current clinic. Supports ?status=... &patient_id=... &page=... &limit=...
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Clinic context required", 403);

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const patientId = url.searchParams.get("patient_id");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  // nosemgrep: semgrep.tenant-scoping
  let query = invoicesTable(supabase)
    .select("*", { count: "exact" }) // nosemgrep: semgrep.tenant-scoping
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error, count } = await query;
  if (error) {
    logger.error("Failed to list invoices", { context: "invoices/list", error });
    return apiError("Failed to list invoices", 500);
  }

  return apiSuccess({ invoices: data, total: count ?? 0, page, limit });
}, STAFF_ROLES);

/**
 * POST /api/invoices
 * Create a new invoice with line items.
 */
export const POST = withAuthValidation(
  invoiceCreateSchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Clinic context required", 403);

    const {
      patient_id,
      appointment_id,
      tax_rate,
      discount_centimes,
      payment_method,
      insurance_type,
      insurance_ref,
      notes,
      due_date,
      line_items,
    } = body;

    const lineItemsWithTotals = line_items.map((item, idx) => ({
      ...item,
      total_centimes: item.quantity * item.unit_price_centimes,
      sort_order: item.sort_order ?? idx,
    }));

    const subtotal = lineItemsWithTotals.reduce((sum, item) => sum + item.total_centimes, 0);
    const taxRate = tax_rate ?? 0;
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const discount = discount_centimes ?? 0;
    const total = subtotal + taxAmount - discount;

    // Generate invoice number: INV-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");

    // nosemgrep: semgrep.tenant-scoping
    const { count: existingCount } = await invoicesTable(supabase)
      .select("id", { count: "exact", head: true }) // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId);

    const seqNum = ((existingCount ?? 0) + 1).toString().padStart(4, "0");
    const invoiceNumber = `INV-${dateStr}-${seqNum}`;

    // nosemgrep: semgrep.tenant-scoping
    const { data: invoice, error: invoiceError } = await invoicesTable(supabase)
      .insert({
        clinic_id: clinicId,
        patient_id,
        appointment_id: appointment_id ?? null,
        invoice_number: invoiceNumber,
        status: "draft",
        subtotal_centimes: subtotal,
        tax_rate: taxRate,
        tax_amount_centimes: taxAmount,
        discount_centimes: discount,
        total_centimes: total,
        amount_paid_centimes: 0,
        currency: "MAD",
        payment_method: payment_method ?? null,
        insurance_type: insurance_type ?? null,
        insurance_ref: insurance_ref ?? null,
        notes: notes ?? null,
        due_date: due_date ?? null,
        created_by: profile.id,
      })
      .select() // nosemgrep: semgrep.tenant-scoping
      .single();

    if (invoiceError) {
      logger.error("Failed to create invoice", { context: "invoices/create", error: invoiceError });
      return apiError("Failed to create invoice", 500);
    }

    const lineItemRows = lineItemsWithTotals.map((item) => ({
      clinic_id: clinicId,
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price_centimes: item.unit_price_centimes,
      total_centimes: item.total_centimes,
      service_id: item.service_id ?? null,
      sort_order: item.sort_order,
    }));

    // nosemgrep: semgrep.tenant-scoping
    const { error: lineItemsError } = await invoiceLineItemsTable(supabase).insert(lineItemRows);

    if (lineItemsError) {
      logger.error("Failed to create line items", {
        context: "invoices/create-line-items",
        error: lineItemsError,
      });
      return apiError("Failed to create invoice line items", 500);
    }

    await logAuditEvent({
      supabase,
      action: "invoice.created",
      type: "payment",
      clinicId,
      actor: profile.id,
      description: `Invoice ${invoiceNumber} created for patient ${patient_id}`,
      metadata: { invoice_id: invoice.id, total_centimes: total },
    });

    return apiSuccess({ invoice }, 201);
  },
  STAFF_ROLES,
);
