/**
 * POST /api/v1/ai/prescription-safety
 *
 * Real-time prescription safety checker. Analyzes prescribed medications
 * for drug interactions, contraindications, and dosing alerts based on
 * patient profile using an LLM with Moroccan pharmacopeia knowledge.
 *
 * OWASP A01: withAuthValidation enforces doctor/clinic_admin only.
 * OWASP A03: All medication/condition strings sanitized before LLM injection.
 * OWASP A04: Patient verified to belong to requesting doctor's clinic.
 * OWASP A05: API key from resolveAIConfig() — never hardcoded.
 * OWASP A07: Rate limited per doctor and per clinic.
 */

import { type NextRequest } from "next/server";
import { resolveAIConfig } from "@/lib/ai/config";
import { sanitizeUntrustedText } from "@/lib/ai/sanitize";
import { validateAIOutput } from "@/lib/ai/validate-output";
import { getAIDisclaimer } from "@/lib/ai-disclaimer";
import { apiError, apiInternalError, apiRateLimited, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { aiSmartPrescriptionLimiter, aiClinicCeilingLimiter } from "@/lib/rate-limit";
import { prescriptionSafetySchema } from "@/lib/validations/prescription-safety";
import type { PrescriptionSafetyInput } from "@/lib/validations/prescription-safety";
import type { AuthContext } from "@/lib/with-auth";

// ── Types ──

interface SafetyFlag {
  severity: "critical" | "major" | "moderate" | "minor";
  type: "interaction" | "contraindication" | "dosing" | "allergy" | "pregnancy";
  drugs: string[];
  message: string;
  recommendation: string;
}

interface SafetyResult {
  flags: SafetyFlag[];
  overallRisk: "safe" | "caution" | "warning" | "danger";
  summary: string;
}

// ── In-memory response cache (TTL 5 min, max 100 entries) ──
// Prevents duplicate AI calls for the same prescription context within a session.
// Safe for edge: each cold start begins with an empty cache.

interface CacheEntry {
  result: SafetyResult;
  expiresAt: number;
}

const safetyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_SIZE = 100;

function getCached(key: string): SafetyResult | null {
  const entry = safetyCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    safetyCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCached(key: string, result: SafetyResult): void {
  // Evict oldest entries if cache is full
  if (safetyCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = safetyCache.keys().next().value;
    if (oldestKey) safetyCache.delete(oldestKey);
  }
  safetyCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

function buildCacheKey(data: PrescriptionSafetyInput): string {
  const prescriptions = data.currentPrescriptions
    .map((p: { name: string }) => p.name.toLowerCase())
    .sort();
  const existing = data.existingMedications.map((m: string) => m.toLowerCase()).sort();
  const conditions = data.patientHistory.conditions.map((c: string) => c.toLowerCase()).sort();
  return JSON.stringify({ prescriptions, existing, conditions });
}

// ── System Prompt ──

const SAFETY_CHECK_PROMPT = `Tu es un pharmacien clinicien expert en sécurité médicamenteuse marocaine.
Analyse les médicaments prescrits et fournis une évaluation de sécurité complète.

Vérifie spécifiquement:
1. Interactions médicamenteuses (entre nouveaux médicaments et médicaments existants)
2. Contre-indications selon le profil patient (âge, poids, pathologies)
3. Alertes posologiques (insuffisance rénale/hépatique, pédiatrie, gériatrie)
4. Allergies croisées potentielles
5. Risques en cas de grossesse (catégories FDA/ANSM)

RÈGLES:
- Réponses en FRANÇAIS uniquement
- Seulement les faits cliniques établis — pas de spéculation
- CRITIQUE = contre-indication absolue ou interaction grave pouvant causer décès/hospitalisation
- MAJEUR = interaction significative nécessitant ajustement de dose ou surveillance
- MODÉRÉ = interaction à surveiller, bénéfice/risque à évaluer
- MINEUR = interaction documentée, impact clinique faible

Retourne UNIQUEMENT ce JSON (sans markdown):
{
  "flags": [
    {
      "severity": "critical|major|moderate|minor",
      "type": "interaction|contraindication|dosing|allergy|pregnancy",
      "drugs": ["Médicament 1", "Médicament 2"],
      "message": "Description clinique précise en français",
      "recommendation": "Action recommandée au prescripteur en français"
    }
  ],
  "overallRisk": "safe|caution|warning|danger",
  "summary": "Résumé de 1-2 phrases en français"
}

Si aucun problème détecté: { "flags": [], "overallRisk": "safe", "summary": "Aucune interaction ou contre-indication détectée." }`;

// ── Output Parser ──

function parseSafetyResponse(content: string): SafetyResult | null {
  try {
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const validSeverities = new Set(["critical", "major", "moderate", "minor"]);
    const validTypes = new Set([
      "interaction",
      "contraindication",
      "dosing",
      "allergy",
      "pregnancy",
    ]);
    const validRisks = new Set(["safe", "caution", "warning", "danger"]);

    const rawFlags = Array.isArray(parsed.flags) ? parsed.flags : [];
    const flags: SafetyFlag[] = rawFlags
      .filter((f): f is Record<string, unknown> => f !== null && typeof f === "object")
      .map((f) => ({
        severity: validSeverities.has(String(f.severity))
          ? (f.severity as SafetyFlag["severity"])
          : "minor",
        type: validTypes.has(String(f.type)) ? (f.type as SafetyFlag["type"]) : "interaction",
        drugs: Array.isArray(f.drugs)
          ? (f.drugs as unknown[]).filter((d) => typeof d === "string").map((d) => d as string)
          : [],
        message: typeof f.message === "string" ? f.message.slice(0, 500) : "",
        recommendation: typeof f.recommendation === "string" ? f.recommendation.slice(0, 500) : "",
      }));

    const overallRisk = validRisks.has(String(parsed.overallRisk))
      ? (parsed.overallRisk as SafetyResult["overallRisk"])
      : "caution";

    return {
      flags,
      overallRisk,
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
    };
  } catch {
    logger.warn("Failed to parse AI safety check response", {
      context: "ai-prescription-safety",
      preview: content.slice(0, 200),
    });
    return null;
  }
}

// ── Route Handler ──

export const POST = withAuthValidation(
  prescriptionSafetySchema,
  async (data, _request: NextRequest, auth: AuthContext) => {
    // F-AI-01: Kill switch
    if (!(await isAIEnabled())) {
      return apiError("AI features are disabled", 503, "AI_DISABLED");
    }

    const { profile, supabase } = auth;
    const clinicId = profile.clinic_id;
    const doctorId = profile.id;

    if (!clinicId) {
      return apiError("No clinic associated with this account", 403, "NO_CLINIC");
    }

    // OWASP A07: Rate limiting
    const allowed = await aiSmartPrescriptionLimiter.check(`ai-presc-safety:${doctorId}`);
    if (!allowed) {
      return apiRateLimited(
        "Limite quotidienne atteinte (100 vérifications de sécurité/jour). Réessayez demain.",
      );
    }

    const clinicAllowed = await aiClinicCeilingLimiter.check(`ai:clinic:${clinicId}`);
    if (!clinicAllowed) {
      return apiRateLimited(
        "Limite quotidienne de la clinique atteinte pour les fonctionnalités IA. Réessayez demain.",
      );
    }

    // OWASP A04: Verify patient belongs to this clinic
    const { data: patient } = await supabase
      .from("users")
      .select("id")
      .eq("id", data.patientId)
      .eq("clinic_id", clinicId)
      .single();

    if (!patient) {
      return apiError("Patient not found", 404, "PATIENT_NOT_FOUND");
    }

    // Check in-memory cache
    const cacheKey = buildCacheKey(data);
    const cached = getCached(cacheKey);
    if (cached) {
      logger.debug("Prescription safety check served from cache", {
        context: "ai-prescription-safety",
        clinicId,
        doctorId,
      });
      return apiSuccess({ ...cached, disclaimer: getAIDisclaimer(), cached: true });
    }

    // OWASP A05: API credentials from resolveAIConfig
    const aiResult = await resolveAIConfig();
    if (!aiResult.ok) {
      return apiError(aiResult.reason, aiResult.statusCode, "AI_NOT_CONFIGURED");
    }
    const { apiKey, baseUrl, model } = aiResult.config;

    // OWASP A03: Sanitize all string inputs before injecting into LLM prompt
    const sanitizedPrescriptions = data.currentPrescriptions.map((p) => ({
      name: sanitizeUntrustedText(p.name),
      dosage: p.dosage ? sanitizeUntrustedText(p.dosage) : undefined,
      frequency: p.frequency ? sanitizeUntrustedText(p.frequency) : undefined,
      duration: p.duration ? sanitizeUntrustedText(p.duration) : undefined,
    }));

    const sanitizedExisting = data.existingMedications.map((m) => sanitizeUntrustedText(m));
    const sanitizedConditions = data.patientHistory.conditions.map((c) => sanitizeUntrustedText(c));
    const sanitizedAllergies = data.patientHistory.allergies.map((a) => sanitizeUntrustedText(a));

    // Build user message — NOTE: No PHI (no patient name, CIN, phone) in the message
    const prescriptionLines = sanitizedPrescriptions
      .map((p) => {
        const parts = [p.name];
        if (p.dosage) parts.push(p.dosage);
        if (p.frequency) parts.push(p.frequency);
        if (p.duration) parts.push(p.duration);
        return `• ${parts.join(" — ")}`;
      })
      .join("\n");

    const ph = data.patientHistory;
    const profileParts: string[] = [];
    if (ph.age !== undefined) profileParts.push(`Âge: ${ph.age} ans`);
    if (ph.weight !== undefined) profileParts.push(`Poids: ${ph.weight} kg`);
    if (ph.renalImpairment) profileParts.push("Insuffisance rénale");
    if (ph.hepaticImpairment) profileParts.push("Insuffisance hépatique");
    if (ph.pregnancy) profileParts.push("Grossesse");

    const userMessage = `MÉDICAMENTS PRESCRITS (NOUVEAUX):
${prescriptionLines}

MÉDICAMENTS EN COURS (CHRONIQUES):
${sanitizedExisting.length > 0 ? sanitizedExisting.map((m) => `• ${m}`).join("\n") : "Aucun"}

PROFIL PATIENT:
${profileParts.length > 0 ? profileParts.join(", ") : "Non renseigné"}

ANTÉCÉDENTS / PATHOLOGIES:
${sanitizedConditions.length > 0 ? sanitizedConditions.map((c) => `• ${c}`).join("\n") : "Aucun"}

ALLERGIES CONNUES:
${sanitizedAllergies.length > 0 ? sanitizedAllergies.map((a) => `• ${a}`).join("\n") : "Aucune"}

Effectue une analyse complète de sécurité médicamenteuse.`;

    try {
      const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SAFETY_CHECK_PROMPT },
            { role: "user", content: userMessage },
          ],
          max_tokens: 2000,
          temperature: 0.0,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text().catch(() => "unknown");
        logger.error("AI prescription safety check failed", {
          context: "ai-prescription-safety",
          clinicId,
          doctorId,
          status: aiResponse.status,
          errBody: errBody.slice(0, 300),
        });
        if (aiResponse.status === 429) {
          return apiRateLimited("Le service IA est temporairement surchargé. Réessayez.");
        }
        return apiInternalError("Le service de vérification de sécurité est indisponible.");
      }

      const aiData = (await aiResponse.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const rawContent = aiData.choices?.[0]?.message?.content;

      if (!rawContent) {
        return apiInternalError("Le service IA n'a pas retourné de réponse valide.");
      }

      // F-AI-10: Output safety validation
      const safeContent = validateAIOutput(rawContent);
      if (!safeContent) {
        logger.warn("AI output rejected by safety validator", {
          context: "ai-prescription-safety/output-safety",
          clinicId,
          doctorId,
        });
        return apiInternalError("La réponse IA a été rejetée par le validateur de sécurité.");
      }

      const result = parseSafetyResponse(safeContent);
      if (!result) {
        return apiInternalError("La réponse IA n'a pas pu être interprétée.");
      }

      // Cache result
      setCached(cacheKey, result);

      // Audit log for critical flags
      if (result.flags.some((f) => f.severity === "critical")) {
        void logAuditEvent({
          supabase,
          action: "ai_prescription_critical_safety_flag",
          type: "patient",
          clinicId,
          actor: doctorId,
          description: `Critical prescription safety flag detected for patient`,
          metadata: {
            patientId: data.patientId,
            flagCount: result.flags.length,
            overallRisk: result.overallRisk,
          },
        });
      }

      return apiSuccess({ ...result, disclaimer: getAIDisclaimer(), cached: false });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return apiError(
          "La vérification a pris trop de temps. Veuillez réessayer.",
          504,
          "AI_TIMEOUT",
        );
      }
      logger.error("Prescription safety check failed unexpectedly", {
        context: "ai-prescription-safety",
        clinicId,
        doctorId,
        error: err instanceof Error ? err.message : String(err),
      });
      return apiInternalError("Erreur lors de la vérification de sécurité. Veuillez réessayer.");
    }
  },
  ["doctor", "clinic_admin"],
);
