/**
 * Follow-up Scheduler Algorithm.
 *
 * Maps diagnosis codes (ICD-10 or internal) to recommended follow-up intervals
 * based on Moroccan clinical guidelines. Returns a recommended date and rationale.
 */

export interface FollowUpSuggestion {
  recommendedDate: Date;
  intervalDays: number;
  rationale: { fr: string; ar: string };
  priority: "routine" | "important" | "urgent";
}

// ── Follow-Up Guidelines Database ──────────────────────────────────────────

/**
 * Diagnosis to follow-up mapping.
 * Keys are ICD-10 categories or specific conditions.
 */
const FOLLOW_UP_GUIDELINES: Record<
  string,
  { intervalDays: number; rationale: { fr: string; ar: string }; priority: "routine" | "important" | "urgent" }
> = {
  // Chronic conditions
  "E11": { // Type 2 Diabetes
    intervalDays: 90,
    rationale: {
      fr: "Suivi trimestriel recommandé pour le diabète de type 2 (HbA1c).",
      ar: "يوصى بمتابعة كل ثلاثة أشهر لمرض السكري من النوع 2."
    },
    priority: "important"
  },
  "I10": { // Essential (primary) hypertension
    intervalDays: 180,
    rationale: {
      fr: "Suivi semestriel recommandé pour l'hypertension artérielle stabilisée.",
      ar: "متابعة نصف سنوية موصى بها لارتفاع ضغط الدم المستقر."
    },
    priority: "important"
  },
  "J45": { // Asthma
    intervalDays: 180,
    rationale: {
      fr: "Évaluation du contrôle de l'asthme recommandée tous les 6 mois.",
      ar: "تقييم السيطرة على الربو موصى به كل 6 أشهر."
    },
    priority: "routine"
  },
  
  // Acute conditions
  "J01": { // Acute sinusitis
    intervalDays: 14,
    rationale: {
      fr: "Visite de contrôle pour vérifier la résolution de l'infection.",
      ar: "زيارة مراقبة للتحقق من زوال العدوى."
    },
    priority: "routine"
  },
  "J03": { // Acute tonsillitis (angine)
    intervalDays: 10,
    rationale: {
      fr: "Contrôle post-traitement antibiotique.",
      ar: "مراقبة بعد العلاج بالمضادات الحيوية."
    },
    priority: "routine"
  },
  
  // Post-op or severe
  "POST_OP": {
    intervalDays: 7,
    rationale: {
      fr: "Contrôle post-opératoire et retrait des fils si applicable.",
      ar: "مراقبة ما بعد الجراحة وإزالة الخيوط إذا لزم الأمر."
    },
    priority: "urgent"
  },
  "Z34": { // Normal pregnancy supervision
    intervalDays: 30,
    rationale: {
      fr: "Suivi mensuel de grossesse.",
      ar: "متابعة شهرية للحمل."
    },
    priority: "important"
  }
};

/**
 * Default fallback follow-up if none is matched.
 */
const DEFAULT_FOLLOW_UP = {
  intervalDays: 180,
  rationale: {
    fr: "Consultation de suivi général.",
    ar: "استشارة متابعة عامة."
  },
  priority: "routine" as const
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Analyzes diagnoses from a consultation and returns the most urgent follow-up suggestion.
 * 
 * @param diagnosisCodes Array of ICD-10 codes or condition identifiers
 * @param consultationDate The date of the current consultation (defaults to now)
 */
export function suggestFollowUp(
  diagnosisCodes: string[],
  consultationDate: Date = new Date()
): FollowUpSuggestion {
  if (!diagnosisCodes || diagnosisCodes.length === 0) {
    return {
      recommendedDate: new Date(consultationDate.getTime() + DEFAULT_FOLLOW_UP.intervalDays * 24 * 60 * 60 * 1000),
      intervalDays: DEFAULT_FOLLOW_UP.intervalDays,
      rationale: DEFAULT_FOLLOW_UP.rationale,
      priority: DEFAULT_FOLLOW_UP.priority
    };
  }

  let mostUrgentMatch = null;
  let minInterval = Infinity;

  for (const code of diagnosisCodes) {
    // Exact match or prefix match (e.g. E11.9 matches E11)
    const baseCode = code.split('.')[0].toUpperCase();
    const guideline = FOLLOW_UP_GUIDELINES[baseCode] || FOLLOW_UP_GUIDELINES[code];

    if (guideline && guideline.intervalDays < minInterval) {
      minInterval = guideline.intervalDays;
      mostUrgentMatch = guideline;
    }
  }

  const result = mostUrgentMatch || DEFAULT_FOLLOW_UP;

  const recommendedDate = new Date(consultationDate);
  recommendedDate.setDate(recommendedDate.getDate() + result.intervalDays);

  return {
    recommendedDate,
    intervalDays: result.intervalDays,
    rationale: result.rationale,
    priority: result.priority
  };
}
