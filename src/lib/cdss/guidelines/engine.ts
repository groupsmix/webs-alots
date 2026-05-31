/**
 * Clinical guidelines matching engine.
 *
 * Matches patient clinical context (diagnoses, vitals, lab results) against
 * evidence-based clinical protocols and generates actionable recommendations.
 */

import { logger } from "@/lib/logger";

export interface PatientClinicalContext {
  diagnoses: string[];
  vitals?: {
    systolicBP?: number;
    diastolicBP?: number;
    heartRate?: number;
    hba1c?: number;
    bmi?: number;
    bloodGlucoseFasting?: number;
  };
  medications: string[];
  ageYears: number;
  comorbidities?: string[];
}

export interface GuidelineRecommendation {
  id: string;
  protocol: string;
  category: "monitoring" | "treatment" | "lifestyle" | "referral" | "investigation";
  priority: "urgent" | "routine" | "informational";
  title: string;
  description: string;
  evidence: string;
  source: string;
}

export interface GuidelineCheckResult {
  recommendations: GuidelineRecommendation[];
  matchedProtocols: string[];
  checkedAt: string;
}

let recIdCounter = 0;

function nextRecId(): string {
  recIdCounter += 1;
  return `gl-${Date.now()}-${recIdCounter}`;
}

/**
 * Check patient context against all active clinical guidelines.
 */
export function checkGuidelines(context: PatientClinicalContext): GuidelineCheckResult {
  const recommendations: GuidelineRecommendation[] = [];
  const matchedProtocols: string[] = [];

  // Hypertension protocol
  const hyperRecs = checkHypertensionGuidelines(context);
  if (hyperRecs.length > 0) {
    matchedProtocols.push("hypertension-management");
    recommendations.push(...hyperRecs);
  }

  // Diabetes protocol
  const diabetesRecs = checkDiabetesGuidelines(context);
  if (diabetesRecs.length > 0) {
    matchedProtocols.push("diabetes-management");
    recommendations.push(...diabetesRecs);
  }

  if (recommendations.length > 0) {
    logger.info("CDSS: guidelines matched", {
      matchedProtocols,
      recommendationCount: recommendations.length,
    });
  }

  return {
    recommendations,
    matchedProtocols,
    checkedAt: new Date().toISOString(),
  };
}

function checkHypertensionGuidelines(ctx: PatientClinicalContext): GuidelineRecommendation[] {
  const recs: GuidelineRecommendation[] = [];
  const hasHTN = ctx.diagnoses.some(
    (d) => d.toLowerCase().includes("hypertension") || d.toLowerCase().includes("hta"),
  );

  if (!hasHTN) return recs;

  const systolic = ctx.vitals?.systolicBP;
  const diastolic = ctx.vitals?.diastolicBP;

  // Uncontrolled hypertension
  if (systolic && systolic >= 180) {
    recs.push({
      id: nextRecId(),
      protocol: "hypertension-management",
      category: "referral",
      priority: "urgent",
      title: "Hypertensive crisis — immediate action required",
      description: `Systolic BP ${systolic}mmHg ≥ 180. Assess for target organ damage. Consider emergency referral.`,
      evidence: "ESC 2023 Grade I-A",
      source: "ESC/ESH Hypertension Guidelines 2023",
    });
  } else if (systolic && systolic >= 140) {
    recs.push({
      id: nextRecId(),
      protocol: "hypertension-management",
      category: "treatment",
      priority: "routine",
      title: "BP above target — consider treatment adjustment",
      description: `Systolic BP ${systolic}mmHg exceeds target <140. Consider dose increase or additional agent.`,
      evidence: "ESC 2023 Grade I-A",
      source: "ESC/ESH Hypertension Guidelines 2023",
    });
  }

  // Monitoring recommendations
  if (systolic && diastolic) {
    const onACEI = ctx.medications.some((m) =>
      [
        "enalapril",
        "lisinopril",
        "ramipril",
        "captopril",
        "perindopril",
        "coversyl",
        "triatec",
      ].includes(m.toLowerCase()),
    );
    if (onACEI) {
      recs.push({
        id: nextRecId(),
        protocol: "hypertension-management",
        category: "monitoring",
        priority: "routine",
        title: "Monitor renal function and electrolytes",
        description:
          "Patient on ACE inhibitor — check creatinine and potassium within 2 weeks of initiation or dose change.",
        evidence: "ESC 2023 Grade I-B",
        source: "ESC/ESH Hypertension Guidelines 2023",
      });
    }
  }

  // Lifestyle recommendations for all HTN patients
  recs.push({
    id: nextRecId(),
    protocol: "hypertension-management",
    category: "lifestyle",
    priority: "informational",
    title: "Lifestyle modification counseling",
    description:
      "Salt restriction (<5g/day), regular exercise (30min/day 5-7 days/week), weight management, limit alcohol.",
    evidence: "ESC 2023 Grade I-A",
    source: "ESC/ESH Hypertension Guidelines 2023",
  });

  return recs;
}

function checkDiabetesGuidelines(ctx: PatientClinicalContext): GuidelineRecommendation[] {
  const recs: GuidelineRecommendation[] = [];
  const hasDM = ctx.diagnoses.some(
    (d) => d.toLowerCase().includes("diabetes") || d.toLowerCase().includes("diabète"),
  );

  if (!hasDM) return recs;

  const hba1c = ctx.vitals?.hba1c;

  // HbA1c control
  if (hba1c !== undefined) {
    if (hba1c > 9) {
      recs.push({
        id: nextRecId(),
        protocol: "diabetes-management",
        category: "treatment",
        priority: "urgent",
        title: "HbA1c severely elevated — intensify treatment",
        description: `HbA1c ${hba1c}% > 9%. Consider insulin initiation or intensification. Reassess adherence.`,
        evidence: "ADA 2024 Grade A",
        source: "ADA Standards of Care 2024",
      });
    } else if (hba1c > 7) {
      recs.push({
        id: nextRecId(),
        protocol: "diabetes-management",
        category: "treatment",
        priority: "routine",
        title: "HbA1c above target — consider treatment adjustment",
        description: `HbA1c ${hba1c}% exceeds target <7%. Consider adding second agent or dose optimisation.`,
        evidence: "ADA 2024 Grade A",
        source: "ADA Standards of Care 2024",
      });
    }
  }

  // Renal screening
  const onMetformin = ctx.medications.some((m) =>
    ["metformin", "glucophage", "metformine"].includes(m.toLowerCase()),
  );
  if (onMetformin) {
    recs.push({
      id: nextRecId(),
      protocol: "diabetes-management",
      category: "monitoring",
      priority: "routine",
      title: "Annual renal function assessment",
      description:
        "Check eGFR and urine albumin:creatinine ratio annually. Metformin contraindicated if eGFR <30.",
      evidence: "ADA 2024 Grade B",
      source: "ADA Standards of Care 2024",
    });
  }

  // Cardiovascular risk in diabetes
  if (ctx.ageYears >= 40) {
    const onStatin = ctx.medications.some((m) =>
      ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin", "tahor"].includes(
        m.toLowerCase(),
      ),
    );
    if (!onStatin) {
      recs.push({
        id: nextRecId(),
        protocol: "diabetes-management",
        category: "treatment",
        priority: "routine",
        title: "Statin therapy recommended",
        description:
          "Diabetes + age ≥40 — moderate-intensity statin recommended for cardiovascular risk reduction.",
        evidence: "ADA 2024 Grade A",
        source: "ADA Standards of Care 2024",
      });
    }
  }

  return recs;
}
