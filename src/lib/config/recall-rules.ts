/**
 * Dental recall rules & localized recall messages.
 *
 * The recall engine brings patients back for recurring care. Each rule maps a
 * dental service (matched by a normalized substring of its name) to a recall
 * type and the interval, in days, after which the patient should be contacted:
 *
 *   - détartrage / cleaning  → 180 days (6-month hygiene recall)
 *   - orthodontie            → 30 days  (monthly adjustment follow-up)
 *   - implant                → 180 days (implant control)
 *
 * Only services with an explicit rule generate recalls — we never blanket-spam
 * patients for one-off acts (extractions, consultations, etc.).
 *
 * This module is pure (no I/O) so the matching and message logic is unit-testable.
 */

export type RecallType = "detartrage" | "orthodontic" | "implant";

export interface RecallRule {
  recallType: RecallType;
  /** Days after the completed visit to schedule the recall. */
  intervalDays: number;
}

interface RecallServiceMatcher {
  /** Lowercased, accent-free substrings that identify the service. */
  keywords: string[];
  rule: RecallRule;
}

/**
 * Ordered matchers — the first whose keyword appears in the service name wins.
 * Implant is checked before détartrage so an "implant + détartrage" style name
 * resolves to the implant control.
 */
const RECALL_MATCHERS: RecallServiceMatcher[] = [
  {
    keywords: ["implant"],
    rule: { recallType: "implant", intervalDays: 180 },
  },
  {
    keywords: ["orthodont", "ortho", "bagues", "aligneur"],
    rule: { recallType: "orthodontic", intervalDays: 30 },
  },
  {
    keywords: ["detartr", "detartrage", "scaling", "hygiene", "nettoyage", "cleaning"],
    rule: { recallType: "detartrage", intervalDays: 180 },
  },
];

/** Strip accents and lowercase so "Détartrage" matches "detartr". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Resolve the recall rule for a service name, or null when the service is not
 * recall-eligible.
 */
export function matchRecallRule(serviceName: string | null | undefined): RecallRule | null {
  if (!serviceName) return null;
  const normalized = normalize(serviceName);
  for (const matcher of RECALL_MATCHERS) {
    if (matcher.keywords.some((keyword) => normalized.includes(keyword))) {
      return matcher.rule;
    }
  }
  return null;
}

/**
 * Compute the recall due date (YYYY-MM-DD) from a completed-visit date.
 * Returns null when the completed date cannot be parsed.
 */
export function computeRecallDueDate(
  completedDate: string | Date,
  intervalDays: number,
): string | null {
  const base = completedDate instanceof Date ? completedDate : new Date(completedDate);
  if (Number.isNaN(base.getTime())) return null;
  const due = new Date(base.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return due.toISOString().slice(0, 10);
}

// ── Localized recall messages ──

type RecallLocale = "fr" | "ar" | "ary" | "en";

/**
 * WhatsApp recall message bodies per recall type and locale.
 * Uses {{patient_name}} / {{clinic_name}} placeholders substituted by the
 * caller via `substituteVariables` from notifications.ts.
 */
const RECALL_MESSAGES: Record<RecallType, Record<RecallLocale, string>> = {
  detartrage: {
    fr: "Bonjour {{patient_name}}, cela fait 6 mois depuis votre dernier détartrage. Pour garder des gencives saines, il est temps de prendre rendez-vous. Répondez à ce message ou appelez-nous pour réserver. — {{clinic_name}}",
    ar: "مرحباً {{patient_name}}، لقد مرّت 6 أشهر على آخر تنظيف لأسنانك. للحفاظ على لثة سليمة، حان وقت حجز موعد. ردّ على هذه الرسالة أو اتصل بنا للحجز. — {{clinic_name}}",
    ary: "سلام {{patient_name}}، دازت 6 شهور من آخر تنقية ديال سنانك. باش تبقى اللثة صحية، وقت تاخد موعد. جاوب على هاد الميساج ولا عيّط لينا باش تحجز. — {{clinic_name}}",
    en: "Hello {{patient_name}}, it's been 6 months since your last dental cleaning. To keep your gums healthy, it's time to book an appointment. Reply to this message or call us to book. — {{clinic_name}}",
  },
  orthodontic: {
    fr: "Bonjour {{patient_name}}, il est temps de votre contrôle orthodontique. Prenez rendez-vous pour ajuster votre traitement. Répondez à ce message ou appelez-nous. — {{clinic_name}}",
    ar: "مرحباً {{patient_name}}، حان وقت مراجعة تقويم أسنانك. احجز موعداً لضبط علاجك. ردّ على هذه الرسالة أو اتصل بنا. — {{clinic_name}}",
    ary: "سلام {{patient_name}}، وقت المراقبة ديال التقويم ديال سنانك. حجز موعد باش نعدلو العلاج. جاوب على هاد الميساج ولا عيّط لينا. — {{clinic_name}}",
    en: "Hello {{patient_name}}, it's time for your orthodontic check-up to adjust your treatment. Reply to this message or call us to book. — {{clinic_name}}",
  },
  implant: {
    fr: "Bonjour {{patient_name}}, un contrôle de votre implant dentaire est recommandé. Prenez rendez-vous pour vérifier que tout va bien. Répondez à ce message ou appelez-nous. — {{clinic_name}}",
    ar: "مرحباً {{patient_name}}، ننصح بإجراء فحص لزراعة أسنانك. احجز موعداً للتأكد من أن كل شيء على ما يرام. ردّ على هذه الرسالة أو اتصل بنا. — {{clinic_name}}",
    ary: "سلام {{patient_name}}، خاصك مراقبة ديال الزرع ديال سنانك. حجز موعد باش نتأكدو بلي كلشي مزيان. جاوب على هاد الميساج ولا عيّط لينا. — {{clinic_name}}",
    en: "Hello {{patient_name}}, a check-up of your dental implant is recommended. Book an appointment so we can make sure everything is fine. Reply to this message or call us. — {{clinic_name}}",
  },
};

function toRecallLocale(locale: string | null | undefined): RecallLocale {
  if (locale === "ar" || locale === "ary" || locale === "en") return locale;
  return "fr";
}

/**
 * Return the localized recall message body (with placeholders intact) for a
 * recall type and locale, falling back to French for unknown locales.
 */
export function getRecallMessageTemplate(recallType: RecallType, locale: string): string {
  return RECALL_MESSAGES[recallType][toRecallLocale(locale)];
}
