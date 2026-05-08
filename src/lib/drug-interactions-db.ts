/**
 * Drug Interaction Database — Common Drug-Drug Interactions
 *
 * Contains known drug-drug interactions relevant to the Moroccan pharmacopeia.
 * Each entry describes a pair of drugs (by DCI name), the severity level,
 * and a description in French.
 *
 * Severity levels:
 * - "dangerous" (Red): Contraindicated — must not be combined
 * - "caution" (Yellow): Use with caution — monitor closely
 * - "safe" (Green): No known significant interaction
 *
 * Data sources: ANSM (France), Vidal, WHO Essential Medicines interactions.
 */

// ── Types ──

export type InteractionSeverity = "dangerous" | "caution" | "safe";

export interface DrugInteraction {
  /** First drug DCI name (normalized to lowercase for matching) */
  drugA: string;
  /** Second drug DCI name (normalized to lowercase for matching) */
  drugB: string;
  /** Severity level */
  severity: InteractionSeverity;
  /** Description in French */
  description: string;
  /** Clinical recommendation in French */
  recommendation: string;
}

// ── Interaction Database ──

export const DRUG_INTERACTIONS: DrugInteraction[] = [
  // ── Anticoagulants / Antiplatelets ──
  {
    drugA: "warfarine",
    drugB: "acide acétylsalicylique",
    severity: "dangerous",
    description: "Risque hémorragique majeur. L'aspirine potentialise l'effet anticoagulant de la warfarine et inhibe l'agrégation plaquettaire.",
    recommendation: "Association contre-indiquée. Utiliser un autre antalgique (paracétamol).",
  },
  {
    drugA: "warfarine",
    drugB: "ibuprofène",
    severity: "dangerous",
    description: "Les AINS augmentent le risque hémorragique gastro-intestinal et potentialisent l'effet anticoagulant.",
    recommendation: "Association contre-indiquée. Privilégier le paracétamol pour l'analgésie.",
  },
  {
    drugA: "warfarine",
    drugB: "diclofénac",
    severity: "dangerous",
    description: "Les AINS augmentent le risque hémorragique gastro-intestinal et potentialisent l'effet anticoagulant.",
    recommendation: "Association contre-indiquée. Privilégier le paracétamol.",
  },
  {
    drugA: "warfarine",
    drugB: "métronidazole",
    severity: "caution",
    description: "Le métronidazole inhibe le métabolisme de la warfarine, augmentant son effet anticoagulant.",
    recommendation: "Surveiller l'INR étroitement. Ajuster la dose de warfarine si nécessaire.",
  },
  {
    drugA: "warfarine",
    drugB: "amoxicilline",
    severity: "caution",
    description: "Les antibiotiques peuvent altérer la flore intestinale et modifier l'absorption de la vitamine K.",
    recommendation: "Surveiller l'INR pendant et après le traitement antibiotique.",
  },
  {
    drugA: "warfarine",
    drugB: "ciprofloxacine",
    severity: "dangerous",
    description: "La ciprofloxacine inhibe fortement le CYP1A2, augmentant significativement l'effet de la warfarine.",
    recommendation: "Association déconseillée. Si nécessaire, réduire la dose de warfarine et surveiller l'INR quotidiennement.",
  },
  {
    drugA: "clopidogrel",
    drugB: "oméprazole",
    severity: "caution",
    description: "L'oméprazole inhibe le CYP2C19, réduisant la conversion du clopidogrel en métabolite actif.",
    recommendation: "Préférer le pantoprazole comme IPP alternatif.",
  },
  {
    drugA: "acide acétylsalicylique",
    drugB: "ibuprofène",
    severity: "caution",
    description: "L'ibuprofène peut réduire l'effet antiplaquettaire de l'aspirine à faible dose.",
    recommendation: "Prendre l'aspirine au moins 30 min avant l'ibuprofène ou 8h après.",
  },

  // ── Antidiabétiques ──
  {
    drugA: "metformine",
    drugB: "produit de contraste iodé",
    severity: "dangerous",
    description: "Risque d'acidose lactique potentiellement fatale lors de l'injection de produit de contraste iodé.",
    recommendation: "Arrêter la metformine 48h avant et après l'examen. Vérifier la fonction rénale avant reprise.",
  },
  {
    drugA: "metformine",
    drugB: "alcool",
    severity: "dangerous",
    description: "L'alcool augmente le risque d'acidose lactique avec la metformine.",
    recommendation: "Éviter la consommation d'alcool pendant le traitement.",
  },
  {
    drugA: "glibenclamide",
    drugB: "ciprofloxacine",
    severity: "caution",
    description: "Les fluoroquinolones peuvent provoquer des hypoglycémies sévères avec les sulfamides hypoglycémiants.",
    recommendation: "Renforcer l'autosurveillance glycémique pendant le traitement.",
  },
  {
    drugA: "metformine",
    drugB: "ciprofloxacine",
    severity: "caution",
    description: "Les fluoroquinolones peuvent perturber l'équilibre glycémique.",
    recommendation: "Surveiller la glycémie étroitement.",
  },
  {
    drugA: "insuline glargine",
    drugB: "bisoprolol",
    severity: "caution",
    description: "Les bêta-bloquants masquent les signes d'hypoglycémie (tachycardie, tremblements).",
    recommendation: "Éduquer le patient sur les signes d'hypoglycémie non masqués (sueurs, faim).",
  },

  // ── Cardiovasculaire ──
  {
    drugA: "ramipril",
    drugB: "losartan",
    severity: "dangerous",
    description: "Double blocage du SRAA : risque d'hyperkaliémie, insuffisance rénale et hypotension.",
    recommendation: "Association contre-indiquée. Utiliser un seul bloqueur du SRAA.",
  },
  {
    drugA: "énalapril",
    drugB: "valsartan",
    severity: "dangerous",
    description: "Double blocage du SRAA : risque d'hyperkaliémie, insuffisance rénale et hypotension.",
    recommendation: "Association contre-indiquée. Utiliser un seul bloqueur du SRAA.",
  },
  {
    drugA: "ramipril",
    drugB: "spironolactone",
    severity: "caution",
    description: "Risque d'hyperkaliémie avec l'association IEC + diurétique épargneur de potassium.",
    recommendation: "Surveiller la kaliémie et la fonction rénale régulièrement.",
  },
  {
    drugA: "amlodipine",
    drugB: "simvastatine",
    severity: "caution",
    description: "L'amlodipine augmente les concentrations de simvastatine (risque de rhabdomyolyse).",
    recommendation: "Ne pas dépasser 20 mg/jour de simvastatine avec l'amlodipine.",
  },
  {
    drugA: "digoxine",
    drugB: "amiodarone",
    severity: "dangerous",
    description: "L'amiodarone augmente la concentration plasmatique de digoxine (risque de toxicité digitale).",
    recommendation: "Réduire la dose de digoxine de 50% et surveiller la digoxinémie.",
  },
  {
    drugA: "atenolol",
    drugB: "vérapamil",
    severity: "dangerous",
    description: "Risque de bradycardie sévère, bloc AV et insuffisance cardiaque.",
    recommendation: "Association contre-indiquée. Ne pas associer bêta-bloquant et vérapamil/diltiazem.",
  },

  // ── Système nerveux ──
  {
    drugA: "tramadol",
    drugB: "fluoxétine",
    severity: "dangerous",
    description: "Risque de syndrome sérotoninergique (agitation, hyperthermie, myoclonies, diarrhée).",
    recommendation: "Association contre-indiquée. Utiliser un autre antalgique.",
  },
  {
    drugA: "tramadol",
    drugB: "paroxétine",
    severity: "dangerous",
    description: "Risque de syndrome sérotoninergique et diminution de l'efficacité du tramadol.",
    recommendation: "Association contre-indiquée. Choisir un autre antalgique.",
  },
  {
    drugA: "alprazolam",
    drugB: "codéine + paracétamol",
    severity: "caution",
    description: "Potentialisation de la dépression respiratoire et de la sédation.",
    recommendation: "Réduire les doses des deux médicaments. Surveiller la sédation.",
  },
  {
    drugA: "morphine",
    drugB: "alprazolam",
    severity: "dangerous",
    description: "Association opioïde + benzodiazépine : risque de dépression respiratoire fatale.",
    recommendation: "Association à éviter. Si indispensable, réduire les doses et surveiller étroitement.",
  },
  {
    drugA: "carbamazépine",
    drugB: "valproate de sodium",
    severity: "caution",
    description: "Interactions pharmacocinétiques complexes modifiant les niveaux des deux médicaments.",
    recommendation: "Surveiller les concentrations plasmatiques des deux antiépileptiques.",
  },

  // ── Antibiotiques ──
  {
    drugA: "amoxicilline",
    drugB: "méthotrexate",
    severity: "dangerous",
    description: "L'amoxicilline réduit l'excrétion rénale du méthotrexate, augmentant sa toxicité.",
    recommendation: "Association déconseillée. Surveiller étroitement si inévitable.",
  },
  {
    drugA: "ciprofloxacine",
    drugB: "tizanidine",
    severity: "dangerous",
    description: "La ciprofloxacine multiplie par 10 les concentrations de tizanidine (toxicité).",
    recommendation: "Association contre-indiquée.",
  },
  {
    drugA: "clarithromycine",
    drugB: "simvastatine",
    severity: "dangerous",
    description: "La clarithromycine inhibe le CYP3A4, augmentant fortement les statines (rhabdomyolyse).",
    recommendation: "Suspendre la statine pendant le traitement par clarithromycine.",
  },
  {
    drugA: "doxycycline",
    drugB: "rétinol",
    severity: "dangerous",
    description: "Association tétracycline + rétinoïdes : risque d'hypertension intracrânienne.",
    recommendation: "Association contre-indiquée.",
  },

  // ── Gastro-intestinal ──
  {
    drugA: "ciprofloxacine",
    drugB: "antiacide",
    severity: "caution",
    description: "Les antiacides contenant aluminium/magnésium réduisent l'absorption de la ciprofloxacine.",
    recommendation: "Espacer les prises d'au moins 2 heures.",
  },
  {
    drugA: "lévothyroxine",
    drugB: "oméprazole",
    severity: "caution",
    description: "Les IPP peuvent réduire l'absorption de la lévothyroxine.",
    recommendation: "Prendre la lévothyroxine 30 min avant le petit-déjeuner, à distance de l'IPP.",
  },
  {
    drugA: "lévothyroxine",
    drugB: "calcium",
    severity: "caution",
    description: "Le calcium réduit l'absorption de la lévothyroxine.",
    recommendation: "Espacer les prises d'au moins 4 heures.",
  },

  // ── Potassium / Électrolytes ──
  {
    drugA: "ramipril",
    drugB: "potassium",
    severity: "caution",
    description: "Les IEC réduisent l'excrétion du potassium ; un supplément peut provoquer une hyperkaliémie.",
    recommendation: "Surveiller la kaliémie régulièrement.",
  },
  {
    drugA: "furosémide",
    drugB: "gentamicine",
    severity: "dangerous",
    description: "Potentialisation de la néphrotoxicité et de l'ototoxicité.",
    recommendation: "Surveiller la fonction rénale et l'audition. Ajuster les doses.",
  },

  // ── AINS entre eux ──
  {
    drugA: "ibuprofène",
    drugB: "diclofénac",
    severity: "dangerous",
    description: "L'association de deux AINS multiplie le risque d'ulcère gastro-duodénal et d'hémorragie digestive.",
    recommendation: "Ne jamais associer deux AINS. Choisir un seul AINS à dose efficace.",
  },
  {
    drugA: "ibuprofène",
    drugB: "kétoprofène",
    severity: "dangerous",
    description: "L'association de deux AINS multiplie le risque d'ulcère et d'hémorragie digestive.",
    recommendation: "Ne jamais associer deux AINS.",
  },
  {
    drugA: "diclofénac",
    drugB: "naproxène",
    severity: "dangerous",
    description: "L'association de deux AINS multiplie le risque d'ulcère et d'hémorragie digestive.",
    recommendation: "Ne jamais associer deux AINS.",
  },

  // ── Corticostéroïdes ──
  {
    drugA: "prednisolone",
    drugB: "ibuprofène",
    severity: "caution",
    description: "Association corticoïde + AINS : risque accru d'ulcère gastro-duodénal.",
    recommendation: "Associer un IPP en protection gastrique.",
  },

  // ── Diurétiques ──
  {
    drugA: "furosémide",
    drugB: "ramipril",
    severity: "caution",
    description: "Risque d'hypotension orthostatique à l'initiation de l'IEC, surtout si déshydratation.",
    recommendation: "Débuter l'IEC à faible dose. Surveiller la tension artérielle.",
  },
  {
    drugA: "hydrochlorothiazide",
    drugB: "lithium",
    severity: "dangerous",
    description: "Les thiazidiques réduisent l'excrétion rénale du lithium (risque de toxicité).",
    recommendation: "Association déconseillée. Surveiller la lithiémie si association inévitable.",
  },

  // ── Anticoagulants oraux directs ──
  {
    drugA: "rivaroxaban",
    drugB: "kétoconazole",
    severity: "dangerous",
    description: "Le kétoconazole inhibe fortement le CYP3A4 et la P-gp, augmentant le rivaroxaban.",
    recommendation: "Association contre-indiquée.",
  },
  {
    drugA: "rivaroxaban",
    drugB: "acide acétylsalicylique",
    severity: "caution",
    description: "Augmentation du risque hémorragique avec l'association anticoagulant + antiplaquettaire.",
    recommendation: "Évaluer le rapport bénéfice/risque. Surveiller les signes hémorragiques.",
  },
];

// ── Search / Lookup Functions ──

/**
 * Normalize a drug name for matching: lowercase, trim, remove accents.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Check interactions between two drugs by DCI name.
 * Returns matching interactions (may be empty if none found).
 */
export function checkInteraction(drugA: string, drugB: string): DrugInteraction[] {
  const a = normalize(drugA);
  const b = normalize(drugB);

  return DRUG_INTERACTIONS.filter((interaction) => {
    const iA = normalize(interaction.drugA);
    const iB = normalize(interaction.drugB);
    return (
      (a.includes(iA) || iA.includes(a)) && (b.includes(iB) || iB.includes(b)) ||
      (a.includes(iB) || iB.includes(a)) && (b.includes(iA) || iA.includes(b))
    );
  });
}

/**
 * Check a single drug against a list of patient allergies.
 * Returns true if the drug name matches any allergy.
 */
export function checkAllergyConflict(drugName: string, allergies: string[]): string | null {
  const normalized = normalize(drugName);
  for (const allergy of allergies) {
    const normalizedAllergy = normalize(allergy);
    if (normalized.includes(normalizedAllergy) || normalizedAllergy.includes(normalized)) {
      return allergy;
    }
  }
  return null;
}
