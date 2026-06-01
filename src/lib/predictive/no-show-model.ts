/**
 * Patient no-show prediction model.
 *
 * Uses historical appointment data to predict no-show probability.
 * Implements a simple logistic-regression-style scoring based on
 * known risk factors.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NoShowFeatures {
  previousNoShowRate: number;
  daysSinceLastVisit: number | null;
  appointmentDayOfWeek: number;
  appointmentHour: number;
  isFirstVisit: boolean;
  hasInsurance: boolean;
  leadTimeDays: number;
  previousCancellations: number;
}

export interface NoShowPrediction {
  probability: number;
  riskLevel: "low" | "medium" | "high";
  topRiskFactors: { key: string; fr: string; ar: string }[];
  recommendation: { fr: string; ar: string };
}

// ─── Feature Weights (calibrated on typical clinic data) ─────────────────────

const WEIGHTS = {
  previousNoShowRate: 3.5,
  longLeadTime: 0.8,
  firstVisit: 0.5,
  noInsurance: 0.4,
  mondayOrFriday: 0.3,
  earlyMorning: 0.2,
  highCancellations: 0.6,
  longAbsence: 0.4,
};

const INTERCEPT = -2.0;

// ─── Implementation ──────────────────────────────────────────────────────────

export function predictNoShow(features: NoShowFeatures): NoShowPrediction {
  let logit = INTERCEPT;
  const riskFactors: { key: string; fr: string; ar: string }[] = [];

  logit += features.previousNoShowRate * WEIGHTS.previousNoShowRate;
  if (features.previousNoShowRate > 0.3) {
    riskFactors.push({
      key: "high_historical_rate",
      fr: "Taux historique d'absentéisme élevé",
      ar: "معدل غياب تاريخي مرتفع",
    });
  }

  if (features.leadTimeDays > 14) {
    logit += WEIGHTS.longLeadTime;
    riskFactors.push({
      key: "long_lead_time",
      fr: "Rendez-vous pris longtemps à l'avance",
      ar: "تم حجز الموعد مسبقاً بفترة طويلة",
    });
  }

  if (features.isFirstVisit) {
    logit += WEIGHTS.firstVisit;
    riskFactors.push({
      key: "first_visit",
      fr: "Première visite",
      ar: "الزيارة الأولى",
    });
  }

  if (!features.hasInsurance) {
    logit += WEIGHTS.noInsurance;
    riskFactors.push({
      key: "no_insurance",
      fr: "Aucune couverture d'assurance",
      ar: "لا توجد تغطية تأمينية",
    });
  }

  if (features.appointmentDayOfWeek === 1 || features.appointmentDayOfWeek === 5) {
    logit += WEIGHTS.mondayOrFriday;
    riskFactors.push({
      key: "monday_or_friday",
      fr: "Rendez-vous le lundi ou le vendredi",
      ar: "موعد يوم الاثنين أو الجمعة",
    });
  }

  if (features.appointmentHour < 9) {
    logit += WEIGHTS.earlyMorning;
    riskFactors.push({
      key: "early_morning",
      fr: "Créneau tôt le matin",
      ar: "موعد في الصباح الباكر",
    });
  }

  if (features.previousCancellations >= 3) {
    logit += WEIGHTS.highCancellations;
    riskFactors.push({
      key: "multiple_cancellations",
      fr: "Plusieurs annulations précédentes",
      ar: "إلغاءات سابقة متعددة",
    });
  }

  if (features.daysSinceLastVisit !== null && features.daysSinceLastVisit > 180) {
    logit += WEIGHTS.longAbsence;
    riskFactors.push({
      key: "long_absence",
      fr: "Longue absence depuis la dernière visite",
      ar: "غياب طويل منذ الزيارة الأخيرة",
    });
  }

  const probability = sigmoid(logit);
  const riskLevel = probability > 0.6 ? "high" : probability > 0.3 ? "medium" : "low";

  const recommendation = getRecommendation(riskLevel);

  return {
    probability: Math.round(probability * 1000) / 1000,
    riskLevel,
    topRiskFactors: riskFactors.slice(0, 3),
    recommendation,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function getRecommendation(riskLevel: "low" | "medium" | "high"): { fr: string; ar: string } {
  switch (riskLevel) {
    case "high":
      return {
        fr: "Envoyer un rappel 24h et 1h avant. Envisager de surréserver ce créneau.",
        ar: "إرسال تذكير قبل 24 ساعة و 1 ساعة. فكر في الحجز الزائد لهذا الموعد.",
      };
    case "medium":
      return {
        fr: "Envoyer un rappel 24h avant le rendez-vous.",
        ar: "إرسال تذكير قبل 24 ساعة من الموعد.",
      };
    case "low":
      return {
        fr: "Planification standard des rappels suffisante.",
        ar: "جدولة التذكير القياسية كافية.",
      };
  }
}
