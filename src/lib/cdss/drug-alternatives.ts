/**
 * Drug Alternative Suggestions — Moroccan Pharmacopeia
 *
 * When a drug interaction is detected, this module suggests safe
 * alternative medications that treat the same condition without
 * the problematic interaction.
 *
 * Each entry maps a drug + the interacting drug to a list of
 * alternatives with clinical rationale (in French for the Moroccan market).
 *
 * Data sources: ANSM (France), Vidal, WHO Essential Medicines.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface DrugAlternative {
  /** DCI name of the alternative drug */
  drug: string;
  /** Why this is a safe alternative (French) */
  rationale: string;
  /** Therapeutic class of the alternative */
  therapeuticClass: string;
  /** Any caveats for this alternative (French) */
  caveat?: string;
}

export interface AlternativeSuggestion {
  /** The problematic drug to replace */
  originalDrug: string;
  /** The drug it interacts with */
  interactsWith: string;
  /** List of safe alternatives */
  alternatives: DrugAlternative[];
}

// ── Alternative Mappings ─────────────────────────────────────────────────────

/**
 * Map of (drugA + drugB) → alternatives for drugA.
 * Keys are normalized: "drugA|drugB" (alphabetically sorted, lowercase).
 *
 * When an interaction is found between drugA and drugB, we look up
 * alternatives for whichever drug the doctor is newly prescribing.
 */
const ALTERNATIVES_DB: Record<string, DrugAlternative[]> = {
  // ── Anticoagulant + NSAID → switch NSAID to paracetamol ──
  "acide acetylsalicylique|warfarine": [
    {
      drug: "paracétamol",
      rationale: "Antalgique sans effet antiplaquettaire ni interaction avec la warfarine.",
      therapeuticClass: "Antalgique",
    },
    {
      drug: "tramadol",
      rationale: "Antalgique opioïde faible, pas d'interaction significative avec la warfarine.",
      therapeuticClass: "Antalgique opioïde",
      caveat: "Surveiller les signes de sédation. Éviter avec les ISRS.",
    },
  ],
  "ibuprofene|warfarine": [
    {
      drug: "paracétamol",
      rationale:
        "Alternative de première intention pour la douleur légère à modérée, sans risque hémorragique.",
      therapeuticClass: "Antalgique",
    },
    {
      drug: "tramadol",
      rationale: "Pour la douleur modérée à sévère, pas d'effet antiplaquettaire.",
      therapeuticClass: "Antalgique opioïde",
      caveat: "Risque de constipation et somnolence.",
    },
  ],
  "diclofenac|warfarine": [
    {
      drug: "paracétamol",
      rationale: "Pas d'interaction avec les anticoagulants.",
      therapeuticClass: "Antalgique",
    },
    {
      drug: "tramadol",
      rationale: "Alternative pour la douleur modérée à sévère.",
      therapeuticClass: "Antalgique opioïde",
    },
  ],

  // ── Anticoagulant + Antibiotique → switch antibiotique ──
  "ciprofloxacine|warfarine": [
    {
      drug: "amoxicilline",
      rationale:
        "Interaction mineure avec la warfarine (vs majeure pour la ciprofloxacine). Surveiller l'INR.",
      therapeuticClass: "Antibiotique (pénicilline)",
      caveat: "Vérifier l'absence d'allergie aux pénicillines.",
    },
    {
      drug: "céfixime",
      rationale: "Céphalosporine avec peu d'effet sur le métabolisme de la warfarine.",
      therapeuticClass: "Antibiotique (céphalosporine)",
    },
  ],
  "metronidazole|warfarine": [
    {
      drug: "amoxicilline",
      rationale: "Alternative pour les infections anaérobies sans inhibition métabolique majeure.",
      therapeuticClass: "Antibiotique",
      caveat: "Couverture anaérobie limitée — associer si nécessaire.",
    },
  ],

  // ── Metformine + Produit de contraste ──
  "metformine|produit de contraste iode": [
    {
      drug: "insuline glargine",
      rationale:
        "Couverture glycémique temporaire pendant la suspension de la metformine (48h avant et après).",
      therapeuticClass: "Insuline basale",
      caveat: "Nécessite éducation du patient et surveillance glycémique rapprochée.",
    },
    {
      drug: "sitagliptine",
      rationale: "Inhibiteur DPP-4 sans risque d'acidose lactique.",
      therapeuticClass: "Antidiabétique (iDPP4)",
      caveat: "Efficacité glycémique moindre que la metformine.",
    },
  ],

  // ── Clopidogrel + Oméprazole → switch IPP ──
  "clopidogrel|omeprazole": [
    {
      drug: "pantoprazole",
      rationale: "IPP alternatif sans inhibition significative du CYP2C19.",
      therapeuticClass: "Inhibiteur de la pompe à protons",
    },
    {
      drug: "famotidine",
      rationale: "Anti-H2 sans interaction avec le CYP2C19.",
      therapeuticClass: "Anti-H2",
      caveat: "Efficacité moindre que les IPP pour le RGO sévère.",
    },
  ],

  // ── Lithium + NSAID ──
  "ibuprofene|lithium": [
    {
      drug: "paracétamol",
      rationale: "Pas d'effet sur la clairance rénale du lithium.",
      therapeuticClass: "Antalgique",
    },
  ],

  // ── Digoxine + Amiodarone ──
  "amiodarone|digoxine": [
    {
      drug: "bisoprolol",
      rationale:
        "Contrôle de la fréquence cardiaque sans inhibition de la P-glycoprotéine. Alternative si l'objectif est le contrôle de la FC.",
      therapeuticClass: "Bêta-bloquant",
      caveat: "Contre-indiqué en cas d'insuffisance cardiaque décompensée.",
    },
  ],

  // ── Simvastatine + Amiodarone → switch statine ──
  "amiodarone|simvastatine": [
    {
      drug: "rosuvastatine",
      rationale: "Non métabolisée par le CYP3A4, pas d'interaction avec l'amiodarone.",
      therapeuticClass: "Statine",
    },
    {
      drug: "pravastatine",
      rationale: "Non métabolisée par le CYP3A4, profil d'interactions favorable.",
      therapeuticClass: "Statine",
    },
  ],

  // ── Méthotrexate + Triméthoprime ──
  "methotrexate|trimethoprime": [
    {
      drug: "amoxicilline",
      rationale: "Antibiotique sans effet antifolate.",
      therapeuticClass: "Antibiotique (pénicilline)",
      caveat:
        "Vérifier que l'amoxicilline couvre le pathogène ciblé et l'absence d'allergie aux pénicillines.",
    },
    {
      drug: "nitrofurantoïne",
      rationale: "Pour les infections urinaires simples, sans interaction avec le méthotrexate.",
      therapeuticClass: "Antibiotique urinaire",
      caveat: "Uniquement pour les infections urinaires basses.",
    },
  ],

  // ── Double AINS ──
  "diclofenac|ibuprofene": [
    {
      drug: "paracétamol",
      rationale: "Remplacer un des deux AINS par un antalgique non anti-inflammatoire.",
      therapeuticClass: "Antalgique",
    },
  ],
  "ibuprofene|ketoprofene": [
    {
      drug: "paracétamol",
      rationale:
        "Ne jamais associer deux AINS. Le paracétamol est l'alternative de première intention.",
      therapeuticClass: "Antalgique",
    },
  ],
  "diclofenac|naproxene": [
    {
      drug: "paracétamol",
      rationale: "Ne jamais associer deux AINS.",
      therapeuticClass: "Antalgique",
    },
  ],

  // ── Tramadol + SSRI → switch antalgique ──
  "fluoxetine|tramadol": [
    {
      drug: "paracétamol",
      rationale: "Pas de risque de syndrome sérotoninergique.",
      therapeuticClass: "Antalgique",
    },
    {
      drug: "codéine + paracétamol",
      rationale: "Opioïde faible sans effet sérotoninergique significatif.",
      therapeuticClass: "Antalgique opioïde",
      caveat: "Métabolisation via CYP2D6 — efficacité variable.",
    },
  ],
  "paroxetine|tramadol": [
    {
      drug: "paracétamol",
      rationale: "Pas de risque de syndrome sérotoninergique.",
      therapeuticClass: "Antalgique",
    },
    {
      drug: "codéine + paracétamol",
      rationale: "Alternative pour la douleur modérée sans effet sérotoninergique.",
      therapeuticClass: "Antalgique opioïde",
    },
  ],

  // ── Opioïde + Benzodiazépine ──
  "alprazolam|morphine": [
    {
      drug: "hydroxyzine",
      rationale: "Anxiolytique non benzodiazépinique avec moins de dépression respiratoire.",
      therapeuticClass: "Anxiolytique (antihistaminique)",
      caveat: "Sédation possible — ajuster la dose.",
    },
  ],

  // ── Double blocage SRAA ──
  "losartan|ramipril": [
    {
      drug: "amlodipine",
      rationale:
        "Inhibiteur calcique pour le contrôle tensionnel additionnel sans double blocage SRAA.",
      therapeuticClass: "Inhibiteur calcique",
    },
    {
      drug: "hydrochlorothiazide",
      rationale: "Diurétique thiazidique pour le contrôle tensionnel complémentaire.",
      therapeuticClass: "Diurétique",
      caveat: "Surveiller la kaliémie et la natrémie.",
    },
  ],
  "enalapril|valsartan": [
    {
      drug: "amlodipine",
      rationale: "Inhibiteur calcique sûr à associer avec un IEC ou un ARA2 (mais pas les deux).",
      therapeuticClass: "Inhibiteur calcique",
    },
  ],

  // ── Bêta-bloquant + Vérapamil ──
  "atenolol|verapamil": [
    {
      drug: "amlodipine",
      rationale: "Dihydropyridine — pas de risque de bloc AV contrairement au vérapamil/diltiazem.",
      therapeuticClass: "Inhibiteur calcique (dihydropyridine)",
    },
  ],

  // ── Clarithromycine + Statine ──
  "clarithromycine|simvastatine": [
    {
      drug: "azithromycine",
      rationale: "Macrolide avec beaucoup moins d'inhibition du CYP3A4.",
      therapeuticClass: "Antibiotique (macrolide)",
    },
    {
      drug: "rosuvastatine",
      rationale: "Statine non métabolisée par le CYP3A4.",
      therapeuticClass: "Statine",
      caveat: "Alternative pour la statine plutôt que l'antibiotique.",
    },
  ],

  // ── Hydrochlorothiazide + Lithium ──
  "hydrochlorothiazide|lithium": [
    {
      drug: "furosémide",
      rationale:
        "Diurétique de l'anse avec moins d'effet sur la réabsorption du lithium que les thiazidiques.",
      therapeuticClass: "Diurétique de l'anse",
      caveat: "Surveiller la lithiémie malgré un risque moindre.",
    },
  ],

  // ── Rivaroxaban + Kétoconazole ──
  "ketoconazole|rivaroxaban": [
    {
      drug: "fluconazole",
      rationale: "Antifongique azolé avec une inhibition CYP3A4 plus faible.",
      therapeuticClass: "Antifongique",
      caveat: "Surveiller les signes hémorragiques. Envisager une réduction de dose.",
    },
  ],

  // ── Furosémide + Gentamicine ──
  "furosemide|gentamicine": [
    {
      drug: "amikacine",
      rationale:
        "Aminoside alternatif — la néphrotoxicité persiste mais la coadministration avec le furosémide est mieux documentée.",
      therapeuticClass: "Antibiotique (aminoside)",
      caveat:
        "L'ototoxicité et la néphrotoxicité restent possibles. Surveiller les taux sériques et la fonction rénale.",
    },
  ],
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Normalize a drug name for DB key lookup:
 * lowercase, trim, strip accents, strip whitespace for key matching.
 */
function normalizeForKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Build the lookup key for a drug pair.
 * Alphabetically sorted to make lookups bidirectional.
 */
function pairKey(drugA: string, drugB: string): string {
  const a = normalizeForKey(drugA);
  const b = normalizeForKey(drugB);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Suggest safe alternative drugs when an interaction is detected.
 *
 * @param drug - The drug to find alternatives for
 * @param interactsWith - The drug it interacts with
 * @returns Suggestion with alternatives, or null if no alternatives known
 */
export function suggestAlternatives(
  drug: string,
  interactsWith: string,
): AlternativeSuggestion | null {
  const key = pairKey(drug, interactsWith);
  const alternatives = ALTERNATIVES_DB[key];

  if (!alternatives || alternatives.length === 0) {
    return null;
  }

  return {
    originalDrug: drug,
    interactsWith,
    alternatives,
  };
}

/**
 * Batch-check: given a list of drug pairs with interactions,
 * return all available alternative suggestions.
 */
export function suggestAllAlternatives(
  interactingPairs: Array<{ drugA: string; drugB: string }>,
): AlternativeSuggestion[] {
  const suggestions: AlternativeSuggestion[] = [];

  for (const pair of interactingPairs) {
    // pairKey() is symmetric, so a single lookup covers both orderings.
    // Prefer drugA as the "originalDrug" the doctor is replacing; if drugA
    // has no entry, fall back to drugB.
    const suggestion =
      suggestAlternatives(pair.drugA, pair.drugB) ?? suggestAlternatives(pair.drugB, pair.drugA);
    if (suggestion) suggestions.push(suggestion);
  }

  return suggestions;
}
