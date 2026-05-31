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
  topRiskFactors: string[];
  recommendation: string;
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
  const riskFactors: string[] = [];

  logit += features.previousNoShowRate * WEIGHTS.previousNoShowRate;
  if (features.previousNoShowRate > 0.3) {
    riskFactors.push("High historical no-show rate");
  }

  if (features.leadTimeDays > 14) {
    logit += WEIGHTS.longLeadTime;
    riskFactors.push("Appointment booked far in advance");
  }

  if (features.isFirstVisit) {
    logit += WEIGHTS.firstVisit;
    riskFactors.push("First-time patient");
  }

  if (!features.hasInsurance) {
    logit += WEIGHTS.noInsurance;
    riskFactors.push("No insurance coverage");
  }

  if (features.appointmentDayOfWeek === 1 || features.appointmentDayOfWeek === 5) {
    logit += WEIGHTS.mondayOrFriday;
    riskFactors.push("Monday/Friday appointment");
  }

  if (features.appointmentHour < 9) {
    logit += WEIGHTS.earlyMorning;
    riskFactors.push("Early morning slot");
  }

  if (features.previousCancellations >= 3) {
    logit += WEIGHTS.highCancellations;
    riskFactors.push("Multiple previous cancellations");
  }

  if (features.daysSinceLastVisit !== null && features.daysSinceLastVisit > 180) {
    logit += WEIGHTS.longAbsence;
    riskFactors.push("Long absence since last visit");
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

function getRecommendation(riskLevel: "low" | "medium" | "high"): string {
  switch (riskLevel) {
    case "high":
      return "Send reminder 24h and 1h before. Consider overbooking this slot.";
    case "medium":
      return "Send reminder 24h before appointment.";
    case "low":
      return "Standard reminder scheduling sufficient.";
  }
}
