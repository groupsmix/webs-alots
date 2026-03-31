/**
 * CNSS (Caisse Nationale de Sécurité Sociale) Tariff Table
 *
 * Official conventional tariffs for medical acts covered by CNSS.
 * Based on the Moroccan "Nomenclature Générale des Actes Professionnels" (NGAP)
 * and the CNSS reimbursement schedule.
 *
 * CNSS covers private-sector employees and reimburses at 70% of the
 * tarif national de référence (TNR) for most medical acts.
 *
 * Categories:
 * - C  = Consultations
 * - CS = Consultations spécialisées
 * - K  = Actes de chirurgie et spécialités
 * - KC = Actes de chirurgie
 * - KE = Actes d'explorations fonctionnelles
 * - Z  = Actes de radiologie / imagerie
 * - B  = Actes de biologie / laboratoire
 * - D  = Actes dentaires
 * - P  = Actes de pharmacie / prothèses
 */

// ---- Types ----

export interface CNSSTariffEntry {
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
  /** Tarif National de Référence (TNR) in MAD — the official base price */
  tarifReference: number;
  /** CNSS reimbursement rate (0-1) — typically 0.70 */
  reimbursementRate: number;
  /** Amount reimbursed by CNSS in MAD */
  reimbursementAmount: number;
  /** Patient out-of-pocket (reste à charge) in MAD */
  patientShare: number;
  /** Whether this act requires prior approval (entente préalable) */
  requiresPriorApproval: boolean;
  /** Medical specialty this act belongs to */
  specialty: string;
}

// ---- CNSS Base Rates ----

/** CNSS standard reimbursement rate */
export const CNSS_REIMBURSEMENT_RATE = 0.70;

/** CNSS letter-key base values in MAD */
export const CNSS_LETTER_VALUES: Record<string, number> = {
  C: 80,    // Consultation généraliste
  CS: 150,  // Consultation spécialisée
  K: 15,    // Chirurgie coefficient base
  KC: 15,   // Chirurgie coefficient base
  KE: 15,   // Explorations fonctionnelles base
  Z: 12,    // Radiologie coefficient base
  B: 1.5,   // Biologie coefficient base
  D: 10,    // Dentaire coefficient base
  P: 1,     // Prothèses (unit price)
};

// Helper to compute tariff fields
function cnssEntry(
  code: string,
  category: string,
  coefficient: number,
  descriptionFr: string,
  descriptionAr: string,
  tarifReference: number,
  specialty: string,
  requiresPriorApproval = false,
  reimbursementRate = CNSS_REIMBURSEMENT_RATE,
): CNSSTariffEntry {
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

export const CNSS_TARIFFS: CNSSTariffEntry[] = [
  // ── Consultations (C / CS) ──
  cnssEntry("C-001", "C", 1, "Consultation médecin généraliste", "استشارة طبيب عام", 80, "Médecine générale"),
  cnssEntry("CS-001", "CS", 1, "Consultation médecin spécialiste", "استشارة طبيب مختص", 150, "Spécialiste"),
  cnssEntry("CS-002", "CS", 1.5, "Consultation cardiologue", "استشارة طبيب القلب", 200, "Cardiologie"),
  cnssEntry("CS-003", "CS", 1, "Consultation pédiatre", "استشارة طبيب الأطفال", 150, "Pédiatrie"),
  cnssEntry("CS-004", "CS", 1.5, "Consultation gynécologue-obstétricien", "استشارة طبيب النساء والتوليد", 200, "Gynécologie"),
  cnssEntry("CS-005", "CS", 1, "Consultation ORL", "استشارة طبيب الأنف والأذن والحنجرة", 150, "ORL"),
  cnssEntry("CS-006", "CS", 1, "Consultation ophtalmologue", "استشارة طبيب العيون", 150, "Ophtalmologie"),
  cnssEntry("CS-007", "CS", 1, "Consultation dermatologue", "استشارة طبيب الجلد", 150, "Dermatologie"),
  cnssEntry("CS-008", "CS", 1, "Consultation pneumologue", "استشارة طبيب الرئة", 150, "Pneumologie"),
  cnssEntry("CS-009", "CS", 1, "Consultation rhumatologue", "استشارة طبيب الروماتيزم", 150, "Rhumatologie"),
  cnssEntry("CS-010", "CS", 1.5, "Consultation neurologie", "استشارة طبيب الأعصاب", 200, "Neurologie"),
  cnssEntry("CS-011", "CS", 1, "Consultation endocrinologue", "استشارة طبيب الغدد الصماء", 150, "Endocrinologie"),
  cnssEntry("CS-012", "CS", 1, "Consultation gastro-entérologue", "استشارة طبيب الجهاز الهضمي", 150, "Gastro-entérologie"),
  cnssEntry("CS-013", "CS", 1, "Consultation urologue", "استشارة طبيب المسالك البولية", 150, "Urologie"),
  cnssEntry("CS-014", "CS", 1, "Consultation néphrologue", "استشارة طبيب الكلى", 150, "Néphrologie"),
  cnssEntry("CS-015", "CS", 1, "Consultation psychiatre", "استشارة طبيب نفسي", 150, "Psychiatrie"),

  // ── Actes de chirurgie (KC) ──
  cnssEntry("KC-001", "KC", 15, "Petite chirurgie / suture simple", "جراحة صغيرة / خياطة بسيطة", 225, "Chirurgie"),
  cnssEntry("KC-002", "KC", 30, "Chirurgie ambulatoire courante", "جراحة يومية عادية", 450, "Chirurgie"),
  cnssEntry("KC-003", "KC", 50, "Appendicectomie", "استئصال الزائدة الدودية", 750, "Chirurgie", true),
  cnssEntry("KC-004", "KC", 80, "Cholécystectomie", "استئصال المرارة", 1200, "Chirurgie", true),
  cnssEntry("KC-005", "KC", 60, "Hernie inguinale (cure)", "إصلاح الفتق الإربي", 900, "Chirurgie", true),
  cnssEntry("KC-006", "KC", 120, "Césarienne", "عملية قيصرية", 1800, "Gynécologie", true),
  cnssEntry("KC-007", "KC", 100, "Hystérectomie", "استئصال الرحم", 1500, "Gynécologie", true),
  cnssEntry("KC-008", "KC", 40, "Circoncision", "ختان", 600, "Chirurgie"),
  cnssEntry("KC-009", "KC", 90, "Chirurgie du genou (méniscectomie)", "جراحة الركبة", 1350, "Orthopédie", true),
  cnssEntry("KC-010", "KC", 150, "Prothèse totale de hanche", "بدلة كاملة للورك", 2250, "Orthopédie", true),

  // ── Explorations fonctionnelles (KE) ──
  cnssEntry("KE-001", "KE", 10, "Électrocardiogramme (ECG)", "تخطيط القلب", 150, "Cardiologie"),
  cnssEntry("KE-002", "KE", 25, "Échocardiographie", "تصوير القلب بالصدى", 375, "Cardiologie"),
  cnssEntry("KE-003", "KE", 20, "Épreuve d'effort", "اختبار الجهد", 300, "Cardiologie", true),
  cnssEntry("KE-004", "KE", 15, "Spirométrie", "قياس التنفس", 225, "Pneumologie"),
  cnssEntry("KE-005", "KE", 20, "Électromyogramme (EMG)", "تخطيط كهربية العضل", 300, "Neurologie"),
  cnssEntry("KE-006", "KE", 15, "Électroencéphalogramme (EEG)", "تخطيط كهربية الدماغ", 225, "Neurologie"),
  cnssEntry("KE-007", "KE", 30, "Holter ECG 24h", "هولتر تخطيط القلب 24 ساعة", 450, "Cardiologie"),

  // ── Radiologie / Imagerie (Z) ──
  cnssEntry("Z-001", "Z", 10, "Radiographie standard (1 incidence)", "أشعة سينية عادية", 120, "Radiologie"),
  cnssEntry("Z-002", "Z", 15, "Radiographie avec 2 incidences", "أشعة سينية مع وضعيتين", 180, "Radiologie"),
  cnssEntry("Z-003", "Z", 50, "Échographie abdominale", "تصوير بالصدى للبطن", 250, "Radiologie"),
  cnssEntry("Z-004", "Z", 50, "Échographie obstétricale", "تصوير بالصدى للحمل", 250, "Gynécologie"),
  cnssEntry("Z-005", "Z", 40, "Échographie pelvienne", "تصوير بالصدى للحوض", 200, "Gynécologie"),
  cnssEntry("Z-006", "Z", 60, "Échographie mammaire", "تصوير بالصدى للثدي", 300, "Gynécologie"),
  cnssEntry("Z-007", "Z", 150, "Scanner (TDM) sans injection", "أشعة مقطعية بدون حقن", 900, "Radiologie", true),
  cnssEntry("Z-008", "Z", 200, "Scanner (TDM) avec injection", "أشعة مقطعية مع حقن", 1200, "Radiologie", true),
  cnssEntry("Z-009", "Z", 250, "IRM sans injection", "رنين مغناطيسي بدون حقن", 1500, "Radiologie", true),
  cnssEntry("Z-010", "Z", 300, "IRM avec injection", "رنين مغناطيسي مع حقن", 1800, "Radiologie", true),
  cnssEntry("Z-011", "Z", 40, "Mammographie bilatérale", "تصوير الثدي بالأشعة", 480, "Radiologie"),
  cnssEntry("Z-012", "Z", 30, "Panoramique dentaire", "أشعة بانورامية للأسنان", 360, "Dentaire"),

  // ── Biologie / Laboratoire (B) ──
  cnssEntry("B-001", "B", 40, "Numération formule sanguine (NFS)", "تحليل الدم الشامل", 60, "Laboratoire"),
  cnssEntry("B-002", "B", 15, "Glycémie à jeun", "قياس السكر صائم", 22.5, "Laboratoire"),
  cnssEntry("B-003", "B", 30, "Hémoglobine glyquée (HbA1c)", "الهيموغلوبين السكري", 45, "Laboratoire"),
  cnssEntry("B-004", "B", 15, "Créatinine", "الكرياتينين", 22.5, "Laboratoire"),
  cnssEntry("B-005", "B", 15, "Urée sanguine", "اليوريا في الدم", 22.5, "Laboratoire"),
  cnssEntry("B-006", "B", 30, "Bilan lipidique complet", "تحليل الدهون الكامل", 45, "Laboratoire"),
  cnssEntry("B-007", "B", 20, "Transaminases (ASAT/ALAT)", "إنزيمات الكبد", 30, "Laboratoire"),
  cnssEntry("B-008", "B", 50, "Bilan thyroïdien (TSH + T4)", "تحليل الغدة الدرقية", 75, "Laboratoire"),
  cnssEntry("B-009", "B", 25, "Vitesse de sédimentation (VS)", "سرعة الترسيب", 37.5, "Laboratoire"),
  cnssEntry("B-010", "B", 30, "CRP (protéine C réactive)", "بروتين سي التفاعلي", 45, "Laboratoire"),
  cnssEntry("B-011", "B", 20, "Examen cytobactériologique des urines (ECBU)", "تحليل البول الجرثومي", 30, "Laboratoire"),
  cnssEntry("B-012", "B", 60, "PSA (Antigène prostatique)", "مستضد البروستات", 90, "Laboratoire"),
  cnssEntry("B-013", "B", 40, "Sérologie hépatite B (AgHBs)", "فحص التهاب الكبد ب", 60, "Laboratoire"),
  cnssEntry("B-014", "B", 40, "Sérologie hépatite C", "فحص التهاب الكبد ج", 60, "Laboratoire"),
  cnssEntry("B-015", "B", 80, "Bilan prénatal complet", "التحاليل ما قبل الولادة", 120, "Laboratoire"),

  // ── Actes dentaires (D) ──
  cnssEntry("D-001", "D", 8, "Consultation dentaire", "استشارة طبيب الأسنان", 80, "Dentaire"),
  cnssEntry("D-002", "D", 15, "Extraction dentaire simple", "خلع سن بسيط", 150, "Dentaire"),
  cnssEntry("D-003", "D", 30, "Extraction dentaire chirurgicale", "خلع سن جراحي", 300, "Dentaire"),
  cnssEntry("D-004", "D", 25, "Dévitalisation monoradiculée", "علاج عصب سن أحادي الجذر", 250, "Dentaire"),
  cnssEntry("D-005", "D", 40, "Dévitalisation multiradiculée", "علاج عصب سن متعدد الجذور", 400, "Dentaire"),
  cnssEntry("D-006", "D", 12, "Obturation (amalgame/composite) 1 face", "حشوة سطح واحد", 120, "Dentaire"),
  cnssEntry("D-007", "D", 18, "Obturation (amalgame/composite) 2 faces", "حشوة سطحين", 180, "Dentaire"),
  cnssEntry("D-008", "D", 10, "Détartrage", "تنظيف الأسنان من الجير", 100, "Dentaire"),
  cnssEntry("D-009", "D", 60, "Couronne céramo-métallique", "تاج خزفي معدني", 600, "Dentaire", true, 0.50),
  cnssEntry("D-010", "D", 80, "Couronne céramo-céramique", "تاج خزفي بالكامل", 800, "Dentaire", true, 0.50),
  cnssEntry("D-011", "D", 50, "Bridge (par élément)", "جسر أسنان (لكل عنصر)", 500, "Dentaire", true, 0.50),
  cnssEntry("D-012", "D", 120, "Prothèse adjointe complète (par arcade)", "طقم أسنان كامل (لكل قوس)", 1200, "Dentaire", true, 0.50),
  cnssEntry("D-013", "D", 25, "Traitement de parodontite (par quadrant)", "علاج اللثة (لكل ربع)", 250, "Dentaire"),
  cnssEntry("D-014", "D", 150, "Implant dentaire", "زرع الأسنان", 1500, "Dentaire", true, 0.50),
  cnssEntry("D-015", "D", 5, "Radiographie rétro-alvéolaire", "أشعة سنية خلفية سنخية", 50, "Dentaire"),

  // ── Actes obstétriques ──
  cnssEntry("KC-020", "KC", 60, "Accouchement par voie basse (normal)", "ولادة طبيعية", 900, "Gynécologie"),
  cnssEntry("KC-021", "KC", 80, "Accouchement dystocique", "ولادة متعسرة", 1200, "Gynécologie"),
  cnssEntry("KC-022", "KC", 20, "Épisiotomie", "شق العجان", 300, "Gynécologie"),
  cnssEntry("KC-023", "KC", 15, "Frottis cervico-vaginal", "مسحة عنق الرحم", 225, "Gynécologie"),

  // ── Kinésithérapie ──
  cnssEntry("K-050", "K", 8, "Séance de kinésithérapie", "جلسة علاج طبيعي", 120, "Kinésithérapie"),
  cnssEntry("K-051", "K", 12, "Séance de rééducation fonctionnelle", "جلسة إعادة تأهيل وظيفي", 180, "Kinésithérapie"),
  cnssEntry("K-052", "K", 10, "Séance de kinésithérapie respiratoire", "جلسة علاج طبيعي تنفسي", 150, "Kinésithérapie"),

  // ── Hospitalisation ──
  cnssEntry("H-001", "K", 1, "Hospitalisation (par jour, chambre commune)", "إقامة في المستشفى (يوم, غرفة مشتركة)", 800, "Hospitalisation", false, 0.90),
  cnssEntry("H-002", "K", 1, "Hospitalisation (par jour, chambre individuelle)", "إقامة في المستشفى (يوم, غرفة فردية)", 1200, "Hospitalisation", false, 0.70),
  cnssEntry("H-003", "K", 1, "Réanimation (par jour)", "إنعاش (يوم)", 3000, "Hospitalisation", true, 0.90),
];

// ---- Lookup Helpers ----

/** Find a CNSS tariff by act code */
export function getCNSSTariffByCode(code: string): CNSSTariffEntry | undefined {
  return CNSS_TARIFFS.find((t) => t.code === code);
}

/** Find all CNSS tariffs for a category */
export function getCNSSTariffsByCategory(category: string): CNSSTariffEntry[] {
  return CNSS_TARIFFS.filter((t) => t.category === category);
}

/** Find all CNSS tariffs for a specialty */
export function getCNSSTariffsBySpecialty(specialty: string): CNSSTariffEntry[] {
  return CNSS_TARIFFS.filter((t) => t.specialty === specialty);
}

/** Search CNSS tariffs by description (French) */
export function searchCNSSTariffs(query: string): CNSSTariffEntry[] {
  const q = query.toLowerCase();
  return CNSS_TARIFFS.filter(
    (t) =>
      t.descriptionFr.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      t.specialty.toLowerCase().includes(q),
  );
}

/** Get all unique specialties in the CNSS tariff table */
export function getCNSSSpecialties(): string[] {
  return [...new Set(CNSS_TARIFFS.map((t) => t.specialty))];
}

/** Get all unique categories in the CNSS tariff table */
export function getCNSSCategories(): string[] {
  return [...new Set(CNSS_TARIFFS.map((t) => t.category))];
}
