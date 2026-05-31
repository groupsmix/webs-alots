/**
 * POST /api/cdss/check-dose
 *
 * CDSS dose range checker. Validates prescribed doses against reference
 * ranges, accounting for patient age, weight, renal function, and pregnancy.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { checkDose } from "@/lib/cdss";
import type { DoseCheckInput, PatientFactors } from "@/lib/cdss";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const doseCheckSchema = z.object({
  prescriptions: z
    .array(
      z.object({
        drugName: z.string().min(1),
        doseAmount: z.number().positive(),
        doseUnit: z.enum(["mg", "g", "mcg", "ml", "IU"]),
        frequency: z.enum(["od", "bid", "tid", "qid", "stat", "prn"]),
        route: z.enum(["oral", "iv", "im", "sc", "topical", "inhaled"]),
      }),
    )
    .min(1)
    .max(20),
  patient: z.object({
    ageYears: z.number().min(0).max(150),
    weightKg: z.number().positive().optional(),
    creatinineClearanceMl: z.number().min(0).optional(),
    isPregnant: z.boolean().optional(),
  }),
  patientId: z.string().uuid().optional(),
});

async function handler(req: NextRequest, auth: AuthContext): Promise<NextResponse> {
  const body = await req.json();
  const parsed = doseCheckSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const { prescriptions, patient, patientId } = parsed.data;

  const results = prescriptions.map((rx) =>
    checkDose(rx as DoseCheckInput, patient as PatientFactors),
  );

  const hasOverdose = results.some((r) => r.hasOverdose);
  const totalAlerts = results.reduce((sum, r) => sum + r.alerts.length, 0);

  if (patientId && hasOverdose) {
    void logAuditEvent({
      supabase: auth.supabase,
      type: "patient",
      action: "cdss_dose_overdose_alert",
      clinicId: auth.profile.clinic_id ?? "",
      actor: auth.user.id,
      metadata: {
        patientId,
        prescriptionCount: prescriptions.length,
        totalAlerts,
      },
    });
  }

  return apiSuccess({
    results,
    hasOverdose,
    totalAlerts,
    checkedAt: new Date().toISOString(),
  });
}

export const POST = withAuth(handler, ["doctor", "clinic_admin"]);
