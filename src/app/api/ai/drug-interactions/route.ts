import { NextRequest } from "next/server";
import { routeAIRequest, loadProviderConfigs } from "@/lib/ai/router";
import type { AIRequest } from "@/lib/ai/types";
import {
  apiSuccess,
  apiError,
  apiInternalError,
  apiValidationError,
  apiRateLimited,
} from "@/lib/api-response";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { aiGenerationLimiter } from "@/lib/rate-limit";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

/**
 * POST /api/ai/drug-interactions
 *
 * AI-powered drug interaction checker for the prescription flow.
 * Checks a list of medications for potential interactions, contraindications,
 * and dosage concerns — localized to the Moroccan pharmacopeia.
 *
 * Supports French and Arabic drug names. Returns structured interaction
 * results with severity levels and clinical recommendations.
 *
 * Body:
 *   medications: Array<{ name: string; dosage?: string; frequency?: string }>
 *   patientContext?: { age?: number; weight?: number; allergies?: string[]; conditions?: string[] }
 *   language?: "fr" | "ar" (default: "fr")
 */
async function handler(req: NextRequest, auth: AuthContext) {
  // F-AI-01: Early kill switch — fail fast before processing
  if (!(await isAIEnabled())) {
    return apiError("AI features are disabled", 503, "AI_DISABLED");
  }

  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("Clinic context required", 400);
  }

  // AUDIT P1-10: per-user daily cap — this route calls a paid LLM
  const allowed = await aiGenerationLimiter.check(`ai-drug-interactions:${auth.profile.id}`);
  if (!allowed) {
    return apiRateLimited("Limite quotidienne IA atteinte. Réessayez demain.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const medications = body.medications as
    | Array<{ name: string; dosage?: string; frequency?: string }>
    | undefined;

  if (!medications || !Array.isArray(medications) || medications.length === 0) {
    return apiValidationError("medications array is required and must not be empty");
  }

  if (medications.length > 20) {
    return apiValidationError("Maximum 20 medications per check");
  }

  for (const med of medications) {
    if (!med.name || typeof med.name !== "string" || med.name.trim().length === 0) {
      return apiValidationError("Each medication must have a non-empty name");
    }
  }

  const patientContext = body.patientContext as
    | {
        age?: number;
        weight?: number;
        allergies?: string[];
        conditions?: string[];
      }
    | undefined;

  const language = (body.language as string) ?? "fr";

  const medList = medications
    .map((m) => {
      let entry = `- ${m.name}`;
      if (m.dosage) entry += ` (${m.dosage})`;
      if (m.frequency) entry += ` — ${m.frequency}`;
      return entry;
    })
    .join("\n");

  let patientInfo = "";
  if (patientContext) {
    const parts: string[] = [];
    if (patientContext.age) parts.push(`Age: ${patientContext.age} ans`);
    if (patientContext.weight) parts.push(`Poids: ${patientContext.weight} kg`);
    if (patientContext.allergies?.length) {
      parts.push(`Allergies: ${patientContext.allergies.join(", ")}`);
    }
    if (patientContext.conditions?.length) {
      parts.push(`Antécédents: ${patientContext.conditions.join(", ")}`);
    }
    if (parts.length > 0) {
      patientInfo = `\n\nPatient context:\n${parts.join("\n")}`;
    }
  }

  const systemPrompt =
    language === "ar"
      ? `أنت صيدلي سريري متخصص في الأدوية المتوفرة في المغرب. قم بتحليل التفاعلات الدوائية وأعط النتائج بصيغة JSON المحددة أدناه. استخدم الأسماء التجارية المتداولة في الصيدليات المغربية.

أعد النتائج بصيغة JSON التالية فقط، بدون أي نص إضافي:
{
  "interactions": [
    {
      "drugs": ["اسم الدواء 1", "اسم الدواء 2"],
      "severity": "high" | "moderate" | "low",
      "description": "وصف التفاعل",
      "recommendation": "التوصية السريرية"
    }
  ],
  "warnings": [
    {
      "drug": "اسم الدواء",
      "type": "allergy" | "contraindication" | "dosage" | "renal" | "hepatic",
      "message": "تحذير"
    }
  ],
  "summary": "ملخص عام"
}`
      : `Tu es un pharmacien clinicien spécialisé dans les médicaments disponibles au Maroc. Analyse les interactions médicamenteuses et retourne les résultats au format JSON ci-dessous. Utilise les noms commerciaux courants dans les pharmacies marocaines.

Retourne UNIQUEMENT le JSON suivant, sans texte additionnel :
{
  "interactions": [
    {
      "drugs": ["médicament 1", "médicament 2"],
      "severity": "high" | "moderate" | "low",
      "description": "description de l'interaction",
      "recommendation": "recommandation clinique"
    }
  ],
  "warnings": [
    {
      "drug": "nom du médicament",
      "type": "allergy" | "contraindication" | "dosage" | "renal" | "hepatic",
      "message": "avertissement"
    }
  ],
  "summary": "résumé global"
}`;

  const prompt = `Vérifie les interactions entre ces médicaments :\n${medList}${patientInfo}`;

  const aiRequest: AIRequest = {
    task: "analyze",
    complexity: "complex",
    prompt,
    systemPrompt,
    maxTokens: 2000,
    temperature: 0.1,
    featureKey: "drug_interaction_checker",
  };

  const supabase = createUntypedAdminClient("ai-route");

  try {
    const configs = await loadProviderConfigs(supabase);
    const response = await routeAIRequest(aiRequest, configs, supabase);

    let parsed: unknown;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = { interactions: [], warnings: [], summary: response.text };
      }
    } catch {
      parsed = { interactions: [], warnings: [], summary: response.text };
    }

    return apiSuccess({
      result: parsed,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
    });
  } catch (err) {
    logger.error("Drug interaction check failed", {
      context: "api/ai/drug-interactions",
      error: err instanceof Error ? err.message : String(err),
      clinicId,
    });
    return apiInternalError("Drug interaction check failed — try again");
  }
}

export const POST = withAuth(handler, ["doctor", "clinic_admin"]);
