import { NextRequest } from "next/server";
import { routeAIRequest, loadProviderConfigs } from "@/lib/ai/router";
import type { AIRequest } from "@/lib/ai/types";
import { apiSuccess, apiError, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

/**
 * POST /api/ai/lab-preread
 *
 * AI-powered lab results pre-read. Accepts a list of lab test results
 * and returns an analysis highlighting anomalies, trends, and suggested
 * questions to ask the patient before the consultation starts.
 *
 * Body:
 *   results: Array<{ testName: string; value: string; unit: string; referenceRange?: string }>
 *   patientContext?: { age?: number; sex?: string; conditions?: string[] }
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

  const results = body.results as
    | Array<{ testName: string; value: string; unit: string; referenceRange?: string }>
    | undefined;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return apiValidationError("results array is required and must not be empty");
  }

  if (results.length > 50) {
    return apiValidationError("Maximum 50 lab results per analysis");
  }

  for (const r of results) {
    if (!r.testName || typeof r.testName !== "string") {
      return apiValidationError("Each result must have a testName");
    }
    if (!r.value || typeof r.value !== "string") {
      return apiValidationError("Each result must have a value");
    }
  }

  const patientContext = body.patientContext as
    | { age?: number; sex?: string; conditions?: string[] }
    | undefined;

  const language = (body.language as string) ?? "fr";

  const labTable = results
    .map((r) => {
      let line = `- ${r.testName}: ${r.value} ${r.unit || ""}`;
      if (r.referenceRange) line += ` (réf: ${r.referenceRange})`;
      return line;
    })
    .join("\n");

  let patientInfo = "";
  if (patientContext) {
    const parts: string[] = [];
    if (patientContext.age) parts.push(`Age: ${patientContext.age} ans`);
    if (patientContext.sex) parts.push(`Sexe: ${patientContext.sex}`);
    if (patientContext.conditions?.length) {
      parts.push(`Antécédents: ${patientContext.conditions.join(", ")}`);
    }
    if (parts.length > 0) {
      patientInfo = `\n\nContexte patient:\n${parts.join("\n")}`;
    }
  }

  const systemPrompt =
    language === "ar"
      ? `أنت طبيب مختبر. حلّل نتائج التحاليل المخبرية وأعطِ النتائج بصيغة JSON التالية فقط:
{
  "anomalies": [
    {
      "testName": "اسم التحليل",
      "value": "القيمة",
      "status": "high" | "low" | "critical",
      "interpretation": "التفسير الطبي",
      "clinicalSignificance": "الأهمية السريرية"
    }
  ],
  "trends": ["ملاحظة 1"],
  "suggestedQuestions": ["سؤال للمريض 1"],
  "summary": "ملخص عام",
  "urgentFlags": ["تنبيه عاجل"]
}`
      : `Tu es un médecin biologiste. Analyse les résultats de laboratoire et retourne UNIQUEMENT le JSON suivant :
{
  "anomalies": [
    {
      "testName": "nom du test",
      "value": "valeur mesurée",
      "status": "high" | "low" | "critical",
      "interpretation": "interprétation médicale",
      "clinicalSignificance": "signification clinique"
    }
  ],
  "trends": ["observation 1"],
  "suggestedQuestions": ["question à poser au patient 1"],
  "summary": "résumé global",
  "urgentFlags": ["alerte urgente"]
}`;

  const prompt = `Analyse ces résultats de laboratoire :\n${labTable}${patientInfo}`;

  const aiRequest: AIRequest = {
    task: "analyze",
    complexity: "complex",
    prompt,
    systemPrompt,
    maxTokens: 2000,
    temperature: 0.1,
    featureKey: "lab_preread",
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
        parsed = {
          anomalies: [],
          trends: [],
          suggestedQuestions: [],
          summary: response.text,
          urgentFlags: [],
        };
      }
    } catch {
      parsed = {
        anomalies: [],
        trends: [],
        suggestedQuestions: [],
        summary: response.text,
        urgentFlags: [],
      };
    }

    return apiSuccess({
      result: parsed,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
    });
  } catch (err) {
    logger.error("Lab pre-read analysis failed", {
      context: "api/ai/lab-preread",
      error: err instanceof Error ? err.message : String(err),
      clinicId,
    });
    return apiInternalError("Lab analysis failed — try again");
  }
}

export const POST = withAuth(handler, ["doctor", "clinic_admin"]);
