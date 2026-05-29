/**
 * NEWS2 (National Early Warning Score 2) Calculator
 *
 * Adapted from ECC healthcare-cdss-patterns skill.
 * Scoring tables match the Royal College of Physicians specification.
 * Pure function — input vitals, output score + risk level + escalation guidance.
 */

import type { NEWS2Input, NEWS2Result, NEWS2Risk } from "./types";

// ── Scoring tables (Royal College of Physicians) ──

function scoreRespiratoryRate(rate: number): number {
  if (rate <= 8) return 3;
  if (rate <= 11) return 1;
  if (rate <= 20) return 0;
  if (rate <= 24) return 2;
  return 3;
}

function scoreOxygenSaturation(spo2: number, onOxygen: boolean): number {
  if (onOxygen) {
    // Scale 2 (for patients on supplemental O2)
    if (spo2 <= 91) return 3;
    if (spo2 <= 93) return 2;
    if (spo2 <= 95) return 1;
    return 0;
  }
  // Scale 1 (for patients on room air)
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

function scoreSupplementalOxygen(onOxygen: boolean): number {
  return onOxygen ? 2 : 0;
}

function scoreTemperature(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2;
}

function scoreSystolicBP(sbp: number): number {
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3;
}

function scoreHeartRate(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3;
}

function scoreConsciousness(level: "alert" | "voice" | "pain" | "unresponsive"): number {
  return level === "alert" ? 0 : 3;
}

function getRisk(total: number, hasThreeInSingle: boolean): NEWS2Risk {
  if (total >= 7) return "high";
  if (hasThreeInSingle) return "medium";
  if (total >= 5) return "medium";
  if (total >= 1) return "low-medium";
  return "low";
}

function getEscalation(risk: NEWS2Risk): string {
  switch (risk) {
    case "high":
      return "Évaluation clinique urgente. Envisager transfert en réanimation.";
    case "medium":
      return "Évaluation clinique urgente par le médecin. Surveillance rapprochée.";
    case "low-medium":
      return "Informer l'infirmier responsable. Augmenter la fréquence de surveillance.";
    case "low":
      return "Continuer la surveillance de routine.";
  }
}

/**
 * Calculate NEWS2 score from vital signs.
 *
 * @param vitals - Patient vital signs
 * @returns NEWS2Result with total score, risk level, components, and escalation guidance
 */
export function calculateNEWS2(vitals: NEWS2Input): NEWS2Result {
  const components: Record<string, number> = {
    respiratoryRate: scoreRespiratoryRate(vitals.respiratoryRate),
    oxygenSaturation: scoreOxygenSaturation(vitals.oxygenSaturation, vitals.supplementalOxygen),
    supplementalOxygen: scoreSupplementalOxygen(vitals.supplementalOxygen),
    temperature: scoreTemperature(vitals.temperature),
    systolicBP: scoreSystolicBP(vitals.systolicBP),
    heartRate: scoreHeartRate(vitals.heartRate),
    consciousness: scoreConsciousness(vitals.consciousness),
  };

  const total = Object.values(components).reduce((sum, v) => sum + v, 0);
  const hasThreeInSingle = Object.values(components).some((v) => v === 3);
  const risk = getRisk(total, hasThreeInSingle);
  const escalation = getEscalation(risk);

  return { total, risk, components, escalation };
}
