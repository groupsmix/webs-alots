/**
 * Arabic Translations for Prescription Documents
 *
 * Common medical phrases and medication instructions translated
 * from French to Arabic for bilingual prescriptions.
 * Used in the two-column (FR | AR) prescription PDF layout.
 */

// ---- Medication Frequency Translations ----

const FREQUENCY_MAP: Record<string, string> = {
  // Common French frequency terms → Arabic
  "1 fois par jour": "مرة واحدة في اليوم",
  "2 fois par jour": "مرتين في اليوم",
  "3 fois par jour": "3 مرات في اليوم",
  "4 fois par jour": "4 مرات في اليوم",
  "une fois par jour": "مرة واحدة في اليوم",
  "deux fois par jour": "مرتين في اليوم",
  "trois fois par jour": "3 مرات في اليوم",
  "quatre fois par jour": "4 مرات في اليوم",
  "toutes les 4 heures": "كل 4 ساعات",
  "toutes les 6 heures": "كل 6 ساعات",
  "toutes les 8 heures": "كل 8 ساعات",
  "toutes les 12 heures": "كل 12 ساعة",
  "matin et soir": "صباحاً ومساءً",
  "le matin": "في الصباح",
  "le soir": "في المساء",
  "au coucher": "عند النوم",
  "avant le repas": "قبل الأكل",
  "après le repas": "بعد الأكل",
  "pendant le repas": "أثناء الأكل",
  "à jeun": "على الريق",
  "si besoin": "عند الحاجة",
  "en cas de douleur": "عند الألم",
  "en cas de fièvre": "عند ارتفاع الحرارة",
};

// ---- Medication Instruction Translations ----

const INSTRUCTION_MAP: Record<string, string> = {
  // Common medication instructions FR → AR
  "prendre avec de l'eau": "يؤخذ مع الماء",
  "à prendre avec un grand verre d'eau": "يؤخذ مع كوب كبير من الماء",
  "ne pas croquer": "لا يُمضغ",
  "à avaler entier": "يُبلع كاملاً",
  "voie orale": "عن طريق الفم",
  "voie rectale": "عن طريق الشرج",
  "voie nasale": "عن طريق الأنف",
  "usage externe": "للاستعمال الخارجي",
  "application locale": "للاستعمال الموضعي",
  "appliquer sur la zone affectée": "يوضع على المنطقة المصابة",
  "injection sous-cutanée": "حقن تحت الجلد",
  "injection intramusculaire": "حقن في العضل",
  "collyre": "قطرة للعين",
  "gouttes auriculaires": "قطرة للأذن",
  "sirop": "شراب",
  "comprimé": "قرص",
  "gélule": "كبسولة",
  "suppositoire": "تحميلة",
  "pommade": "مرهم",
  "crème": "كريم",
  "gel": "جل",
  "sachet": "كيس",
  "ampoule": "أمبولة",
  "spray": "بخاخ",
  "patch": "لصقة طبية",
  "ne pas dépasser la dose prescrite": "لا تتجاوز الجرعة الموصوفة",
  "tenir hors de portée des enfants": "يُحفظ بعيداً عن متناول الأطفال",
  "conserver au réfrigérateur": "يُحفظ في الثلاجة",
  "agiter avant utilisation": "يُرج قبل الاستعمال",
  "éviter l'exposition au soleil": "تجنب التعرض لأشعة الشمس",
  "ne pas conduire après la prise": "لا تقد السيارة بعد تناول الدواء",
};

// ---- Duration Translations ----

const DURATION_MAP: Record<string, string> = {
  "1 jour": "يوم واحد",
  "2 jours": "يومين",
  "3 jours": "3 أيام",
  "4 jours": "4 أيام",
  "5 jours": "5 أيام",
  "6 jours": "6 أيام",
  "7 jours": "7 أيام",
  "10 jours": "10 أيام",
  "14 jours": "14 يوماً",
  "15 jours": "15 يوماً",
  "21 jours": "21 يوماً",
  "30 jours": "30 يوماً",
  "1 semaine": "أسبوع واحد",
  "2 semaines": "أسبوعين",
  "3 semaines": "3 أسابيع",
  "4 semaines": "4 أسابيع",
  "1 mois": "شهر واحد",
  "2 mois": "شهرين",
  "3 mois": "3 أشهر",
  "6 mois": "6 أشهر",
  "jusqu'à amélioration": "حتى التحسن",
  "traitement continu": "علاج مستمر",
};

// ---- Label Translations ----

export const PRESCRIPTION_LABELS_AR: Record<string, string> = {
  // Header
  "Ordonnance Médicale": "وصفة طبية",
  "Prescription": "وصفة طبية",
  "Date": "التاريخ",
  "Dr.": "د.",

  // Patient info
  "Informations du patient": "معلومات المريض",
  "Patient Information": "معلومات المريض",
  "Nom": "الاسم",
  "Name": "الاسم",
  "Âge": "العمر",
  "Age": "العمر",
  "Sexe": "الجنس",
  "Gender": "الجنس",
  "Masculin": "ذكر",
  "Male": "ذكر",
  "Féminin": "أنثى",
  "Female": "أنثى",

  // Diagnosis
  "Diagnostic": "التشخيص",
  "Diagnosis": "التشخيص",

  // Medication table
  "Médicament": "الدواء",
  "Medication": "الدواء",
  "Posologie": "الجرعة",
  "Dosage": "الجرعة",
  "Fréquence": "عدد المرات",
  "Frequency": "عدد المرات",
  "Durée": "المدة",
  "Duration": "المدة",
  "Instructions": "تعليمات",

  // Notes
  "Notes supplémentaires": "ملاحظات إضافية",
  "Additional Notes": "ملاحظات إضافية",

  // Signature
  "Signature du médecin": "توقيع الطبيب",
  "Physician Signature": "توقيع الطبيب",

  // QR
  "Scannez le QR code pour vérifier l'ordonnance": "امسح رمز QR للتحقق من الوصفة",
  "Ordonnance électronique": "وصفة إلكترونية",

  // Footer
  "Prescription générée le": "تم إنشاء الوصفة في",
};

/**
 * Translate a French frequency string to Arabic.
 * Uses exact match first, then tries partial matching.
 */
export function translateFrequency(frenchText: string): string {
  if (!frenchText) return "";
  const lower = frenchText.toLowerCase().trim();

  // Exact match
  if (FREQUENCY_MAP[lower]) return FREQUENCY_MAP[lower];

  // Try each key as a substring match
  for (const [key, value] of Object.entries(FREQUENCY_MAP)) {
    if (lower.includes(key)) return value;
  }

  // Numeric pattern: "X fois par jour"
  const timesPerDay = lower.match(/(\d+)\s*fois\s*par\s*jour/);
  if (timesPerDay) {
    return `${timesPerDay[1]} مرات في اليوم`;
  }

  // Interval pattern: "toutes les X heures"
  const everyHours = lower.match(/toutes\s*les\s*(\d+)\s*heures/);
  if (everyHours) {
    return `كل ${everyHours[1]} ساعات`;
  }

  return frenchText; // Return original if no translation found
}

/**
 * Translate a French instruction string to Arabic.
 * Uses exact match first, then tries partial matching.
 */
export function translateInstruction(frenchText: string): string {
  if (!frenchText) return "";
  const lower = frenchText.toLowerCase().trim();

  // Exact match
  if (INSTRUCTION_MAP[lower]) return INSTRUCTION_MAP[lower];

  // Try each key as a substring match
  for (const [key, value] of Object.entries(INSTRUCTION_MAP)) {
    if (lower.includes(key)) return value;
  }

  return frenchText; // Return original if no translation found
}

/**
 * Translate a French duration string to Arabic.
 * Uses exact match first, then tries numeric pattern matching.
 */
export function translateDuration(frenchText: string): string {
  if (!frenchText) return "";
  const lower = frenchText.toLowerCase().trim();

  // Exact match
  if (DURATION_MAP[lower]) return DURATION_MAP[lower];

  // Try each key as a substring match
  for (const [key, value] of Object.entries(DURATION_MAP)) {
    if (lower.includes(key)) return value;
  }

  // Numeric pattern: "X jours"
  const days = lower.match(/(\d+)\s*jours?/);
  if (days) {
    const n = parseInt(days[1]);
    if (n <= 2) return n === 1 ? "يوم واحد" : "يومين";
    if (n <= 10) return `${n} أيام`;
    return `${n} يوماً`;
  }

  // Numeric pattern: "X semaines"
  const weeks = lower.match(/(\d+)\s*semaines?/);
  if (weeks) {
    const n = parseInt(weeks[1]);
    if (n === 1) return "أسبوع واحد";
    if (n === 2) return "أسبوعين";
    return `${n} أسابيع`;
  }

  // Numeric pattern: "X mois"
  const months = lower.match(/(\d+)\s*mois/);
  if (months) {
    const n = parseInt(months[1]);
    if (n === 1) return "شهر واحد";
    if (n === 2) return "شهرين";
    return `${n} أشهر`;
  }

  return frenchText; // Return original if no translation found
}

/**
 * Translate a gender label to Arabic.
 */
export function translateGender(gender: string): string {
  if (!gender) return "";
  const g = gender.toUpperCase();
  if (g === "M" || g === "MALE" || g === "MASCULIN") return "ذكر";
  if (g === "F" || g === "FEMALE" || g === "FÉMININ" || g === "FEMININ") return "أنثى";
  return gender;
}

/**
 * Get Arabic label for a given French label.
 */
export function getArabicLabel(frenchLabel: string): string {
  return PRESCRIPTION_LABELS_AR[frenchLabel] ?? frenchLabel;
}
