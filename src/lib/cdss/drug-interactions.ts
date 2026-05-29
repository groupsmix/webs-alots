/**
 * CDSS Drug Interaction Checker — Pure Function, Bidirectional
 *
 * Adapted from ECC healthcare-cdss-patterns skill.
 * Interaction pairs are bidirectional: if Drug A interacts with Drug B,
 * then Drug B interacts with Drug A.
 *
 * Zero tolerance for false negatives — a missed interaction is a patient safety event.
 */

import type { DrugInteractionPair, InteractionAlert, InteractionSeverity } from "./types";

// ── Interaction Database (French/Moroccan pharmacopeia) ──

const INTERACTION_PAIRS: DrugInteractionPair[] = [
  {
    drugA: "warfarine",
    drugB: "acide acétylsalicylique",
    severity: "critical",
    mechanism: "Inhibition plaquettaire + anticoagulation",
    clinicalEffect: "Risque hémorragique majeur",
    recommendation: "Association contre-indiquée. Utiliser le paracétamol.",
  },
  {
    drugA: "warfarine",
    drugB: "ibuprofène",
    severity: "critical",
    mechanism: "AINS + anticoagulant",
    clinicalEffect: "Risque hémorragique gastro-intestinal majoré",
    recommendation: "Association contre-indiquée. Privilégier le paracétamol.",
  },
  {
    drugA: "warfarine",
    drugB: "ciprofloxacine",
    severity: "critical",
    mechanism: "Inhibition CYP1A2",
    clinicalEffect: "Augmentation significative de l'effet anticoagulant",
    recommendation: "Réduire la dose de warfarine, surveiller l'INR quotidiennement.",
  },
  {
    drugA: "warfarine",
    drugB: "métronidazole",
    severity: "major",
    mechanism: "Inhibition métabolique",
    clinicalEffect: "Augmentation de l'effet anticoagulant",
    recommendation: "Surveiller l'INR étroitement. Ajuster la dose si nécessaire.",
  },
  {
    drugA: "warfarine",
    drugB: "amoxicilline",
    severity: "minor",
    mechanism: "Altération de la flore intestinale",
    clinicalEffect: "Modification possible de l'absorption de la vitamine K",
    recommendation: "Surveiller l'INR pendant le traitement antibiotique.",
  },
  {
    drugA: "metformine",
    drugB: "produit de contraste iodé",
    severity: "critical",
    mechanism: "Insuffisance rénale aiguë",
    clinicalEffect: "Risque d'acidose lactique potentiellement fatale",
    recommendation: "Arrêter la metformine 48h avant et après l'examen.",
  },
  {
    drugA: "clopidogrel",
    drugB: "oméprazole",
    severity: "major",
    mechanism: "Inhibition CYP2C19",
    clinicalEffect: "Réduction de la conversion en métabolite actif",
    recommendation: "Préférer le pantoprazole comme IPP alternatif.",
  },
  {
    drugA: "lithium",
    drugB: "ibuprofène",
    severity: "critical",
    mechanism: "Réduction de la clairance rénale du lithium",
    clinicalEffect: "Risque de toxicité au lithium",
    recommendation: "Association contre-indiquée. Si nécessaire, surveiller la lithiémie.",
  },
  {
    drugA: "digoxine",
    drugB: "amiodarone",
    severity: "critical",
    mechanism: "Inhibition de la P-glycoprotéine",
    clinicalEffect: "Augmentation de la digoxinémie, risque de toxicité",
    recommendation: "Réduire la dose de digoxine de 50%. Surveiller la digoxinémie.",
  },
  {
    drugA: "simvastatine",
    drugB: "amiodarone",
    severity: "major",
    mechanism: "Inhibition CYP3A4",
    clinicalEffect: "Risque de rhabdomyolyse",
    recommendation: "Ne pas dépasser 20mg de simvastatine. Envisager une autre statine.",
  },
  {
    drugA: "méthotrexate",
    drugB: "triméthoprime",
    severity: "critical",
    mechanism: "Double inhibition du folate",
    clinicalEffect: "Risque de pancytopénie sévère",
    recommendation: "Association contre-indiquée.",
  },
  {
    drugA: "insuline glargine",
    drugB: "bisoprolol",
    severity: "minor",
    mechanism: "Masquage des signes d'hypoglycémie",
    clinicalEffect: "Tachycardie et tremblements masqués",
    recommendation: "Renforcer l'autosurveillance glycémique.",
  },
];

// ── Cross-reactivity map (allergy → contraindicated drugs) ──

const CROSS_REACTIVITY: Record<string, string[]> = {
  pénicilline: ["amoxicilline", "ampicilline", "pipéracilline"],
  amoxicilline: ["pénicilline", "ampicilline"],
  aspirine: ["acide acétylsalicylique"],
  "acide acétylsalicylique": ["aspirine"],
  sulfonamide: ["sulfaméthoxazole", "sulfasalazine"],
  céphalosporine: ["céfazoline", "ceftriaxone", "céfixime"],
};

const SEVERITY_ORDER: Record<InteractionSeverity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

function findInteraction(drugA: string, drugB: string): DrugInteractionPair | undefined {
  const a = normalize(drugA);
  const b = normalize(drugB);

  return INTERACTION_PAIRS.find(
    (pair) =>
      (normalize(pair.drugA) === a && normalize(pair.drugB) === b) ||
      (normalize(pair.drugA) === b && normalize(pair.drugB) === a),
  );
}

function isCrossReactive(drug: string, allergy: string): boolean {
  const normalizedDrug = normalize(drug);
  const normalizedAllergy = normalize(allergy);

  if (normalizedDrug === normalizedAllergy) return true;

  const crossReactive = CROSS_REACTIVITY[normalizedAllergy];
  if (crossReactive?.some((d) => normalize(d) === normalizedDrug)) return true;

  const drugCrossReactive = CROSS_REACTIVITY[normalizedDrug];
  if (drugCrossReactive?.some((d) => normalize(d) === normalizedAllergy)) return true;

  return false;
}

/**
 * Check a new drug against current medications and allergies.
 *
 * Returns severity-sorted InteractionAlert[].
 * Bidirectional: if A interacts with B, B interacts with A.
 */
export function checkInteractions(
  newDrug: string,
  currentMedications: string[],
  allergyList: string[],
): InteractionAlert[] {
  if (!newDrug) return [];

  const alerts: InteractionAlert[] = [];

  for (const current of currentMedications) {
    const interaction = findInteraction(newDrug, current);
    if (interaction) {
      alerts.push({
        severity: interaction.severity,
        pair: [newDrug, current],
        message: interaction.clinicalEffect,
        recommendation: interaction.recommendation,
      });
    }
  }

  for (const allergy of allergyList) {
    if (isCrossReactive(newDrug, allergy)) {
      alerts.push({
        severity: "critical",
        pair: [newDrug, allergy],
        message: `Réactivité croisée avec allergie documentée : ${allergy}`,
        recommendation: "Ne pas prescrire sans consultation allergologique",
      });
    }
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export { INTERACTION_PAIRS, CROSS_REACTIVITY };
