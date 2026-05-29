import { z } from "zod";

// ── Expense Categories ──

export const expenseCategoryCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum([
    "rent",
    "supplies",
    "salaries",
    "equipment",
    "marketing",
    "utilities",
    "insurance",
    "maintenance",
    "operational",
    "other",
  ]),
  description: z.string().max(500).optional(),
});

export const expenseCategoryUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  type: z
    .enum([
      "rent",
      "supplies",
      "salaries",
      "equipment",
      "marketing",
      "utilities",
      "insurance",
      "maintenance",
      "operational",
      "other",
    ])
    .optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
});

// ── Expenses ──

export const expenseCreateSchema = z.object({
  category_id: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  amount: z.number().int().nonnegative(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_recurring: z.boolean().optional(),
  recurring_interval: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  notes: z.string().max(1000).optional(),
});

export const expenseUpdateSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.number().int().nonnegative().optional(),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  is_recurring: z.boolean().optional(),
  recurring_interval: z.enum(["monthly", "quarterly", "yearly"]).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// ── Marketing Campaigns ──

export const campaignCreateSchema = z.object({
  name: z.string().min(1).max(200),
  channel: z.enum([
    "whatsapp",
    "google",
    "facebook",
    "instagram",
    "referral",
    "seo",
    "offline",
    "other",
  ]),
  budget: z.number().int().nonnegative(),
  spend: z.number().int().nonnegative().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  notes: z.string().max(1000).optional(),
});

export const campaignUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  channel: z
    .enum(["whatsapp", "google", "facebook", "instagram", "referral", "seo", "offline", "other"])
    .optional(),
  budget: z.number().int().nonnegative().optional(),
  spend: z.number().int().nonnegative().optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// ── Patient Acquisition ──

export const patientAcquisitionCreateSchema = z.object({
  patient_id: z.string().uuid(),
  channel: z.enum([
    "whatsapp",
    "google",
    "facebook",
    "instagram",
    "referral",
    "walk_in",
    "website",
    "other",
  ]),
  campaign_id: z.string().uuid().optional(),
  referral_source: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

// ── Insurance Claims ──

export const insuranceClaimCreateSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid().optional(),
  appointment_id: z.string().uuid().optional(),
  insurance_type: z.enum(["CNSS", "CNOPS", "AMO", "RAMED", "private"]),
  policy_number: z.string().max(100).optional(),
  amount_claimed: z.number().int().nonnegative(),
  diagnosis_code: z.string().max(50).optional(),
  treatment_description: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
});

export const insuranceClaimUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z
    .enum([
      "draft",
      "submitted",
      "pending",
      "approved",
      "partially_approved",
      "rejected",
      "appealed",
    ])
    .optional(),
  amount_approved: z.number().int().nonnegative().optional(),
  claim_number: z.string().max(100).optional(),
  rejection_reason: z.string().max(1000).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// ── Revenue per Doctor query ──

export const revenueQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "12m"]).optional(),
});
