/**
 * Patient Churn Predictor.
 *
 * Uses a logistic regression scoring model to predict the likelihood
 * of a patient not returning to the clinic (churning) based on visit
 * frequency, recency, cancellations, and (optionally) satisfaction scores.
 */

export interface PatientHistoryFeatures {
  totalVisits: number;
  daysSinceLastVisit: number;
  cancellationRate: number; // 0.0 to 1.0
  averageDaysBetweenVisits: number;
  lastVisitSatisfactionScore?: number; // 1 to 5
}

export interface ChurnPrediction {
  churnProbability: number;
  riskLevel: "low" | "medium" | "high";
  keyRiskFactors: { fr: string; ar: string }[];
  suggestedAction: { fr: string; ar: string };
}

// ── Model Weights (Logistic Regression Coefficients) ─────────────────────────

// Baseline log-odds
const INTERCEPT = -2.5;

const WEIGHTS = {
  daysSinceLastVisit: 0.015, // Positive: longer absence = higher churn risk
  totalVisits: -0.2, // Negative: more visits = lower churn risk
  cancellationRate: 2.5, // Positive: high cancellations = high churn risk
  averageDaysBetweenVisits: 0.005, // Positive: erratic/infrequent visits = higher risk
  lowSatisfaction: 1.5, // Positive: low score = high risk
  highSatisfaction: -1.0, // Negative: high score = lower risk
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ── Prediction Algorithm ─────────────────────────────────────────────────────

export function predictChurn(features: PatientHistoryFeatures): ChurnPrediction {
  let logit = INTERCEPT;
  const riskFactors: { fr: string; ar: string }[] = [];

  // Recency
  logit += features.daysSinceLastVisit * WEIGHTS.daysSinceLastVisit;
  if (features.daysSinceLastVisit > 180) {
    riskFactors.push({
      fr: "Absence prolongée (> 6 mois)",
      ar: "غياب طويل (> 6 أشهر)",
    });
  }

  // Frequency
  logit += features.totalVisits * WEIGHTS.totalVisits;
  if (features.totalVisits <= 2) {
    riskFactors.push({
      fr: "Faible historique de visites",
      ar: "سجل زيارات ضعيف",
    });
  }

  // Cancellations
  logit += features.cancellationRate * WEIGHTS.cancellationRate;
  if (features.cancellationRate > 0.3) {
    riskFactors.push({
      fr: "Taux d'annulation élevé",
      ar: "معدل إلغاء مرتفع",
    });
  }

  // Consistency
  logit += features.averageDaysBetweenVisits * WEIGHTS.averageDaysBetweenVisits;

  // Satisfaction (if available)
  if (features.lastVisitSatisfactionScore !== undefined) {
    if (features.lastVisitSatisfactionScore <= 2) {
      logit += WEIGHTS.lowSatisfaction;
      riskFactors.push({
        fr: "Insatisfaction lors de la dernière visite",
        ar: "عدم الرضا في الزيارة الأخيرة",
      });
    } else if (features.lastVisitSatisfactionScore >= 4) {
      logit += WEIGHTS.highSatisfaction;
    }
  }

  const probability = sigmoid(logit);
  let riskLevel: "low" | "medium" | "high" = "low";
  let suggestedAction = {
    fr: "Aucune action requise",
    ar: "لا يوجد إجراء مطلوب",
  };

  if (probability > 0.65) {
    riskLevel = "high";
    suggestedAction = {
      fr: "Appeler le patient pour une visite de contrôle gratuite ou un bilan de santé.",
      ar: "اتصل بالمريض لفحص طبي أو تقييم صحي مجاني.",
    };
  } else if (probability > 0.4) {
    riskLevel = "medium";
    suggestedAction = {
      fr: "Envoyer un message WhatsApp avec des conseils de santé personnalisés.",
      ar: "إرسال رسالة واتساب تحتوي على نصائح صحية شخصية.",
    };
  }

  return {
    churnProbability: Math.round(probability * 1000) / 1000,
    riskLevel,
    keyRiskFactors: riskFactors.slice(0, 3), // Max 3 reasons
    suggestedAction,
  };
}
