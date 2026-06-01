import { explainLabResult, type LabValue, type LabExplanation } from "@/lib/lab-results/explainer";

export type TriageLevel = "routine" | "priority" | "critical";

export interface LabTriageResult {
  triageLevel: TriageLevel;
  explanation: LabExplanation;
  urgency: { fr: string; ar: string };
  actionRequired: boolean;
}

/**
 * Triages a lab result to determine urgency and required action.
 * Builds on top of the patient-friendly lab explainer.
 */
export function triageLabResult(lab: LabValue): LabTriageResult {
  const explanation = explainLabResult(lab);

  let triageLevel: TriageLevel = "routine";
  let actionRequired = false;
  let urgency = {
    fr: "Revue de routine lors de la prochaine consultation.",
    ar: "مراجعة روتينية في الاستشارة القادمة."
  };

  if (explanation.status === "critical-low" || explanation.status === "critical-high") {
    triageLevel = "critical";
    actionRequired = true;
    urgency = {
      fr: "Urgence vitale possible. Contacter le patient immédiatement.",
      ar: "حالة طوارئ محتملة. اتصل بالمريض على الفور."
    };
  } else if (explanation.status === "low" || explanation.status === "high") {
    triageLevel = "priority";
    actionRequired = true;
    urgency = {
      fr: "Résultat anormal. Prévoir un suivi rapide.",
      ar: "نتيجة غير طبيعية. تحديد موعد متابعة سريع."
    };
  }

  return {
    triageLevel,
    explanation,
    urgency,
    actionRequired
  };
}

/**
 * Helper to determine if a list of lab results contains any critical values.
 */
export function getHighestTriageLevel(results: LabValue[]): TriageLevel {
  let highest: TriageLevel = "routine";
  for (const lab of results) {
    const { triageLevel } = triageLabResult(lab);
    if (triageLevel === "critical") return "critical"; // Early exit, can't get higher
    if (triageLevel === "priority") highest = "priority";
  }
  return highest;
}
