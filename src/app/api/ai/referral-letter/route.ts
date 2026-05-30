import { NextRequest } from "next/server";
import { routeAIRequest, loadProviderConfigs } from "@/lib/ai/router";
import type { AIRequest } from "@/lib/ai/types";
import { apiSuccess, apiError, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

/**
 * POST /api/ai/referral-letter
 *
 * AI-powered referral letter generator. Produces a professional medical
 * referral letter in French or Arabic for Moroccan specialists.
 *
 * Body:
 *   specialistType: string (e.g. "cardiologue", "dermatologue")
 *   reason: string (chief complaint / reason for referral)
 *   patientName: string
 *   patientAge?: number
 *   patientSex?: string
 *   relevantHistory?: string
 *   relevantResults?: string
 *   currentMedications?: string
 *   urgency?: "routine" | "urgent" | "emergency"
 *   language?: "fr" | "ar" (default: "fr")
 */
async function handler(req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("Clinic context required", 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const specialistType = body.specialistType as string | undefined;
  const reason = body.reason as string | undefined;
  const patientName = body.patientName as string | undefined;

  if (!specialistType || typeof specialistType !== "string" || specialistType.trim().length === 0) {
    return apiValidationError("specialistType is required");
  }
  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return apiValidationError("reason is required");
  }
  if (!patientName || typeof patientName !== "string" || patientName.trim().length === 0) {
    return apiValidationError("patientName is required");
  }

  const patientAge = typeof body.patientAge === "number" ? body.patientAge : undefined;
  const patientSex = (body.patientSex as string) ?? undefined;
  const relevantHistory = (body.relevantHistory as string) ?? undefined;
  const relevantResults = (body.relevantResults as string) ?? undefined;
  const currentMedications = (body.currentMedications as string) ?? undefined;
  const urgency = (body.urgency as string) ?? "routine";
  const language = (body.language as string) ?? "fr";

  const patientInfo: string[] = [`Nom: ${patientName}`];
  if (patientAge) patientInfo.push(`Age: ${patientAge} ans`);
  if (patientSex) patientInfo.push(`Sexe: ${patientSex}`);

  const sections: string[] = [
    `Spécialiste: ${specialistType}`,
    `Motif: ${reason}`,
    `Urgence: ${urgency}`,
    `\nPatient:\n${patientInfo.join("\n")}`,
  ];

  if (relevantHistory) sections.push(`\nAntécédents pertinents:\n${relevantHistory}`);
  if (relevantResults) sections.push(`\nRésultats pertinents:\n${relevantResults}`);
  if (currentMedications) sections.push(`\nTraitement actuel:\n${currentMedications}`);

  const systemPrompt =
    language === "ar"
      ? `أنت طبيب في المغرب. اكتب خطاب إحالة طبي احترافي بالعربية. يجب أن يتضمن: التحية، معلومات المريض، سبب الإحالة، الفحوصات ذات الصلة، والتوصيات. أعد النتيجة بصيغة JSON:
{
  "letter": "نص الخطاب الكامل",
  "summary": "ملخص قصير"
}`
      : `Tu es un médecin au Maroc. Rédige une lettre de référence médicale professionnelle en français. Elle doit contenir : formule de politesse, informations patient, motif de la référence, examens pertinents, et recommandations. Retourne UNIQUEMENT le JSON suivant :
{
  "letter": "texte complet de la lettre",
  "summary": "résumé court"
}`;

  const prompt = sections.join("\n");

  const aiRequest: AIRequest = {
    task: "generate",
    complexity: "complex",
    prompt,
    systemPrompt,
    maxTokens: 2000,
    temperature: 0.3,
    featureKey: "referral_letter",
  };

  const supabase = createUntypedAdminClient("ai-route");

  try {
    const configs = await loadProviderConfigs(supabase);
    const response = await routeAIRequest(aiRequest, configs, supabase);

    let parsed: { letter: string; summary: string };
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as { letter: string; summary: string };
      } else {
        parsed = { letter: response.text, summary: "" };
      }
    } catch {
      parsed = { letter: response.text, summary: "" };
    }

    return apiSuccess({
      letter: parsed.letter,
      summary: parsed.summary,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
    });
  } catch (err) {
    logger.error("Referral letter generation failed", {
      context: "api/ai/referral-letter",
      error: err instanceof Error ? err.message : String(err),
      clinicId,
    });
    return apiInternalError("Referral letter generation failed — try again");
  }
}

export const POST = withAuth(handler, ["doctor", "clinic_admin"]);
