export interface ClinicSignals {
  clinicId: string;
  clinicName: string;
  loginFrequency: number;
  appointmentBookingRate: number;
  noShowRate: number;
  featureAdoption: number;
  paymentHealthy: boolean;
  negativeSupportRate: number;
  lastLoginDaysAgo: number;
  totalAppointments7d: number;
  planTier: "starter" | "pro" | "enterprise" | string;
}

export interface ClinicHealthScore {
  clinicId: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  topRiskSignal: string;
  topStrengthSignal: string;
  trend: "improving" | "stable" | "declining";
  churnRisk: "low" | "medium" | "high" | "critical";
  computedAt: string;
}

const WEIGHTS = {
  loginFrequency: 0.25,
  appointmentBookingRate: 0.25,
  noShowRateInverted: 0.2,
  featureAdoption: 0.15,
  paymentHealthy: 0.1,
  negativeSupportRateInverted: 0.05,
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, 1));
}

export function computeClinicHealthScore(signals: ClinicSignals): ClinicHealthScore {
  const normalized = {
    loginFrequency: clamp01(signals.loginFrequency),
    appointmentBookingRate: clamp01(signals.appointmentBookingRate),
    noShowRateInverted: clamp01(1 - signals.noShowRate),
    featureAdoption: clamp01(signals.featureAdoption),
    paymentHealthy: signals.paymentHealthy ? 1 : 0,
    negativeSupportRateInverted: clamp01(1 - signals.negativeSupportRate),
  };

  const rawScore =
    normalized.loginFrequency * WEIGHTS.loginFrequency +
    normalized.appointmentBookingRate * WEIGHTS.appointmentBookingRate +
    normalized.noShowRateInverted * WEIGHTS.noShowRateInverted +
    normalized.featureAdoption * WEIGHTS.featureAdoption +
    normalized.paymentHealthy * WEIGHTS.paymentHealthy +
    normalized.negativeSupportRateInverted * WEIGHTS.negativeSupportRateInverted;

  const score = Math.round(rawScore * 100);
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
  const churnRisk =
    score >= 75 ? "low" : score >= 55 ? "medium" : score >= 35 ? "high" : "critical";

  const signalScores = Object.entries(normalized).map(([name, value]) => ({
    name,
    contribution: value * WEIGHTS[name as keyof typeof WEIGHTS],
  }));

  const riskSorted = [...signalScores].sort((a, b) => a.contribution - b.contribution);
  const strengthSorted = [...signalScores].sort((a, b) => b.contribution - a.contribution);

  return {
    clinicId: signals.clinicId,
    score,
    grade,
    topRiskSignal: riskSorted[0]?.name ?? "unknown",
    topStrengthSignal: strengthSorted[0]?.name ?? "unknown",
    trend: "stable",
    churnRisk,
    computedAt: new Date().toISOString(),
  };
}

export function applyHealthScoreTrend(
  score: ClinicHealthScore,
  previousScore?: number | null,
): ClinicHealthScore {
  if (typeof previousScore !== "number") return score;
  const delta = score.score - previousScore;
  return {
    ...score,
    trend: delta > 5 ? "improving" : delta < -5 ? "declining" : "stable",
  };
}
