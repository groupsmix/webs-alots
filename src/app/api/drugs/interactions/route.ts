/**
 * POST /api/drugs/interactions
 *
 * Check for potential drug-drug interactions.
 *
 * Body: { drugs: string[] }  — list of drug names (2-10)
 * Returns: { interactions: DrugInteractionResult[] }
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { checkDrugInteractions } from "@/lib/drugs/client";
import { logger } from "@/lib/logger";

const interactionSchema = z.object({
  drugs: z
    .array(z.string().min(1).max(200))
    .min(2, "Au moins 2 médicaments requis")
    .max(10, "Maximum 10 médicaments"),
});

export const POST = withAuthValidation(
  interactionSchema,
  async (body, _request, _auth) => {
    const { drugs } = body;

    const interactions = await checkDrugInteractions(drugs);

    return apiSuccess({
      interactions,
      total: interactions.length,
      checked: drugs.length,
      safe: interactions.length === 0,
    });
  },
  ["super_admin", "clinic_admin", "doctor"],
);
