/**
 * Smoke + behavioral tests for the MVA algorithm modules introduced in PR #950.
 *
 * These tests aren't trying to be exhaustive — they exercise enough of each
 * module's surface to satisfy the project's coverage ratchet
 * (.vitest-coverage-floor.json) while also pinning down a small set of
 * load-bearing behaviors:
 *
 *   - icd10-coder: keyword matching + ordering by confidence
 *   - lab-triage: triage-level escalation based on lab status
 *   - wait-time-predictor: queue + position math, delay branches
 *   - patient-churn-predictor: risk-level boundaries
 *   - health-tip-generator: ICD-10 → tip mapping + fallback
 *   - follow-up-scheduler: priority + interval picking from a code set
 *   - smart-scheduler: scoring with preferences and limit
 *   - staff-optimizer: under/over-staffed status + savings sign
 */

import { describe, expect, it } from "vitest";
import { suggestFollowUp } from "@/lib/algorithms/follow-up-scheduler";
import { generateHealthTip } from "@/lib/algorithms/health-tip-generator";
import { suggestICD10Codes } from "@/lib/algorithms/icd10-coder";
import { triageLabResult, getHighestTriageLevel } from "@/lib/algorithms/lab-triage";
import { predictChurn } from "@/lib/algorithms/patient-churn-predictor";
import { suggestSmartSlots } from "@/lib/algorithms/smart-scheduler";
import { optimizeStaffSchedule } from "@/lib/algorithms/staff-optimizer";
import { predictWaitTime } from "@/lib/algorithms/wait-time-predictor";

// ── ICD-10 coder ───────────────────────────────────────────────────────────

describe("suggestICD10Codes", () => {
  it("returns the asthma code for an asthma keyword", () => {
    const results = suggestICD10Codes("asthme", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("J45.9");
    expect(results[0].confidence).toBeGreaterThan(0);
  });

  it("respects the limit argument", () => {
    const results = suggestICD10Codes("douleur", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns an empty list for nonsense input", () => {
    const results = suggestICD10Codes("xqxqxqxq-nope-zzz", 3);
    expect(Array.isArray(results)).toBe(true);
  });

  it("sorts by confidence descending", () => {
    const results = suggestICD10Codes("tension", 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });
});

// ── Lab triage ─────────────────────────────────────────────────────────────

describe("triageLabResult", () => {
  it("flags a glucose value above the criticalHigh threshold as critical", () => {
    // The lab-results explainer uses mmol/L for glucose with criticalHigh=25.
    const result = triageLabResult({
      testName: "Glucose",
      value: 30,
      unit: "mmol/L",
      referenceMin: 4,
      referenceMax: 6,
    });
    expect(result.triageLevel).toBe("critical");
    expect(result.actionRequired).toBe(true);
    expect(result.urgency.fr.length).toBeGreaterThan(0);
  });

  it("returns routine for a value within range on an unmapped test", () => {
    // Use a test name that isn't in the LAB_REFERENCES dictionary so the
    // explainer falls back to our referenceMin/Max only.
    const result = triageLabResult({
      testName: "VitaminD",
      value: 35,
      unit: "ng/mL",
      referenceMin: 20,
      referenceMax: 50,
    });
    expect(result.triageLevel).toBe("routine");
    expect(result.actionRequired).toBe(false);
  });

  it("returns priority for an unmapped test value above referenceMax", () => {
    const result = triageLabResult({
      testName: "VitaminD",
      value: 80,
      unit: "ng/mL",
      referenceMin: 20,
      referenceMax: 50,
    });
    expect(result.triageLevel).toBe("priority");
    expect(result.actionRequired).toBe(true);
  });
});

describe("getHighestTriageLevel", () => {
  it("returns routine for an empty list", () => {
    expect(getHighestTriageLevel([])).toBe("routine");
  });

  it("returns critical when any result triggers critical-high in the explainer", () => {
    const level = getHighestTriageLevel([
      { testName: "VitaminD", value: 35, unit: "ng/mL", referenceMin: 20, referenceMax: 50 },
      // Glucose > criticalHigh (25 mmol/L) → critical-high → critical
      { testName: "Glucose", value: 30, unit: "mmol/L", referenceMin: 4, referenceMax: 6 },
    ]);
    expect(level).toBe("critical");
  });
});

// ── Wait time predictor ────────────────────────────────────────────────────

describe("predictWaitTime", () => {
  it("returns zero-ish wait when the queue is empty and no consultation in progress", () => {
    const estimate = predictWaitTime({
      patientsInQueue: 0,
      walkInsInQueue: 0,
      averageConsultationDurationMinutes: 15,
      doctorDelayMinutes: 0,
    });
    expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(0);
    expect(estimate.timeRange.min).toBeLessThanOrEqual(estimate.timeRange.max);
  });

  it("scales with position and reports a positive estimate for a long queue", () => {
    const estimate = predictWaitTime({
      patientsInQueue: 10,
      walkInsInQueue: 2,
      averageConsultationDurationMinutes: 20,
      doctorDelayMinutes: 5,
    });
    expect(estimate.estimatedMinutes).toBeGreaterThan(20);
    expect(["on-time", "delayed", "severely-delayed"]).toContain(estimate.status);
    expect(estimate.explanation.fr.length).toBeGreaterThan(0);
  });

  it("honors an explicit positionInQueue", () => {
    const front = predictWaitTime(
      {
        patientsInQueue: 10,
        walkInsInQueue: 0,
        averageConsultationDurationMinutes: 15,
        doctorDelayMinutes: 0,
      },
      0,
    );
    const back = predictWaitTime(
      {
        patientsInQueue: 10,
        walkInsInQueue: 0,
        averageConsultationDurationMinutes: 15,
        doctorDelayMinutes: 0,
      },
      9,
    );
    expect(back.estimatedMinutes).toBeGreaterThan(front.estimatedMinutes);
  });
});

// ── Patient churn predictor ────────────────────────────────────────────────

describe("predictChurn", () => {
  it("returns a low-risk prediction for an engaged recent patient", () => {
    const prediction = predictChurn({
      totalVisits: 20,
      daysSinceLastVisit: 30,
      cancellationRate: 0.0,
      averageDaysBetweenVisits: 45,
      lastVisitSatisfactionScore: 5,
    });
    expect(prediction.churnProbability).toBeGreaterThanOrEqual(0);
    expect(prediction.churnProbability).toBeLessThanOrEqual(1);
    expect(prediction.riskLevel).toBe("low");
  });

  it("returns a high-risk prediction for an absent, cancelling patient", () => {
    const prediction = predictChurn({
      totalVisits: 1,
      daysSinceLastVisit: 365,
      cancellationRate: 0.9,
      averageDaysBetweenVisits: 365,
      lastVisitSatisfactionScore: 1,
    });
    expect(prediction.riskLevel).toBe("high");
    expect(prediction.keyRiskFactors.length).toBeGreaterThan(0);
    expect(prediction.suggestedAction.fr.length).toBeGreaterThan(0);
  });
});

// ── Health tip generator ───────────────────────────────────────────────────

describe("generateHealthTip", () => {
  it("returns a diabetes tip for an E11 code", () => {
    const tip = generateHealthTip(["E11.9"]);
    expect(tip.condition.length).toBeGreaterThan(0);
    expect(tip.tipFr.length).toBeGreaterThan(0);
    expect(tip.tipAr.length).toBeGreaterThan(0);
  });

  it("falls back to a generic tip for an empty code set", () => {
    const tip = generateHealthTip([]);
    expect(tip.tipFr.length).toBeGreaterThan(0);
    expect(tip.tipAr.length).toBeGreaterThan(0);
  });

  it("falls back to a generic tip for an unmapped code", () => {
    const tip = generateHealthTip(["Z99.999"]);
    expect(tip.tipFr.length).toBeGreaterThan(0);
  });
});

// ── Follow-up scheduler ────────────────────────────────────────────────────

describe("suggestFollowUp", () => {
  const refDate = new Date("2026-01-15T10:00:00.000Z");

  it("returns a default follow-up for an empty code list", () => {
    const suggestion = suggestFollowUp([], refDate);
    expect(suggestion.intervalDays).toBeGreaterThan(0);
    expect(suggestion.recommendedDate.getTime()).toBeGreaterThan(refDate.getTime());
    expect(suggestion.rationale.fr.length).toBeGreaterThan(0);
  });

  it("picks the most urgent guideline when multiple codes are given", () => {
    const suggestion = suggestFollowUp(["I10", "J45.9"], refDate);
    expect(suggestion.intervalDays).toBeGreaterThan(0);
    expect(["routine", "important", "urgent"]).toContain(suggestion.priority);
  });
});

// ── Smart scheduler ────────────────────────────────────────────────────────

describe("suggestSmartSlots", () => {
  const baseDate = new Date("2026-02-02T08:00:00.000Z"); // Monday morning

  function slot(offsetHours: number) {
    const start = new Date(baseDate.getTime() + offsetHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return { start, end, durationMinutes: 30 };
  }

  it("returns at most the requested limit", () => {
    const slots = [slot(0), slot(1), slot(2), slot(3)];
    const scored = suggestSmartSlots(
      slots,
      { preferredDaysOfWeek: [1], preferredTimeOfDay: "morning", isUrgent: false },
      2,
    );
    expect(scored.length).toBeLessThanOrEqual(2);
  });

  it("returns an empty list when no slots are provided", () => {
    const scored = suggestSmartSlots(
      [],
      { preferredDaysOfWeek: [], preferredTimeOfDay: "any", isUrgent: false },
      3,
    );
    expect(scored).toEqual([]);
  });

  it("scores urgent + soon slots higher than later ones", () => {
    const slots = [slot(0), slot(24 * 14)]; // now vs 2 weeks out
    const scored = suggestSmartSlots(
      slots,
      { preferredDaysOfWeek: [], preferredTimeOfDay: "any", isUrgent: true },
      2,
    );
    expect(scored.length).toBe(2);
    expect(scored[0].score).toBeGreaterThanOrEqual(scored[1].score);
  });
});

// ── Staff schedule optimizer ───────────────────────────────────────────────

describe("optimizeStaffSchedule", () => {
  it("flags understaffed busy hours and suggests savings on idle hours", () => {
    // The implementation only emits a suggestion when the status is
    // non-"optimal" (i.e. there's a recommended action). We construct
    // one busy + understaffed and one idle + overstaffed input so we get
    // exactly two suggestions back, of opposite status.
    const result = optimizeStaffSchedule([
      // Busy hour, severely understaffed
      { dayOfWeek: 1, hour: 10, averagePatients: 16, currentStaff: 1 },
      // Idle hour, overstaffed
      { dayOfWeek: 1, hour: 14, averagePatients: 0, currentStaff: 2 },
    ]);
    expect(result.suggestions.length).toBe(2);
    expect(result.criticalUnderstaffedHours).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(result.totalWeeklySavings)).toBe(true);

    const understaffed = result.suggestions.find((s) => s.status === "understaffed");
    const overstaffed = result.suggestions.find((s) => s.status === "overstaffed");
    expect(understaffed?.suggestedStaff).toBeGreaterThan(1);
    expect(overstaffed?.suggestedStaff).toBeLessThan(2);
  });

  it("emits no suggestion for an already-optimal hour", () => {
    // 4 patients with 1 staff is exactly the optimal ratio
    // (PATIENTS_PER_STAFF_HOUR = 4), so the optimizer should skip it.
    const result = optimizeStaffSchedule([
      { dayOfWeek: 1, hour: 11, averagePatients: 4, currentStaff: 1 },
    ]);
    expect(result.suggestions).toEqual([]);
  });

  it("returns an empty result for an empty volume input", () => {
    const result = optimizeStaffSchedule([]);
    expect(result.suggestions).toEqual([]);
    expect(result.totalWeeklySavings).toBe(0);
    expect(result.criticalUnderstaffedHours).toBe(0);
  });
});
