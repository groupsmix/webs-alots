/**
 * Lab result explainer — provides patient-friendly explanations
 * for common lab tests and flags abnormal values.
 */

export interface LabValue {
  testName: string;
  value: number;
  unit: string;
  referenceMin: number;
  referenceMax: number;
}

export interface LabExplanation {
  testName: string;
  status: "normal" | "low" | "high" | "critical-low" | "critical-high";
  explanation: string;
  patientFriendly: string;
}

/**
 * Reference ranges and explanations for common lab tests.
 */
const LAB_REFERENCES: Record<
  string,
  {
    criticalLow?: number;
    criticalHigh?: number;
    explanation: string;
    lowMeaning: string;
    highMeaning: string;
  }
> = {
  hemoglobin: {
    criticalLow: 7,
    criticalHigh: 20,
    explanation: "Hemoglobin carries oxygen in your blood",
    lowMeaning: "Low hemoglobin may indicate anemia — your body may not be getting enough oxygen",
    highMeaning: "High hemoglobin may indicate dehydration or a blood disorder",
  },
  glucose: {
    criticalLow: 2.8,
    criticalHigh: 25,
    explanation: "Blood glucose measures sugar levels in your blood",
    lowMeaning: "Low glucose (hypoglycemia) — may cause dizziness, shakiness, or confusion",
    highMeaning: "High glucose may indicate diabetes or pre-diabetes",
  },
  creatinine: {
    criticalHigh: 10,
    explanation: "Creatinine is a waste product filtered by your kidneys",
    lowMeaning: "Low creatinine is usually not concerning",
    highMeaning: "High creatinine may indicate reduced kidney function",
  },
  cholesterol: {
    criticalHigh: 10,
    explanation: "Total cholesterol measures fats in your blood",
    lowMeaning: "Low cholesterol is generally not a concern",
    highMeaning: "High cholesterol increases cardiovascular risk",
  },
  hba1c: {
    criticalHigh: 14,
    explanation: "HbA1c shows your average blood sugar over 2-3 months",
    lowMeaning: "Low HbA1c is usually normal",
    highMeaning: "High HbA1c indicates poor blood sugar control over recent months",
  },
  potassium: {
    criticalLow: 2.5,
    criticalHigh: 6.5,
    explanation: "Potassium is essential for heart and muscle function",
    lowMeaning: "Low potassium can cause muscle weakness and heart rhythm issues",
    highMeaning: "High potassium can be dangerous for heart rhythm",
  },
  sodium: {
    criticalLow: 120,
    criticalHigh: 160,
    explanation: "Sodium helps regulate fluid balance in your body",
    lowMeaning: "Low sodium may cause confusion, fatigue, or seizures",
    highMeaning: "High sodium may indicate dehydration",
  },
  tsh: {
    explanation: "TSH controls your thyroid gland",
    lowMeaning: "Low TSH may indicate an overactive thyroid (hyperthyroidism)",
    highMeaning: "High TSH may indicate an underactive thyroid (hypothyroidism)",
  },
};

function normalizeTestName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Generate patient-friendly explanation for a lab value.
 */
export function explainLabResult(lab: LabValue): LabExplanation {
  const normalized = normalizeTestName(lab.testName);
  const ref = LAB_REFERENCES[normalized];

  let status: LabExplanation["status"];
  if (ref?.criticalLow !== undefined && lab.value < ref.criticalLow) {
    status = "critical-low";
  } else if (ref?.criticalHigh !== undefined && lab.value > ref.criticalHigh) {
    status = "critical-high";
  } else if (lab.value < lab.referenceMin) {
    status = "low";
  } else if (lab.value > lab.referenceMax) {
    status = "high";
  } else {
    status = "normal";
  }

  const explanation = ref?.explanation ?? `${lab.testName} is a routine lab measurement`;

  let patientFriendly: string;
  switch (status) {
    case "normal":
      patientFriendly = `Your ${lab.testName} is within normal range (${lab.referenceMin}-${lab.referenceMax} ${lab.unit}).`;
      break;
    case "low":
      patientFriendly = ref?.lowMeaning ?? `Your ${lab.testName} is below normal range.`;
      break;
    case "high":
      patientFriendly = ref?.highMeaning ?? `Your ${lab.testName} is above normal range.`;
      break;
    case "critical-low":
      patientFriendly = `⚠️ Your ${lab.testName} is critically low. ${ref?.lowMeaning ?? "Please contact your doctor immediately."}`;
      break;
    case "critical-high":
      patientFriendly = `⚠️ Your ${lab.testName} is critically high. ${ref?.highMeaning ?? "Please contact your doctor immediately."}`;
      break;
  }

  return { testName: lab.testName, status, explanation, patientFriendly };
}
