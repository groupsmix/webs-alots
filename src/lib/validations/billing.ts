import { z } from "zod";

// ── Invoice Schemas ──

const invoiceLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().max(9999),
  unit_price_centimes: z.number().int().nonnegative(),
  service_id: z.string().uuid().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const invoiceCreateSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  tax_rate: z.number().nonnegative().max(100).optional(),
  discount_centimes: z.number().int().nonnegative().optional(),
  payment_method: z.enum(["cash", "card", "cmi", "insurance", "bank_transfer"]).optional(),
  insurance_type: z.enum(["CNSS", "CNOPS", "CMIM", "AMO", "RAMED"]).optional(),
  insurance_ref: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  line_items: z.array(invoiceLineItemSchema).min(1).max(50),
});

export const invoiceUpdateSchema = z.object({
  status: z
    .enum(["draft", "sent", "paid", "partially_paid", "overdue", "cancelled", "refunded"])
    .optional(),
  tax_rate: z.number().nonnegative().max(100).optional(),
  discount_centimes: z.number().int().nonnegative().optional(),
  payment_method: z.enum(["cash", "card", "cmi", "insurance", "bank_transfer"]).optional(),
  insurance_type: z.enum(["CNSS", "CNOPS", "CMIM", "AMO", "RAMED"]).optional(),
  insurance_ref: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  amount_paid_centimes: z.number().int().nonnegative().optional(),
});

// ── Payment Plan Schemas ──

export const paymentPlanCreateSchema = z.object({
  invoice_id: z.string().uuid(),
  num_installments: z.number().int().min(2).max(24),
  frequency: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  notes: z.string().max(2000).optional(),
});

export const installmentUpdateSchema = z.object({
  status: z.enum(["pending", "paid", "overdue", "cancelled"]),
  payment_method: z.enum(["cash", "card", "cmi", "insurance", "bank_transfer"]).optional(),
  notes: z.string().max(2000).optional(),
});

// ── Reminder Schemas ──

export const reminderSendSchema = z.object({
  invoice_id: z.string().uuid().optional(),
  installment_id: z.string().uuid().optional(),
  reminder_type: z.enum([
    "overdue_3d",
    "overdue_7d",
    "overdue_14d",
    "installment_upcoming",
    "installment_overdue",
  ]),
});

// ── Financial Summary Schemas ──

export const financialSummaryQuerySchema = z.object({
  period: z.enum(["week", "month", "quarter", "year"]).optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
});

// ── AI Revenue Insights Schema ──

export const revenueInsightsQuerySchema = z.object({
  question: z.string().min(1).max(500),
});

// ── Insurance Co-Pay Schema ──

export const insuranceCoPaySchema = z.object({
  total_amount: z.number().positive(),
  policy_number: z.string().min(1).max(100),
  insurance_type: z.enum(["CNSS", "CNOPS", "CMIM", "AMO", "RAMED", "private", "none"]),
});
