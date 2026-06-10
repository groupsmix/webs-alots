/**
 * Clinical Knowledge Pack Loader — Phase E4.
 *
 * Edge-safe CSV parser + exact/fuzzy lookup for clinical knowledge packs.
 * No native dependencies — runs on Cloudflare Workers.
 */

const PACK_VERSION = "1.0";

// ── Drug Interactions ──

export interface DrugInteraction {
  drugA: string;
  drugB: string;
  severity: "critical" | "high" | "medium" | "low";
  mechanism: string;
  recommendation: string;
  version: string;
}

// Inline the CSV data as a constant to avoid fs reads (edge-safe)
const DRUG_INTERACTIONS_RAW = `Warfarin,Paracetamol,high,Inhibits CYP2C9 metabolism of warfarin increasing INR,Monitor INR closely; limit paracetamol to <2g/day
Warfarin,Aspirin,critical,Dual anticoagulant/antiplatelet effect increases bleeding risk,Avoid combination unless cardiology-directed; monitor for bleeding signs
Warfarin,Metronidazole,high,CYP2C9 inhibition increases warfarin effect,Reduce warfarin dose 25-50%; check INR day 3-5
Warfarin,Fluconazole,critical,Strong CYP2C9 inhibition dramatically increases INR,Reduce warfarin dose 50%; daily INR monitoring
Metformin,Ibuprofen,medium,NSAIDs may reduce renal function affecting metformin clearance,Monitor renal function; consider paracetamol alternative
Metformin,Alcohol,high,Increased risk of lactic acidosis,Advise moderate alcohol only; monitor lactate if symptomatic
ACE inhibitor,Potassium,high,Both increase serum potassium risk of hyperkalemia,Monitor K+ levels; avoid K+ supplements unless hypokalemic
ACE inhibitor,Spironolactone,high,Dual potassium-sparing effect hyperkalemia risk,Check K+ within 1 week of starting; monitor regularly
Simvastatin,Amlodipine,medium,Amlodipine increases simvastatin exposure via CYP3A4,Limit simvastatin to 20mg/day with amlodipine
Digoxin,Amiodarone,critical,Amiodarone increases digoxin levels 70-100%,Halve digoxin dose when starting amiodarone; monitor levels
Clopidogrel,Omeprazole,high,Omeprazole inhibits CYP2C19 reducing clopidogrel activation,Switch to pantoprazole or rabeprazole
Methotrexate,Trimethoprim,critical,Both are folate antagonists; trimethoprim reduces methotrexate clearance,Avoid combination; if unavoidable increase folinic acid rescue
Ciprofloxacin,Theophylline,high,Ciprofloxacin inhibits CYP1A2 increasing theophylline levels,Monitor theophylline level; consider dose reduction 30-50%
Lithium,Ibuprofen,high,NSAIDs reduce lithium clearance causing toxicity,Monitor lithium level; use paracetamol instead
SSRI,Tramadol,critical,Serotonin syndrome risk from dual serotonergic effect,Avoid combination; use alternative analgesic
Insulin,Beta-blocker,medium,Beta-blockers mask hypoglycemia symptoms,Educate patient on alternative hypoglycemia signs; monitor glucose
Amoxicillin,Methotrexate,high,Amoxicillin reduces renal tubular secretion of methotrexate,Monitor methotrexate levels and renal function
Carbamazepine,Oral contraceptive,high,CYP3A4 induction reduces contraceptive efficacy,Use higher-dose OCP or alternative contraception
Phenytoin,Valproate,high,Complex bidirectional interaction affecting both drug levels,Monitor levels of both drugs; clinical signs
Rifampicin,Oral contraceptive,critical,Potent CYP3A4 inducer eliminates contraceptive efficacy,Use non-hormonal contraception during and 28 days after rifampicin`;

let _interactions: DrugInteraction[] | null = null;

function loadInteractions(): DrugInteraction[] {
  if (_interactions) return _interactions;
  _interactions = DRUG_INTERACTIONS_RAW.trim()
    .split("\n")
    .map((line) => {
      const [drugA, drugB, severity, mechanism, recommendation] = line
        .split(",")
        .map((s) => s.trim());
      return {
        drugA,
        drugB,
        severity: severity as DrugInteraction["severity"],
        mechanism,
        recommendation,
        version: PACK_VERSION,
      };
    });
  return _interactions;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyMatch(needle: string, haystack: string): boolean {
  const n = normalize(needle);
  const h = normalize(haystack);
  return h.includes(n) || n.includes(h);
}

export function lookupDrugInteractions(
  drugA: string,
  drugB?: string,
): {
  interactions: DrugInteraction[];
  packVersion: string;
} {
  const all = loadInteractions();

  const matches = all.filter((ix) => {
    const matchA = fuzzyMatch(drugA, ix.drugA) || fuzzyMatch(drugA, ix.drugB);
    if (!drugB) return matchA;
    const matchB = fuzzyMatch(drugB, ix.drugA) || fuzzyMatch(drugB, ix.drugB);
    return (matchA && matchB) || (matchA && !drugB);
  });

  return { interactions: matches, packVersion: PACK_VERSION };
}

export function lookupDrugByName(drugName: string): {
  interactions: DrugInteraction[];
  packVersion: string;
} {
  return lookupDrugInteractions(drugName);
}

// ── Darija Medical Terms ──

export interface MedicalTerm {
  termFr: string;
  termAr: string;
  termDarija: string;
  termEn: string;
  category: string;
  version: string;
}

const DARIJA_TERMS_RAW = `douleur,ألم,وجع,pain,symptom
fièvre,حمى,سخانة,fever,symptom
toux,سعال,كحة,cough,symptom
maux de tête,صداع,راسي كيضرني,headache,symptom
vomissement,تقيؤ,استفراغ,vomiting,symptom
diarrhée,إسهال,إسهال,diarrhea,symptom
tension artérielle,ضغط الدم,الضغط,blood pressure,vital
diabète,سكري,السكر,diabetes,condition
grossesse,حمل,حاملة,pregnancy,condition
allergie,حساسية,حساسية,allergy,condition
ordonnance,وصفة طبية,لوصفة,prescription,document
rendez-vous,موعد,رونديفو,appointment,admin
analyse de sang,تحليل الدم,تحليل الدم,blood test,procedure
radiographie,أشعة سينية,الراديو,x-ray,procedure
échographie,تصوير بالموجات فوق الصوتية,الإيكو,ultrasound,procedure
médicament,دواء,دوا,medication,treatment
comprimé,قرص,حبة,tablet,treatment
sirop,شراب,سيرو,syrup,treatment
injection,حقنة,بيقورة,injection,treatment
urgence,طوارئ,أورجونس,emergency,admin
cabinet médical,عيادة طبية,لكابيني,clinic,admin
médecin,طبيب,طبيب,doctor,role
infirmier,ممرض,أنفرميي,nurse,role
pharmacie,صيدلية,فارماسيان,pharmacy,location
assurance maladie,تأمين صحي,لاسورونس,health insurance,admin
CNSS,الصندوق الوطني للضمان الاجتماعي,CNSS,CNSS,insurance
CNOPS,الصندوق الوطني لمنظمات الاحتياط الاجتماعي,CNOPS,CNOPS,insurance
RAMED,نظام المساعدة الطبية,راميد,RAMED,insurance`;

let _terms: MedicalTerm[] | null = null;

function loadTerms(): MedicalTerm[] {
  if (_terms) return _terms;
  _terms = DARIJA_TERMS_RAW.trim()
    .split("\n")
    .map((line) => {
      const [termFr, termAr, termDarija, termEn, category] = line.split(",").map((s) => s.trim());
      return { termFr, termAr, termDarija, termEn, category, version: PACK_VERSION };
    });
  return _terms;
}

export function lookupMedicalTerm(query: string): {
  terms: MedicalTerm[];
  packVersion: string;
} {
  const all = loadTerms();
  const q = normalize(query);

  const matches = all.filter(
    (t) =>
      normalize(t.termFr).includes(q) ||
      normalize(t.termEn).includes(q) ||
      t.termAr.includes(query) ||
      t.termDarija.includes(query),
  );

  return { terms: matches, packVersion: PACK_VERSION };
}

// ── Triage Taxonomy ──

export interface TriageEntry {
  keywordFr: string;
  keywordAr: string;
  keywordDarija: string;
  urgency: "critical" | "high" | "medium" | "low";
  category: string;
  action: string;
  version: string;
}

const TRIAGE_TAXONOMY_RAW = `douleur thoracique,ألم في الصدر,صدري كيوجعني,critical,cardiac,Immediate triage — rule out ACS
difficulté respiratoire,صعوبة في التنفس,ما كنقدرش نتنفس,critical,respiratory,Immediate triage — assess O2 sat
perte de conscience,فقدان الوعي,طاح مغشي عليه,critical,neurological,Immediate triage — assess GCS
saignement abondant,نزيف حاد,كيسيل بزاف دم,critical,hemorrhage,Immediate triage — apply pressure and assess
convulsion,تشنج,كيترعش,critical,neurological,Immediate triage — protect airway
réaction allergique sévère,تفاعل تحسسي شديد,حساسية قوية,critical,allergy,Immediate triage — epinephrine if anaphylaxis
tentative de suicide,محاولة انتحار,بغا يقتل راسو,critical,psychiatric,Immediate psychiatric evaluation
fièvre élevée enfant,حمى شديدة عند الطفل,الدري سخون بزاف,high,pediatric,Urgent assessment — febrile child protocol
chute personne âgée,سقوط شخص مسن,الشيباني طاح,high,geriatric,Assess for fracture and head injury
douleur abdominale aiguë,ألم بطني حاد,كرشي كتوجعني بزاف,high,abdominal,Assess for surgical abdomen
brûlure,حرق,تحرق,high,trauma,Assess burn depth and area
fracture suspectée,كسر مشتبه,يقدر يكون مكسور,high,orthopedic,Immobilize and image
fièvre,حمى,سخانة,medium,general,Standard workup — vital signs and history
toux persistante,سعال مستمر,كحة ما بغاتش توقف,medium,respiratory,Assess for infection vs chronic cause
douleur articulaire,ألم المفاصل,مفاصلي كيوجعوني,medium,rheumatologic,History and targeted exam
mal de gorge,التهاب الحلق,حلقي كيوجعني,low,ENT,Symptomatic care — assess for strep
rhume,زكام,برد,low,general,Symptomatic care — rest and fluids
renouvellement ordonnance,تجديد وصفة,بغيت نجدد لوصفة,low,admin,Routine — schedule follow-up if needed`;

let _taxonomy: TriageEntry[] | null = null;

function loadTaxonomy(): TriageEntry[] {
  if (_taxonomy) return _taxonomy;
  _taxonomy = TRIAGE_TAXONOMY_RAW.trim()
    .split("\n")
    .map((line) => {
      const [keywordFr, keywordAr, keywordDarija, urgency, category, action] = line
        .split(",")
        .map((s) => s.trim());
      return {
        keywordFr,
        keywordAr,
        keywordDarija,
        urgency: urgency as TriageEntry["urgency"],
        category,
        action,
        version: PACK_VERSION,
      };
    });
  return _taxonomy;
}

export function lookupTriageTaxonomy(symptom: string): {
  entries: TriageEntry[];
  packVersion: string;
} {
  const all = loadTaxonomy();
  const q = symptom.toLowerCase();

  const matches = all.filter(
    (e) =>
      e.keywordFr.toLowerCase().includes(q) ||
      q.includes(e.keywordFr.toLowerCase()) ||
      e.keywordAr.includes(symptom) ||
      e.keywordDarija.includes(symptom),
  );

  return { entries: matches, packVersion: PACK_VERSION };
}

export function getPackVersion(): string {
  return PACK_VERSION;
}
