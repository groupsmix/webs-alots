/**
 * Oltigo Clinical Knowledge Pack — runtime loader.
 *
 * Edge-compatible: no `fs`, no native bindings, no FAISS/ChromaDB.
 * Data is inlined from the authoritative CSV files in this directory.
 * To update data, edit the CSV and then update the corresponding
 * constant below, then bump PACK_VERSION.
 *
 * Exports:
 *   lookupDrugInteraction(drugA, drugB) — exact then fuzzy match
 *   lookupDarijaTerms(query)           — search Darija/FR/AR terms
 *   getTaxonomyTags()                  — all triage taxonomy tags
 *   getTaxonomyTag(tag)                — single tag by key
 *   formatDrugInteractionForTool(r)    — LLM-ready string with version stamp
 *
 * Source CSVs (authoritative, human-editable):
 *   ./drug-interactions.csv
 *   ./darija-medical-terms.csv
 *   ./triage-taxonomy.csv
 */

// ── Pack metadata ─────────────────────────────────────────────────────────────

export const PACK_VERSION = "1.0.0";
export const PACK_BUILT_AT = "2026-06-20";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DrugInteractionSeverity = "minor" | "moderate" | "major" | "contraindicated";

export interface DrugInteraction {
  drugA: string;
  drugB: string;
  severity: DrugInteractionSeverity;
  mechanism: string;
  consequence: string;
  recommendation: string;
}

export interface DarijaTerm {
  /** Primary Darija term (Arabic-script transliteration or Latin) */
  darijaTerms: string[];
  frTerm: string;
  arTerm: string;
  category: "anatomy" | "symptom" | "medication" | "procedure";
}

export interface TaxonomyTag {
  tag: string;
  labelFr: string;
  labelAr: string;
  description: string;
  /** 0.0 = low-urgency signal, 1.0 = critical-urgency signal */
  urgencyWeight: number;
}

// ── Normalisation helper ──────────────────────────────────────────────────────

/** Strip diacritics, lowercase, and trim for fuzzy comparison. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-\s]+/g, " ")
    .trim();
}

/** Returns true when a matches b: exact, or each contains the other. */
function fuzzyMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ── Drug Interaction data ─────────────────────────────────────────────────────
// Source: drug-interactions.csv (26 pairs)

const DRUG_INTERACTIONS: DrugInteraction[] = [
  {
    drugA: "warfarin",
    drugB: "aspirin",
    severity: "major",
    mechanism: "Synergistic inhibition of platelet aggregation",
    consequence: "Significantly increased bleeding risk",
    recommendation: "Avoid combination or monitor INR closely; use lowest effective aspirin dose",
  },
  {
    drugA: "warfarin",
    drugB: "ibuprofen",
    severity: "major",
    mechanism: "NSAID inhibits platelet function and displaces warfarin from protein binding",
    consequence: "Major bleeding risk including GI haemorrhage",
    recommendation:
      "Avoid NSAIDs; use paracetamol for pain relief instead; monitor INR if unavoidable",
  },
  {
    drugA: "warfarin",
    drugB: "rifampicin",
    severity: "major",
    mechanism: "Rifampicin strongly induces CYP2C9 and CYP3A4",
    consequence: "Markedly reduced anticoagulant effect leading to thrombosis risk",
    recommendation:
      "Avoid combination; if unavoidable increase warfarin dose significantly and monitor INR daily",
  },
  {
    drugA: "warfarin",
    drugB: "fluconazole",
    severity: "major",
    mechanism: "Fluconazole potently inhibits CYP2C9 reducing warfarin metabolism",
    consequence: "Markedly elevated INR and major bleeding risk",
    recommendation:
      "Avoid fluconazole in warfarin patients; if needed reduce warfarin dose by 50% and monitor INR daily",
  },
  {
    drugA: "metformin",
    drugB: "contrast dye",
    severity: "moderate",
    mechanism: "IV contrast can impair renal function causing metformin accumulation",
    consequence: "Risk of lactic acidosis particularly with pre-existing renal impairment",
    recommendation:
      "Hold metformin 48h before contrast; restart only when renal function confirmed normal",
  },
  {
    drugA: "sildenafil",
    drugB: "nitrate",
    severity: "contraindicated",
    mechanism: "Additive vasodilation via cGMP and cAMP pathways",
    consequence: "Severe hypotension cardiovascular collapse and death",
    recommendation:
      "Absolutely contraindicated; do not administer within 24h of sildenafil (48h for tadalafil)",
  },
  {
    drugA: "tadalafil",
    drugB: "nitrate",
    severity: "contraindicated",
    mechanism: "Additive vasodilation via cGMP and cAMP pathways",
    consequence: "Severe hypotension cardiovascular collapse and death",
    recommendation: "Absolutely contraindicated; do not administer within 48h of tadalafil",
  },
  {
    drugA: "ssri",
    drugB: "maoi",
    severity: "contraindicated",
    mechanism: "Serotonin accumulation due to dual inhibition of reuptake and metabolism",
    consequence:
      "Potentially fatal serotonin syndrome with hyperthermia rigidity and rhabdomyolysis",
    recommendation:
      "Contraindicated; wait at least 14 days after stopping MAOI before starting SSRI",
  },
  {
    drugA: "tramadol",
    drugB: "ssri",
    severity: "major",
    mechanism: "Additive serotonergic effect and lowered seizure threshold",
    consequence: "Serotonin syndrome and seizure risk",
    recommendation:
      "Avoid combination; if necessary monitor closely for tremor agitation and hyperthermia",
  },
  {
    drugA: "tramadol",
    drugB: "maoi",
    severity: "contraindicated",
    mechanism: "Additive serotonergic and noradrenergic effect",
    consequence: "Severe serotonin syndrome hyperpyrexia and cardiovascular instability",
    recommendation: "Absolutely contraindicated",
  },
  {
    drugA: "digoxin",
    drugB: "amiodarone",
    severity: "major",
    mechanism: "Amiodarone inhibits P-glycoprotein reducing digoxin clearance",
    consequence: "Digoxin toxicity with bradycardia arrhythmia visual disturbances and nausea",
    recommendation:
      "Reduce digoxin dose by 50% when starting amiodarone; monitor digoxin levels closely",
  },
  {
    drugA: "ace inhibitor",
    drugB: "spironolactone",
    severity: "major",
    mechanism: "Combined potassium retention via dual renin-angiotensin-aldosterone blockade",
    consequence: "Life-threatening hyperkalemia causing cardiac arrest",
    recommendation: "Avoid or monitor serum potassium weekly; reduce spironolactone dose",
  },
  {
    drugA: "ciprofloxacin",
    drugB: "antacid",
    severity: "moderate",
    mechanism: "Divalent cations chelate fluoroquinolone in GI tract",
    consequence: "Reduced ciprofloxacin absorption by up to 90%",
    recommendation: "Administer ciprofloxacin 2h before or 6h after antacids, dairy, or iron",
  },
  {
    drugA: "simvastatin",
    drugB: "clarithromycin",
    severity: "major",
    mechanism: "Clarithromycin strongly inhibits CYP3A4 causing statin accumulation",
    consequence: "Rhabdomyolysis with myopathy and acute renal failure",
    recommendation:
      "Switch to pravastatin or rosuvastatin; do not exceed simvastatin 10mg with CYP3A4 inhibitors",
  },
  {
    drugA: "atorvastatin",
    drugB: "clarithromycin",
    severity: "major",
    mechanism: "Clarithromycin strongly inhibits CYP3A4 causing statin accumulation",
    consequence: "Rhabdomyolysis with myopathy and acute renal failure",
    recommendation: "Temporarily withhold statin or use lowest dose during clarithromycin course",
  },
  {
    drugA: "methotrexate",
    drugB: "naproxen",
    severity: "major",
    mechanism: "NSAIDs reduce renal clearance of methotrexate",
    consequence: "Methotrexate toxicity with mucositis cytopenias and hepatotoxicity",
    recommendation: "Avoid NSAIDs within 24h of methotrexate; use paracetamol if analgesic needed",
  },
  {
    drugA: "methotrexate",
    drugB: "ibuprofen",
    severity: "major",
    mechanism: "NSAIDs reduce renal clearance of methotrexate",
    consequence: "Methotrexate toxicity with mucositis cytopenias and hepatotoxicity",
    recommendation: "Avoid NSAIDs within 24h of methotrexate; use paracetamol if analgesic needed",
  },
  {
    drugA: "carbamazepine",
    drugB: "oral contraceptive",
    severity: "major",
    mechanism: "Carbamazepine induces CYP3A4 reducing ethinylestradiol and progestin levels",
    consequence: "Contraceptive failure and unintended pregnancy",
    recommendation:
      "Use additional non-hormonal contraception; consider alternative anticonvulsant",
  },
  {
    drugA: "lithium",
    drugB: "ibuprofen",
    severity: "major",
    mechanism: "NSAIDs reduce renal prostaglandin synthesis impairing lithium excretion",
    consequence: "Lithium toxicity with tremor nausea polyuria confusion and cardiac arrhythmia",
    recommendation: "Avoid NSAIDs; use paracetamol; monitor lithium levels if NSAID unavoidable",
  },
  {
    drugA: "clopidogrel",
    drugB: "omeprazole",
    severity: "moderate",
    mechanism:
      "Omeprazole inhibits CYP2C19 reducing conversion of clopidogrel to active metabolite",
    consequence: "Reduced antiplatelet effect increasing cardiovascular event risk",
    recommendation: "Switch to pantoprazole or rabeprazole which have less CYP2C19 inhibition",
  },
  {
    drugA: "codeine",
    drugB: "benzodiazepine",
    severity: "major",
    mechanism: "Additive CNS and respiratory depression",
    consequence: "Severe respiratory depression apnea and death",
    recommendation: "Avoid combination; if opioid needed use lowest dose and monitor closely",
  },
  {
    drugA: "codeine",
    drugB: "alcohol",
    severity: "moderate",
    mechanism: "Additive CNS and respiratory depression",
    consequence: "Enhanced sedation respiratory depression and risk of overdose",
    recommendation: "Avoid alcohol during codeine therapy; counsel patients explicitly",
  },
  {
    drugA: "ciprofloxacin",
    drugB: "tizanidine",
    severity: "contraindicated",
    mechanism: "Ciprofloxacin strongly inhibits CYP1A2 causing massive tizanidine accumulation",
    consequence: "Severe hypotension bradycardia and excessive sedation",
    recommendation: "Absolutely contraindicated; use alternative antibiotic",
  },
  {
    drugA: "tamoxifen",
    drugB: "paroxetine",
    severity: "major",
    mechanism:
      "Paroxetine strongly inhibits CYP2D6 blocking conversion of tamoxifen to active endoxifen",
    consequence: "Reduced tamoxifen efficacy increasing breast cancer recurrence risk",
    recommendation:
      "Avoid paroxetine and fluoxetine in tamoxifen patients; use escitalopram or venlafaxine instead",
  },
  {
    drugA: "ace inhibitor",
    drugB: "ibuprofen",
    severity: "moderate",
    mechanism:
      "NSAIDs reduce prostaglandin-dependent renal vasodilation and blunt ACE inhibitor effect",
    consequence: "Acute kidney injury and reduced antihypertensive effect",
    recommendation:
      "Avoid NSAIDs; if unavoidable monitor renal function and blood pressure closely",
  },
  {
    drugA: "phenytoin",
    drugB: "omeprazole",
    severity: "minor",
    mechanism: "Omeprazole modestly inhibits CYP2C19 increasing phenytoin levels",
    consequence: "Mild phenytoin toxicity risk with nystagmus and ataxia at high levels",
    recommendation: "Monitor phenytoin levels periodically; interaction usually manageable",
  },
];

// ── Darija Medical Terms data ─────────────────────────────────────────────────
// Source: darija-medical-terms.csv (37 terms)

const DARIJA_TERMS: DarijaTerm[] = [
  {
    darijaTerms: ["ras", "rass", "rasna"],
    frTerm: "tête / mal de tête",
    arTerm: "رأس",
    category: "anatomy",
  },
  { darijaTerms: ["kelb", "galb", "galbna"], frTerm: "cœur", arTerm: "قلب", category: "anatomy" },
  { darijaTerms: ["sder"], frTerm: "poitrine / thorax", arTerm: "صدر", category: "anatomy" },
  {
    darijaTerms: ["botna", "btne", "krch", "kerch"],
    frTerm: "ventre / abdomen",
    arTerm: "بطن",
    category: "anatomy",
  },
  { darijaTerms: ["dhar"], frTerm: "dos / colonne vertébrale", arTerm: "ظهر", category: "anatomy" },
  { darijaTerms: ["yed", "yad", "yadi"], frTerm: "main / bras", arTerm: "يد", category: "anatomy" },
  {
    darijaTerms: ["rijel", "rjel", "rejl"],
    frTerm: "jambe / pied",
    arTerm: "رجل",
    category: "anatomy",
  },
  {
    darijaTerms: ["wdna", "wdane", "widne", "oud en"],
    frTerm: "oreille",
    arTerm: "أذن",
    category: "anatomy",
  },
  {
    darijaTerms: ["3in", "3ioun", "ain"],
    frTerm: "œil / yeux",
    arTerm: "عين",
    category: "anatomy",
  },
  { darijaTerms: ["anf", "nif"], frTerm: "nez", arTerm: "أنف", category: "anatomy" },
  {
    darijaTerms: ["halq", "hnouch"],
    frTerm: "gorge / cou",
    arTerm: "حلق / رقبة",
    category: "anatomy",
  },
  {
    darijaTerms: ["sna", "snane", "snan"],
    frTerm: "dent / dentition",
    arTerm: "سن",
    category: "anatomy",
  },
  { darijaTerms: ["lisan"], frTerm: "langue", arTerm: "لسان", category: "anatomy" },
  { darijaTerms: ["kbda"], frTerm: "foie", arTerm: "كبد", category: "anatomy" },
  {
    darijaTerms: ["klawi", "klawy"],
    frTerm: "reins / rein",
    arTerm: "كليتان",
    category: "anatomy",
  },
  {
    darijaTerms: ["rkba", "rkuba", "rkabna"],
    frTerm: "genou",
    arTerm: "ركبة",
    category: "anatomy",
  },
  { darijaTerms: ["moukh"], frTerm: "cerveau / tête", arTerm: "مخ", category: "anatomy" },
  { darijaTerms: ["rida"], frTerm: "poumon", arTerm: "رئة", category: "anatomy" },
  { darijaTerms: ["me3da"], frTerm: "estomac", arTerm: "معدة", category: "anatomy" },
  { darijaTerms: ["ferda"], frTerm: "cuisse / hanche", arTerm: "فخذ", category: "anatomy" },
  {
    darijaTerms: ["skhana", "skhona", "shkha", "sokhan"],
    frTerm: "fièvre",
    arTerm: "حمى",
    category: "symptom",
  },
  { darijaTerms: ["wed3", "wdaa", "w daa"], frTerm: "douleur", arTerm: "وجع", category: "symptom" },
  { darijaTerms: ["berd"], frTerm: "rhume / froid", arTerm: "برد", category: "symptom" },
  {
    darijaTerms: ["wahd blissa", "bli", "blissa", "8tayan"],
    frTerm: "nausée / envie de vomir",
    arTerm: "غثيان",
    category: "symptom",
  },
  {
    darijaTerms: ["hdiq", "hdiqa", "shhal"],
    frTerm: "diarrhée",
    arTerm: "إسهال",
    category: "symptom",
  },
  { darijaTerms: ["imsak"], frTerm: "constipation", arTerm: "إمساك", category: "symptom" },
  {
    darijaTerms: ["3wara", "3ouara", "7riq"],
    frTerm: "brûlures / irritation",
    arTerm: "حرقان",
    category: "symptom",
  },
  {
    darijaTerms: ["dawekha", "dawkha", "ldawkha"],
    frTerm: "vertiges / étourdissements",
    arTerm: "دوخة",
    category: "symptom",
  },
  {
    darijaTerms: ["7rira", "hrira", "7kka"],
    frTerm: "démangeaisons",
    arTerm: "حكة",
    category: "symptom",
  },
  {
    darijaTerms: ["chwat", "shwat"],
    frTerm: "crampe / spasme",
    arTerm: "تشنج",
    category: "symptom",
  },
  {
    darijaTerms: ["dwa", "dwiya", "adwiya", "l dwa"],
    frTerm: "médicament / traitement",
    arTerm: "دواء",
    category: "medication",
  },
  {
    darijaTerms: ["ibra", "ibrat"],
    frTerm: "injection / piqûre",
    arTerm: "حقنة",
    category: "procedure",
  },
  {
    darijaTerms: ["tahlil", "tahlilat", "bilan"],
    frTerm: "analyse / bilan sanguin",
    arTerm: "تحليل",
    category: "procedure",
  },
  {
    darijaTerms: ["radio", "radiyo", "echographie"],
    frTerm: "radiographie / échographie",
    arTerm: "أشعة",
    category: "procedure",
  },
  {
    darijaTerms: ["3maliya", "3maliyat", "opération"],
    frTerm: "opération / chirurgie",
    arTerm: "عملية جراحية",
    category: "procedure",
  },
  {
    darijaTerms: ["dkhoul", "dkhoul l spital"],
    frTerm: "hospitalisation",
    arTerm: "دخول للمستشفى",
    category: "procedure",
  },
  {
    darijaTerms: ["tasdir", "tsdira"],
    frTerm: "ordonnance / prescription",
    arTerm: "وصفة طبية",
    category: "procedure",
  },
];

// ── Triage Taxonomy data ──────────────────────────────────────────────────────
// Source: triage-taxonomy.csv (12 tags)
// Must stay in sync with TRIAGE_TAGS in src/lib/ai/triage.ts

const TAXONOMY_TAGS: TaxonomyTag[] = [
  {
    tag: "billing",
    labelFr: "Facturation",
    labelAr: "الفاتورة",
    description: "Questions et litiges concernant la facturation et les paiements",
    urgencyWeight: 0.2,
  },
  {
    tag: "technical",
    labelFr: "Problème technique",
    labelAr: "مشكلة تقنية",
    description: "Dysfonctionnements techniques sur la plateforme Oltigo",
    urgencyWeight: 0.4,
  },
  {
    tag: "onboarding",
    labelFr: "Intégration / Inscription",
    labelAr: "تأهيل",
    description: "Questions liées à l'inscription et à la configuration initiale",
    urgencyWeight: 0.2,
  },
  {
    tag: "whatsapp",
    labelFr: "WhatsApp",
    labelAr: "واتساب",
    description: "Problèmes liés à l'intégration ou l'envoi de messages WhatsApp",
    urgencyWeight: 0.3,
  },
  {
    tag: "account_access",
    labelFr: "Accès au compte",
    labelAr: "الوصول للحساب",
    description: "Impossibilité d'accéder au compte (mot de passe oublié, verrou)",
    urgencyWeight: 0.5,
  },
  {
    tag: "appointment",
    labelFr: "Rendez-vous",
    labelAr: "موعد",
    description: "Questions relatives à la prise ou gestion de rendez-vous",
    urgencyWeight: 0.2,
  },
  {
    tag: "prescription",
    labelFr: "Ordonnance",
    labelAr: "وصفة طبية",
    description: "Demandes et questions concernant les prescriptions médicales",
    urgencyWeight: 0.4,
  },
  {
    tag: "lab_results",
    labelFr: "Résultats d'analyses",
    labelAr: "نتائج التحاليل",
    description: "Demandes de résultats de laboratoire ou d'examens complémentaires",
    urgencyWeight: 0.4,
  },
  {
    tag: "medical_urgent",
    labelFr: "Urgence médicale",
    labelAr: "طوارئ طبية",
    description: "Signes d'urgence médicale nécessitant une intervention immédiate",
    urgencyWeight: 1.0,
  },
  {
    tag: "data_privacy",
    labelFr: "Confidentialité des données",
    labelAr: "الخصوصية",
    description: "Questions relatives à la protection et la confidentialité des données",
    urgencyWeight: 0.3,
  },
  {
    tag: "feature_request",
    labelFr: "Demande de fonctionnalité",
    labelAr: "طلب ميزة",
    description: "Suggestions d'amélioration ou demande de nouvelles fonctionnalités souhaitées",
    urgencyWeight: 0.1,
  },
  {
    tag: "general",
    labelFr: "Général",
    labelAr: "عام",
    description: "Questions générales ne correspondant pas aux catégories précédentes",
    urgencyWeight: 0.1,
  },
];

// ── Drug Interaction lookup ───────────────────────────────────────────────────

/**
 * Look up a drug-drug interaction.
 *
 * Strategy:
 *  1. Exact match on both drug names (order-independent).
 *  2. Fuzzy match: each name normalised, substring containment check.
 *
 * Returns null when no entry is found — callers should interpret this as
 * "not in pack" (no known interaction), NOT as "safe to combine".
 */
export function lookupDrugInteraction(drug1: string, drug2: string): DrugInteraction | null {
  if (!drug1.trim() || !drug2.trim()) return null;

  // Exact match (order-independent)
  const exact = DRUG_INTERACTIONS.find(
    (d) =>
      (norm(d.drugA) === norm(drug1) && norm(d.drugB) === norm(drug2)) ||
      (norm(d.drugA) === norm(drug2) && norm(d.drugB) === norm(drug1)),
  );
  if (exact) return exact;

  // Fuzzy match — both drugs must fuzzy-match, order-independent
  const fuzzy = DRUG_INTERACTIONS.find(
    (d) =>
      (fuzzyMatch(d.drugA, drug1) && fuzzyMatch(d.drugB, drug2)) ||
      (fuzzyMatch(d.drugA, drug2) && fuzzyMatch(d.drugB, drug1)),
  );
  return fuzzy ?? null;
}

/**
 * Format a DrugInteraction result for LLM tool output.
 * Includes the pack version stamp so the model can cite it.
 */
export function formatDrugInteractionForTool(result: DrugInteraction): string {
  const severityLabel =
    result.severity === "contraindicated"
      ? "⛔ CONTRE-INDIQUÉ"
      : result.severity === "major"
        ? "🔴 MAJEUR"
        : result.severity === "moderate"
          ? "🟡 MODÉRÉ"
          : "🟢 MINEUR";

  return [
    `Interaction médicamenteuse : ${result.drugA} ↔ ${result.drugB}`,
    `Sévérité : ${severityLabel}`,
    `Mécanisme : ${result.mechanism}`,
    `Conséquence : ${result.consequence}`,
    `Recommandation : ${result.recommendation}`,
    `[Source : Oltigo Clinical Knowledge Pack v${PACK_VERSION}]`,
  ].join("\n");
}

/**
 * Format a "not found in pack" response.
 * Important: absence from the pack does NOT imply safety.
 */
export function formatDrugInteractionNotFound(drug1: string, drug2: string): string {
  return [
    `Aucune interaction connue trouvée entre "${drug1}" et "${drug2}" dans la base de données locale.`,
    `Cela ne signifie pas que la combinaison est sûre — consultez une source de référence pharmacologique complète (Vidal, interactions.ansm.sante.fr) ou un pharmacien.`,
    `[Source : Oltigo Clinical Knowledge Pack v${PACK_VERSION} — interaction non répertoriée]`,
  ].join("\n");
}

// ── Darija Term lookup ────────────────────────────────────────────────────────

/**
 * Search Darija terms by any of:
 *  - Darija term or variant
 *  - French term (partial)
 *  - Arabic term (partial)
 *
 * Returns all matching entries sorted by category.
 */
export function lookupDarijaTerms(query: string): DarijaTerm[] {
  if (!query.trim()) return [];
  const q = norm(query);

  return DARIJA_TERMS.filter(
    (term) =>
      term.darijaTerms.some(
        (t) => fuzzyMatch(t, q) || norm(t).includes(q) || q.includes(norm(t)),
      ) ||
      norm(term.frTerm).includes(q) ||
      term.arTerm.includes(query.trim()),
  ).sort((a, b) => a.category.localeCompare(b.category));
}

// ── Taxonomy Tag lookup ───────────────────────────────────────────────────────

/** Return all triage taxonomy tags. */
export function getTaxonomyTags(): TaxonomyTag[] {
  return TAXONOMY_TAGS;
}

/** Return a single taxonomy tag by key, or undefined if not found. */
export function getTaxonomyTag(tag: string): TaxonomyTag | undefined {
  return TAXONOMY_TAGS.find((t) => t.tag === tag);
}

/**
 * Given a list of tag strings, return the maximum urgency weight
 * among the matched tags (0.0 if none matched).
 */
export function getMaxUrgencyWeight(tags: string[]): number {
  return tags.reduce((max, tag) => {
    const entry = getTaxonomyTag(tag);
    return entry ? Math.max(max, entry.urgencyWeight) : max;
  }, 0);
}
