/**
 * Automatic Health Tip Generator.
 *
 * Maps diagnosis codes or condition categories to personalized health
 * tips (in Darija and French) to be sent automatically to patients
 * after their consultation.
 */

export interface HealthTip {
  condition: string;
  tipFr: string;
  tipAr: string; // Typically Darija for SMS/WhatsApp
}

// ── Health Tips Database ─────────────────────────────────────────────────────

const HEALTH_TIPS_DB: Record<string, HealthTip> = {
  // Diabetes (E10-E14)
  "DIABETE": {
    condition: "Diabète",
    tipFr: "N'oubliez pas de boire beaucoup d'eau et de marcher 30 minutes par jour. Évitez les sucres rapides (sodas, pâtisseries).",
    tipAr: "عفاك متنساش تشرب الما بزاف وتتمشى 30 دقيقة فاليوم. حاول تبعد على الحلاوة والمونادا."
  },
  
  // Hypertension (I10-I15)
  "HYPERTENSION": {
    condition: "Hypertension",
    tipFr: "Pour votre tension, pensez à réduire le sel dans vos repas. Évitez d'ajouter du sel à table.",
    tipAr: "على قبل الطانسيو ديالك، حاول تنقص من الملحة فالماكلة. وماتزيدش الملحة فوق الطبلة."
  },
  
  // Asthma (J45)
  "ASTHME": {
    condition: "Asthme",
    tipFr: "Aérez bien votre chambre tous les jours et évitez les tapis qui retiennent la poussière.",
    tipAr: "هوي البيت ديالك كل نهار وحاول تبعد على الزرابي اللي كيشدو الغبرة."
  },
  
  // Gastritis / Reflux (K20-K31)
  "GASTRIQUE": {
    condition: "Problèmes gastriques",
    tipFr: "Évitez de vous allonger juste après avoir mangé. Attendez au moins 2 heures avant de dormir.",
    tipAr: "ماتنعسش مباشرة من بعد الماكلة. تسنى على الأقل ساعتين عاد تنعس."
  },

  // Lower Back Pain (M54)
  "LOMBALGIE": {
    condition: "Lombalgie",
    tipFr: "Pliez toujours vos genoux pour ramasser un objet par terre, gardez le dos droit.",
    tipAr: "ديما طوي ركابيك فاش تبغي تهز شي حاجة من الأرض، وخلي ظهرك مقاد."
  },

  // General Post-visit (fallback)
  "GENERAL": {
    condition: "Conseil général",
    tipFr: "Pensez à bien suivre votre traitement comme indiqué par le médecin. Bon rétablissement !",
    tipAr: "حاول تبع الدوا ديالك كيفما قال ليك الطبيب. بالشفاء العاجل إن شاء الله!"
  }
};

/**
 * Maps an ICD-10 code to an internal category key for tips.
 */
function mapCodeToCategory(code: string): string | null {
  if (code.startsWith("E1")) return "DIABETE";
  if (code.startsWith("I1")) return "HYPERTENSION";
  if (code.startsWith("J45")) return "ASTHME";
  if (code.startsWith("K2") || code.startsWith("K3")) return "GASTRIQUE";
  if (code.startsWith("M54")) return "LOMBALGIE";
  return null;
}

/**
 * Generates a personalized health tip based on the patient's diagnoses.
 * 
 * @param diagnosisCodes Array of ICD-10 codes from the recent consultation
 */
export function generateHealthTip(diagnosisCodes: string[]): HealthTip {
  if (!diagnosisCodes || diagnosisCodes.length === 0) {
    return HEALTH_TIPS_DB["GENERAL"];
  }

  for (const code of diagnosisCodes) {
    const category = mapCodeToCategory(code);
    if (category && HEALTH_TIPS_DB[category]) {
      return HEALTH_TIPS_DB[category];
    }
  }

  return HEALTH_TIPS_DB["GENERAL"];
}
