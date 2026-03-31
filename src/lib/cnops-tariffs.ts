/**
 * CNOPS (Caisse Nationale des Organismes de Prévoyance Sociale) Tariff Table
 *
 * Official conventional tariffs for medical acts covered by CNOPS.
 * CNOPS covers public-sector employees (fonctionnaires) and typically
 * reimburses at 80% of the tarif national de référence (TNR).
 *
 * CNOPS manages 8 mutual societies:
 * - MGPAP (Mutuelle Générale du Personnel des Administrations Publiques)
 * - OMFAM (Œuvres de Mutualité des Fonctionnaires et Agents du Maroc)
 * - MGEN (Mutuelle Générale de l'Éducation Nationale)
 * - MGPTT (Mutuelle Générale du Personnel des PTT)
 * - FM6E (Fondation Mohammed VI de l'Éducation)
 * - MODEP (Mutuelle des Douanes et Eaux et Forêts)
 * - FAR (Forces Armées Royales)
 * - CNSS sections fonctionnaires
 *
 * Key differences from CNSS:
 * - Higher base reimbursement rate (80% vs 70%)
 * - Generally higher tarif de référence for specialist acts
 * - Different prior-approval thresholds
 * - Better coverage for dental prosthetics (60% vs 50%)
 */

// ---- Types ----

export interface CNOPSTariffEntry {
  /** Unique act code (NGAP-based) */
  code: string;
  /** Category letter (C, CS, K, Z, B, D, etc.) */
  category: string;
  /** Coefficient / multiplier */
  coefficient: number;
  /** Description in French */
  descriptionFr: string;
  /** Description in Arabic */
  descriptionAr: string;
  /** Tarif National de Référence (TNR) in MAD */
  tarifReference: number;
  /** CNOPS reimbursement rate (0-1) — typically 0.80 */
  reimbursementRate: number;
  /** Amount reimbursed by CNOPS in MAD */
  reimbursementAmount: number;
  /** Patient out-of-pocket (reste à charge) in MAD */
  patientShare: number;
  /** Whether this act requires prior approval (entente préalable) */
  requiresPriorApproval: boolean;
  /** Medical specialty this act belongs to */
  specialty: string;
}

// ---- CNOPS Base Rates ----

/** CNOPS standard reimbursement rate */
export const CNOPS_REIMBURSEMENT_RATE = 0.80;

/** CNOPS letter-key base values in MAD (generally higher than CNSS) */
export const CNOPS_LETTER_VALUES: Record<string, number> = {
  C: 80,    // Consultation généraliste
  CS: 150,  // Consultation spécialisée
  K: 17,    // Chirurgie coefficient base (higher than CNSS)
  KC: 17,   // Chirurgie coefficient base
  KE: 17,   // Explorations fonctionnelles base
  Z: 14,    // Radiologie coefficient base (higher than CNSS)
  B: 1.8,   // Biologie coefficient base (higher than CNSS)
  D: 12,    // Dentaire coefficient base (higher than CNSS)
  P: 1,     // Prothèses (unit price)
};

// Helper to compute tariff fields
function cnopsEntry(
  code: string,
  category: string,
  coefficient: number,
  descriptionFr: string,
  descriptionAr: string,
  tarifReference: number,
  specialty: string,
  requiresPriorApproval = false,
  reimbursementRate = CNOPS_REIMBURSEMENT_RATE,
): CNOPSTariffEntry {
  const reimbursementAmount = Math.round(tarifReference * reimbursementRate * 100) / 100;
  const patientShare = Math.round((tarifReference - reimbursementAmount) * 100) / 100;
  return {
    code,
    category,
    coefficient,
    descriptionFr,
    descriptionAr,
    tarifReference,
    reimbursementRate,
    reimbursementAmount,
    patientShare,
    requiresPriorApproval,
    specialty,
  };
}

// ---- Tariff Table ----

export const CNOPS_TARIFFS: CNOPSTariffEntry[] = [
  // ── Consultations (C / CS) ──
  cnopsEntry("C-001", "C", 1, "Consultation médecin généraliste", "استشارة طبيب عام", 80, "Médecine générale"),
  cnopsEntry("CS-001", "CS", 1, "Consultation médecin spécialiste", "استشارة طبيب مختص", 150, "Spécialiste"),
  cnopsEntry("CS-002", "CS", 1.5, "Consultation cardiologue", "استشارة طبيب القلب", 200, "Cardiologie"),
  cnopsEntry("CS-003", "CS", 1, "Consultation pédiatre", "استشارة طبيب الأطفال", 150, "Pédiatrie"),
  cnopsEntry("CS-004", "CS", 1.5, "Consultation gynécologue-obstétricien", "استشارة طبيب النساء والتوليد", 200, "Gynécologie"),
  cnopsEntry("CS-005", "CS", 1, "Consultation ORL", "استشارة طبيب الأنف والأذن والحنجرة", 150, "ORL"),
  cnopsEntry("CS-006", "CS", 1, "Consultation ophtalmologue", "استشارة طبيب العيون", 150, "Ophtalmologie"),
  cnopsEntry("CS-007", "CS", 1, "Consultation dermatologue", "استشارة طبيب الجلد", 150, "Dermatologie"),
  cnopsEntry("CS-008", "CS", 1, "Consultation pneumologue", "استشارة طبيب الرئة", 150, "Pneumologie"),
  cnopsEntry("CS-009", "CS", 1, "Consultation rhumatologue", "استشارة طبيب الروماتيزم", 150, "Rhumatologie"),
  cnopsEntry("CS-010", "CS", 1.5, "Consultation neurologie", "استشارة طبيب الأعصاب", 200, "Neurologie"),
  cnopsEntry("CS-011", "CS", 1, "Consultation endocrinologue", "استشارة طبيب الغدد الصماء", 150, "Endocrinologie"),
  cnopsEntry("CS-012", "CS", 1, "Consultation gastro-entérologue", "استشارة طبيب الجهاز الهضمي", 150, "Gastro-entérologie"),
  cnopsEntry("CS-013", "CS", 1, "Consultation urologue", "استشارة طبيب المسالك البولية", 150, "Urologie"),
  cnopsEntry("CS-014", "CS", 1, "Consultation néphrologue", "استشارة طبيب الكلى", 150, "Néphrologie"),
  cnopsEntry("CS-015", "CS", 1, "Consultation psychiatre", "استشارة طبيب نفسي", 150, "Psychiatrie"),

  // ── Actes de chirurgie (KC) ──
  cnopsEntry("KC-001", "KC", 15, "Petite chirurgie / suture simple", "جراحة صغيرة / خياطة بسيطة", 255, "Chirurgie"),
  cnopsEntry("KC-002", "KC", 30, "Chirurgie ambulatoire courante", "جراحة يومية عادية", 510, "Chirurgie"),
  cnopsEntry("KC-003", "KC", 50, "Appendicectomie", "استئصال الزائدة الدودية", 850, "Chirurgie", true),
  cnopsEntry("KC-004", "KC", 80, "Cholécystectomie", "استئصال المرارة", 1360, "Chirurgie", true),
  cnopsEntry("KC-005", "KC", 60, "Hernie inguinale (cure)", "إصلاح الفتق الإربي", 1020, "Chirurgie", true),
  cnopsEntry("KC-006", "KC", 120, "Césarienne", "عملية قيصرية", 2040, "Gynécologie", true),
  cnopsEntry("KC-007", "KC", 100, "Hystérectomie", "استئصال الرحم", 1700, "Gynécologie", true),
  cnopsEntry("KC-008", "KC", 40, "Circoncision", "ختان", 680, "Chirurgie"),
  cnopsEntry("KC-009", "KC", 90, "Chirurgie du genou (méniscectomie)", "جراحة الركبة", 1530, "Orthopédie", true),
  cnopsEntry("KC-010", "KC", 150, "Prothèse totale de hanche", "بدلة كاملة للورك", 2550, "Orthopédie", true),

  // ── Explorations fonctionnelles (KE) ──
  cnopsEntry("KE-001", "KE", 10, "Électrocardiogramme (ECG)", "تخطيط القلب", 170, "Cardiologie"),
  cnopsEntry("KE-002", "KE", 25, "Échocardiographie", "تصوير القلب بالصدى", 425, "Cardiologie"),
  cnopsEntry("KE-003", "KE", 20, "Épreuve d'effort", "اختبار الجهد", 340, "Cardiologie", true),
  cnopsEntry("KE-004", "KE", 15, "Spirométrie", "قياس التنفس", 255, "Pneumologie"),
  cnopsEntry("KE-005", "KE", 20, "Électromyogramme (EMG)", "تخطيط كهربية العضل", 340, "Neurologie"),
  cnopsEntry("KE-006", "KE", 15, "Électroencéphalogramme (EEG)", "تخطيط كهربية الدماغ", 255, "Neurologie"),
  cnopsEntry("KE-007", "KE", 30, "Holter ECG 24h", "هولتر تخطيط القلب 24 ساعة", 510, "Cardiologie"),

  // ── Radiologie / Imagerie (Z) ──
  cnopsEntry("Z-001", "Z", 10, "Radiographie standard (1 incidence)", "أشعة سينية عادية", 140, "Radiologie"),
  cnopsEntry("Z-002", "Z", 15, "Radiographie avec 2 incidences", "أشعة سينية مع وضعيتين", 210, "Radiologie"),
  cnopsEntry("Z-003", "Z", 50, "Échographie abdominale", "تصوير بالصدى للبطن", 300, "Radiologie"),
  cnopsEntry("Z-004", "Z", 50, "Échographie obstétricale", "تصوير بالصدى للحمل", 300, "Gynécologie"),
  cnopsEntry("Z-005", "Z", 40, "Échographie pelvienne", "تصوير بالصدى للحوض", 240, "Gynécologie"),
  cnopsEntry("Z-006", "Z", 60, "Échographie mammaire", "تصوير بالصدى للثدي", 350, "Gynécologie"),
  cnopsEntry("Z-007", "Z", 150, "Scanner (TDM) sans injection", "أشعة مقطعية بدون حقن", 1000, "Radiologie", true),
  cnopsEntry("Z-008", "Z", 200, "Scanner (TDM) avec injection", "أشعة مقطعية مع حقن", 1400, "Radiologie", true),
  cnopsEntry("Z-009", "Z", 250, "IRM sans injection", "رنين مغناطيسي بدون حقن", 1800, "Radiologie", true),
  cnopsEntry("Z-010", "Z", 300, "IRM avec injection", "رنين مغناطيسي مع حقن", 2100, "Radiologie", true),
  cnopsEntry("Z-011", "Z", 40, "Mammographie bilatérale", "تصوير الثدي بالأشعة", 560, "Radiologie"),
  cnopsEntry("Z-012", "Z", 30, "Panoramique dentaire", "أشعة بانورامية للأسنان", 420, "Dentaire"),

  // ── Biologie / Laboratoire (B) ──
  cnopsEntry("B-001", "B", 40, "Numération formule sanguine (NFS)", "تحليل الدم الشامل", 72, "Laboratoire"),
  cnopsEntry("B-002", "B", 15, "Glycémie à jeun", "قياس السكر صائم", 27, "Laboratoire"),
  cnopsEntry("B-003", "B", 30, "Hémoglobine glyquée (HbA1c)", "الهيموغلوبين السكري", 54, "Laboratoire"),
  cnopsEntry("B-004", "B", 15, "Créatinine", "الكرياتينين", 27, "Laboratoire"),
  cnopsEntry("B-005", "B", 15, "Urée sanguine", "اليوريا في الدم", 27, "Laboratoire"),
  cnopsEntry("B-006", "B", 30, "Bilan lipidique complet", "تحليل الدهون الكامل", 54, "Laboratoire"),
  cnopsEntry("B-007", "B", 20, "Transaminases (ASAT/ALAT)", "إنزيمات الكبد", 36, "Laboratoire"),
  cnopsEntry("B-008", "B", 50, "Bilan thyroïdien (TSH + T4)", "تحليل الغدة الدرقية", 90, "Laboratoire"),
  cnopsEntry("B-009", "B", 25, "Vitesse de sédimentation (VS)", "سرعة الترسيب", 45, "Laboratoire"),
  cnopsEntry("B-010", "B", 30, "CRP (protéine C réactive)", "بروتين سي التفاعلي", 54, "Laboratoire"),
  cnopsEntry("B-011", "B", 20, "Examen cytobactériologique des urines (ECBU)", "تحليل البول الجرثومي", 36, "Laboratoire"),
  cnopsEntry("B-012", "B", 60, "PSA (Antigène prostatique)", "مستضد البروستات", 108, "Laboratoire"),
  cnopsEntry("B-013", "B", 40, "Sérologie hépatite B (AgHBs)", "فحص التهاب الكبد ب", 72, "Laboratoire"),
  cnopsEntry("B-014", "B", 40, "Sérologie hépatite C", "فحص التهاب الكبد ج", 72, "Laboratoire"),
  cnopsEntry("B-015", "B", 80, "Bilan prénatal complet", "التحاليل ما قبل الولادة", 144, "Laboratoire"),

  // ── Actes dentaires (D) ──
  cnopsEntry("D-001", "D", 8, "Consultation dentaire", "استشارة طبيب الأسنان", 96, "Dentaire"),
  cnopsEntry("D-002", "D", 15, "Extraction dentaire simple", "خلع سن بسيط", 180, "Dentaire"),
  cnopsEntry("D-003", "D", 30, "Extraction dentaire chirurgicale", "خلع سن جراحي", 360, "Dentaire"),
  cnopsEntry("D-004", "D", 25, "Dévitalisation monoradiculée", "علاج عصب سن أحادي الجذر", 300, "Dentaire"),
  cnopsEntry("D-005", "D", 40, "Dévitalisation multiradiculée", "علاج عصب سن متعدد الجذور", 480, "Dentaire"),
  cnopsEntry("D-006", "D", 12, "Obturation (amalgame/composite) 1 face", "حشوة سطح واحد", 144, "Dentaire"),
  cnopsEntry("D-007", "D", 18, "Obturation (amalgame/composite) 2 faces", "حشوة سطحين", 216, "Dentaire"),
  cnopsEntry("D-008", "D", 10, "Détartrage", "تنظيف الأسنان من الجير", 120, "Dentaire"),
  cnopsEntry("D-009", "D", 60, "Couronne céramo-métallique", "تاج خزفي معدني", 720, "Dentaire", true, 0.60),
  cnopsEntry("D-010", "D", 80, "Couronne céramo-céramique", "تاج خزفي بالكامل", 960, "Dentaire", true, 0.60),
  cnopsEntry("D-011", "D", 50, "Bridge (par élément)", "جسر أسنان (لكل عنصر)", 600, "Dentaire", true, 0.60),
  cnopsEntry("D-012", "D", 120, "Prothèse adjointe complète (par arcade)", "طقم أسنان كامل (لكل قوس)", 1440, "Dentaire", true, 0.60),
  cnopsEntry("D-013", "D", 25, "Traitement de parodontite (par quadrant)", "علاج اللثة (لكل ربع)", 300, "Dentaire"),
  cnopsEntry("D-014", "D", 150, "Implant dentaire", "زرع الأسنان", 1800, "Dentaire", true, 0.60),
  cnopsEntry("D-015", "D", 5, "Radiographie rétro-alvéolaire", "أشعة سنية خلفية سنخية", 60, "Dentaire"),

  // ── Actes obstétriques ──
  cnopsEntry("KC-020", "KC", 60, "Accouchement par voie basse (normal)", "ولادة طبيعية", 1020, "Gynécologie"),
  cnopsEntry("KC-021", "KC", 80, "Accouchement dystocique", "ولادة متعسرة", 1360, "Gynécologie"),
  cnopsEntry("KC-022", "KC", 20, "Épisiotomie", "شق العجان", 340, "Gynécologie"),
  cnopsEntry("KC-023", "KC", 15, "Frottis cervico-vaginal", "مسحة عنق الرحم", 255, "Gynécologie"),

  // ── Kinésithérapie ──
  cnopsEntry("K-050", "K", 8, "Séance de kinésithérapie", "جلسة علاج طبيعي", 136, "Kinésithérapie"),
  cnopsEntry("K-051", "K", 12, "Séance de rééducation fonctionnelle", "جلسة إعادة تأهيل وظيفي", 204, "Kinésithérapie"),
  cnopsEntry("K-052", "K", 10, "Séance de kinésithérapie respiratoire", "جلسة علاج طبيعي تنفسي", 170, "Kinésithérapie"),

  // ── Hospitalisation ──
  cnopsEntry("H-001", "K", 1, "Hospitalisation (par jour, chambre commune)", "إقامة في المستشفى (يوم, غرفة مشتركة)", 800, "Hospitalisation", false, 0.90),
  cnopsEntry("H-002", "K", 1, "Hospitalisation (par jour, chambre individuelle)", "إقامة في المستشفى (يوم, غرفة فردية)", 1200, "Hospitalisation", false, 0.80),
  cnopsEntry("H-003", "K", 1, "Réanimation (par jour)", "إنعاش (يوم)", 3500, "Hospitalisation", true, 0.90),

  // ── Optique (lunettes) ──
  cnopsEntry("P-001", "P", 1, "Monture de lunettes", "إطار نظارات", 200, "Optique", false, 0.60),
  cnopsEntry("P-002", "P", 1, "Verre correcteur simple", "عدسة تصحيحية بسيطة", 150, "Optique", false, 0.60),
  cnopsEntry("P-003", "P", 1, "Verre correcteur progressif", "عدسة تصحيحية متعددة البؤر", 350, "Optique", false, 0.60),
  cnopsEntry("P-004", "P", 1, "Lentilles de contact (paire)", "عدسات لاصقة (زوج)", 300, "Optique", true, 0.60),
];

// ---- Lookup Helpers ----

/** Find a CNOPS tariff by act code */
export function getCNOPSTariffByCode(code: string): CNOPSTariffEntry | undefined {
  return CNOPS_TARIFFS.find((t) => t.code === code);
}

/** Find all CNOPS tariffs for a category */
export function getCNOPSTariffsByCategory(category: string): CNOPSTariffEntry[] {
  return CNOPS_TARIFFS.filter((t) => t.category === category);
}

/** Find all CNOPS tariffs for a specialty */
export function getCNOPSTariffsBySpecialty(specialty: string): CNOPSTariffEntry[] {
  return CNOPS_TARIFFS.filter((t) => t.specialty === specialty);
}

/** Search CNOPS tariffs by description (French) */
export function searchCNOPSTariffs(query: string): CNOPSTariffEntry[] {
  const q = query.toLowerCase();
  return CNOPS_TARIFFS.filter(
    (t) =>
      t.descriptionFr.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      t.specialty.toLowerCase().includes(q),
  );
}

/** Get all unique specialties in the CNOPS tariff table */
export function getCNOPSSpecialties(): string[] {
  return [...new Set(CNOPS_TARIFFS.map((t) => t.specialty))];
}

/** Get all unique categories in the CNOPS tariff table */
export function getCNOPSCategories(): string[] {
  return [...new Set(CNOPS_TARIFFS.map((t) => t.category))];
}
