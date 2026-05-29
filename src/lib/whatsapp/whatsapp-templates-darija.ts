/**
 * Templates Darija pour WhatsApp — Cliniques marocaines
 *
 * Adapté du pattern whatsapp-receptionist (templates multilingues avec
 * variables positionnelles pour Meta Business API).
 *
 * Chaque template a:
 * - Un nom unique compatible Meta (snake_case)
 * - Le corps en Darija marocain
 * - La catégorie Meta (UTILITY/MARKETING)
 * - Les variables nommées mappées aux positions Meta {{1}}, {{2}}, etc.
 *
 * Voir docs/whatsapp-template-approval.md pour la soumission à Meta.
 */

// ── Types ──

export interface DarijaTemplate {
  metaTemplateName: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: "ar";
  bodyTemplate: string;
  variables: string[];
  description: string;
}

// ── Templates ──

export const DARIJA_TEMPLATES: Record<string, DarijaTemplate> = {
  booking_confirmation_darija: {
    metaTemplateName: "booking_confirmation_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}} 👋\n\n" +
      "الموعد ديالك تأكد ✅\n\n" +
      "🩺 دكتور: {{doctor_name}}\n" +
      "📅 نهار: {{date}}\n" +
      "🕐 الوقت: {{time}}\n" +
      "💼 الخدمة: {{service_name}}\n" +
      "📍 العنوان: {{clinic_address}}\n\n" +
      "إلا بغيتي تبدل ولا تلغي: {{manage_url}}\n\n" +
      "{{clinic_name}}",
    variables: [
      "patient_name",
      "doctor_name",
      "date",
      "time",
      "service_name",
      "clinic_address",
      "manage_url",
      "clinic_name",
    ],
    description: "Confirmation de rendez-vous en Darija",
  },

  reminder_24h_darija: {
    metaTemplateName: "reminder_24h_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}} 👋\n\n" +
      "تذكير: عندك موعد غدا ✨\n\n" +
      "🩺 دكتور: {{doctor_name}}\n" +
      "🕐 الوقت: {{time}}\n" +
      "📍 العنوان: {{clinic_address}}\n\n" +
      "إلا مقديتيش تجي، عافاك خبرنا قبل.\n\n" +
      "{{clinic_name}}",
    variables: ["patient_name", "doctor_name", "time", "clinic_address", "clinic_name"],
    description: "Rappel 24h avant le rendez-vous en Darija",
  },

  reminder_2h_darija: {
    metaTemplateName: "reminder_2h_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}} 👋\n\n" +
      "تذكير: الموعد ديالك بعد ساعتين ⏰\n\n" +
      "🩺 دكتور: {{doctor_name}}\n" +
      "🕐 الوقت: {{time}}\n" +
      "📍 العنوان: {{clinic_address}}\n\n" +
      "{{clinic_name}}",
    variables: ["patient_name", "doctor_name", "time", "clinic_address", "clinic_name"],
    description: "Rappel 2h avant le rendez-vous en Darija",
  },

  cancellation_darija: {
    metaTemplateName: "cancellation_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}}\n\n" +
      "الموعد ديالك مع Dr. {{doctor_name}} نهار {{date}} فالوقت {{time}} تلغى.\n\n" +
      "إلا بغيتي تاخد موعد جديد، تواصل معانا: {{clinic_phone}}\n\n" +
      "{{clinic_name}}",
    variables: ["patient_name", "doctor_name", "date", "time", "clinic_phone", "clinic_name"],
    description: "Annulation de rendez-vous en Darija",
  },

  prescription_ready_darija: {
    metaTemplateName: "prescription_ready_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}} 👋\n\n" +
      "الوصفة الطبية ديالك جاهزة 💊\n\n" +
      "🩺 دكتور: {{doctor_name}}\n" +
      "📋 الأدوية: {{medication_list}}\n\n" +
      "تقدر تشوفها هنا: {{prescription_url}}\n\n" +
      "{{clinic_name}}",
    variables: [
      "patient_name",
      "doctor_name",
      "medication_list",
      "prescription_url",
      "clinic_name",
    ],
    description: "Ordonnance prête en Darija",
  },

  lab_results_ready_darija: {
    metaTemplateName: "lab_results_ready_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}} 👋\n\n" +
      "نتائج التحاليل ديالك جاهزة ✅\n\n" +
      "🔬 {{test_name}}\n\n" +
      "شوف النتائج هنا بشكل آمن: {{results_url}}\n\n" +
      "{{clinic_name}}",
    variables: ["patient_name", "test_name", "results_url", "clinic_name"],
    description: "Résultats de laboratoire prêts en Darija",
  },

  payment_reminder_darija: {
    metaTemplateName: "payment_reminder_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}} 👋\n\n" +
      "عندك فاتورة خاصها تتخلص 💳\n\n" +
      "💰 المبلغ: {{amount}} درهم\n" +
      "📅 آخر أجل: {{due_date}}\n\n" +
      "خلص من هنا: {{payment_url}}\n\n" +
      "{{clinic_name}}",
    variables: ["patient_name", "amount", "due_date", "payment_url", "clinic_name"],
    description: "Rappel de paiement en Darija",
  },

  voice_booking_confirmed_darija: {
    metaTemplateName: "voice_booking_confirmed_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}} 👋\n\n" +
      "الموعد اللي طلبتي بالصوت تأكد ✅\n\n" +
      "🩺 دكتور: {{doctor_name}}\n" +
      "📅 نهار: {{date}}\n" +
      "🕐 الوقت: {{time}}\n\n" +
      "إلا بغيتي تبدل ولا تلغي: {{manage_url}}\n\n" +
      "{{clinic_name}}",
    variables: ["patient_name", "doctor_name", "date", "time", "manage_url", "clinic_name"],
    description: "Confirmation de rendez-vous vocal en Darija",
  },

  consent_request_darija: {
    metaTemplateName: "consent_request_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}} 👋\n\n" +
      "باش نقدرو نتواصلو معاك على واتساب، خاصنا الموافقة ديالك.\n\n" +
      "المعلومات ديالك محمية حسب القانون 09-08.\n\n" +
      "رد OUI باش توافق ولا NON باش ترفض.\n\n" +
      "{{clinic_name}}",
    variables: ["patient_name", "clinic_name"],
    description: "Demande de consentement WhatsApp en Darija",
  },

  no_show_followup_darija: {
    metaTemplateName: "no_show_followup_darija",
    category: "UTILITY",
    language: "ar",
    bodyTemplate:
      "السلام {{patient_name}} 👋\n\n" +
      "لاحظنا أنك ما جيتيش للموعد ديالك مع Dr. {{doctor_name}} نهار {{date}}.\n\n" +
      "إلا بغيتي تاخد موعد جديد، رد على هاد الرسالة ب 'rdv'.\n\n" +
      "{{clinic_name}}",
    variables: ["patient_name", "doctor_name", "date", "clinic_name"],
    description: "Suivi de rendez-vous manqué en Darija",
  },
};

// ── Utilitaires ──

/**
 * Résoudre un template Darija en remplaçant les variables nommées.
 */
export function renderDarijaTemplate(
  templateKey: string,
  variables: Record<string, string>,
): string | null {
  const template = DARIJA_TEMPLATES[templateKey];
  if (!template) return null;

  let rendered = template.bodyTemplate;
  for (const varName of template.variables) {
    const value = variables[varName] ?? "";
    rendered = rendered.replace(new RegExp(`\\{\\{${varName}\\}\\}`, "g"), value);
  }

  return rendered;
}

/**
 * Convertir les variables nommées en variables positionnelles Meta ({{1}}, {{2}}, etc.)
 * pour la soumission de templates à Meta Business API.
 */
export function toMetaPositionalBody(templateKey: string): string | null {
  const template = DARIJA_TEMPLATES[templateKey];
  if (!template) return null;

  let body = template.bodyTemplate;
  template.variables.forEach((varName, index) => {
    body = body.replace(new RegExp(`\\{\\{${varName}\\}\\}`, "g"), `{{${index + 1}}}`);
  });

  return body;
}

/**
 * Obtenir tous les templates pour une catégorie donnée.
 */
export function getTemplatesByCategory(
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION",
): DarijaTemplate[] {
  return Object.values(DARIJA_TEMPLATES).filter((t) => t.category === category);
}
