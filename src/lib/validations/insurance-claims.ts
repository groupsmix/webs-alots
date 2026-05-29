import { z } from "zod";

const claimLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().max(9999),
  unit_price_centimes: z.number().int().nonnegative(),
  category: z.string().max(200).optional(),
});

/** Create an insurance claim — adapted from Health-Pay claim review patterns. */
export const insuranceClaimCreateSchema = z.object({
  patient_id: z.string().uuid(),
  insurance_type: z.enum(["CNSS", "CNOPS", "AMO", "RAMED"]),
  amount_claimed: z.number().int().positive(),
  line_items: z.array(claimLineItemSchema).max(100).optional(),
  notes: z.string().max(5000).optional(),
});

/** Update an insurance claim (review). */
export const insuranceClaimUpdateSchema = z.object({
  status: z
    .enum([
      "draft",
      "submitted",
      "under_review",
      "approved",
      "partially_approved",
      "rejected",
      "appealed",
    ])
    .optional(),
  amount_approved: z.number().int().nonnegative().optional(),
  rejection_reason: z.string().max(2000).optional(),
  reviewer_notes: z.string().max(5000).optional(),
});

/** Query insurance claims. */
export const insuranceClaimQuerySchema = z.object({
  status: z
    .enum([
      "draft",
      "submitted",
      "under_review",
      "approved",
      "partially_approved",
      "rejected",
      "appealed",
    ])
    .optional(),
  insurance_type: z.enum(["CNSS", "CNOPS", "AMO", "RAMED"]).optional(),
  patient_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
