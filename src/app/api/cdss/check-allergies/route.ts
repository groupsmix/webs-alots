/**
 * POST /api/cdss/check-allergies
 *
 * CDSS allergy interaction checker. Cross-references prescribed drugs
 * against patient's documented allergies, including cross-reactivity
 * between related drug classes.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { checkAllergies } from "@/lib/cdss";
import type { PatientAllergy } from "@/lib/cdss";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const allergyCheckSchema = z.object({
  drugs: z.array(z.string().min(1)).min(1).max(20),
  allergies: z.array(
    z.object({
      allergen: z.string().min(1),
      severity: z.enum(["mild", "moderate", "severe", "anaphylaxis"]),
      notes: z.string().optional(),
    }),
  ),
  patientId: z.string().uuid().optional(),
});

async function handler(req: NextRequest, auth: AuthContext): Promise<NextResponse> {
  const body = await req.json();
  const parsed = allergyCheckSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const { drugs, allergies, patientId } = parsed.data;
  const result = checkAllergies(drugs, allergies as PatientAllergy[]);

  if (patientId && result.hasContraindication) {
    void logAuditEvent({
      supabase: auth.supabase,
      type: "patient",
      action: "cdss_allergy_contraindication",
      clinicId: auth.profile.clinic_id ?? "",
      actor: auth.user.id,
      metadata: {
        patientId,
        drugCount: drugs.length,
        alertCount: result.alerts.length,
      },
    });
  }

  return apiSuccess(result);
}

export const POST = withAuth(handler, ["doctor", "clinic_admin"]);
