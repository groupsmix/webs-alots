/**
 * Multi-language response templates for the chatbot.
 * Provides localized responses in French, Arabic, and English.
 */

import type { SupportedLanguage } from "@/lib/validations/support";

type ResponseKey =
  | "greeting"
  | "hours_unavailable"
  | "services_unavailable"
  | "doctors_unavailable"
  | "contact_unavailable"
  | "booking_prompt"
  | "thanks"
  | "default_help"
  | "escalation"
  | "faq_no_match"
  | "booking_detected";

const RESPONSES: Record<ResponseKey, Record<SupportedLanguage, string>> = {
  greeting: {
    fr: "Bonjour ! Bienvenue chez {clinicName}. Comment puis-je vous aider ?",
    ar: "مرحباً! أهلاً بكم في {clinicName}. كيف يمكنني مساعدتكم؟",
    en: "Hello! Welcome to {clinicName}. How can I help you?",
  },
  hours_unavailable: {
    fr: "Les horaires de {clinicName} ne sont pas encore configurés. Veuillez nous contacter directement.",
    ar: "مواعيد عمل {clinicName} غير متوفرة حالياً. يرجى الاتصال بنا مباشرة.",
    en: "The hours for {clinicName} are not yet configured. Please contact us directly.",
  },
  services_unavailable: {
    fr: "Les services de {clinicName} ne sont pas encore configurés. Contactez-nous pour plus d'informations.",
    ar: "خدمات {clinicName} غير متوفرة حالياً. اتصلوا بنا لمزيد من المعلومات.",
    en: "Services for {clinicName} are not yet configured. Contact us for more information.",
  },
  doctors_unavailable: {
    fr: "Aucun praticien n'est encore configuré pour {clinicName}.",
    ar: "لم يتم تسجيل أي طبيب في {clinicName} بعد.",
    en: "No practitioners are configured for {clinicName} yet.",
  },
  contact_unavailable: {
    fr: "Les coordonnées de {clinicName} ne sont pas encore configurées.",
    ar: "بيانات الاتصال بـ {clinicName} غير متوفرة حالياً.",
    en: "Contact information for {clinicName} is not yet configured.",
  },
  booking_prompt: {
    fr: "Pour prendre un rendez-vous chez {clinicName}, utilisez notre page de réservation en ligne ou contactez-nous directement.",
    ar: "لحجز موعد في {clinicName}، استخدموا صفحة الحجز عبر الإنترنت أو اتصلوا بنا مباشرة.",
    en: "To book an appointment at {clinicName}, use our online booking page or contact us directly.",
  },
  thanks: {
    fr: "Je vous en prie ! N'hésitez pas si vous avez d'autres questions.",
    ar: "على الرحب والسعة! لا تترددوا إذا كانت لديكم أسئلة أخرى.",
    en: "You're welcome! Don't hesitate if you have more questions.",
  },
  default_help: {
    fr: "Merci pour votre message. Je suis l'assistant virtuel de {clinicName}. Je peux vous aider avec :\n• Les services et tarifs\n• Les horaires d'ouverture\n• Les coordonnées du cabinet\n• La prise de rendez-vous\n• Nos praticiens",
    ar: "شكراً على رسالتكم. أنا المساعد الافتراضي لـ {clinicName}. يمكنني مساعدتكم في:\n• الخدمات والأسعار\n• ساعات العمل\n• بيانات الاتصال\n• حجز المواعيد\n• الأطباء",
    en: "Thank you for your message. I'm the virtual assistant for {clinicName}. I can help you with:\n• Services and prices\n• Opening hours\n• Contact information\n• Booking appointments\n• Our practitioners",
  },
  escalation: {
    fr: "Je vais transférer votre demande à un membre de notre équipe. Veuillez patienter.",
    ar: "سأقوم بتحويل طلبكم إلى أحد أعضاء فريقنا. يرجى الانتظار.",
    en: "I'll transfer your request to a team member. Please wait.",
  },
  faq_no_match: {
    fr: "Je n'ai pas trouvé de réponse exacte. Voulez-vous que je transfère votre question à notre équipe ?",
    ar: "لم أجد إجابة دقيقة. هل تريدون أن أحول سؤالكم لفريقنا؟",
    en: "I couldn't find an exact answer. Would you like me to forward your question to our team?",
  },
  booking_detected: {
    fr: "Je peux vous aider à prendre un rendez-vous. Voici nos services disponibles :",
    ar: "يمكنني مساعدتكم في حجز موعد. إليكم خدماتنا المتاحة:",
    en: "I can help you book an appointment. Here are our available services:",
  },
};

export function getLocalizedResponse(
  key: ResponseKey,
  language: SupportedLanguage,
  variables?: Record<string, string>,
): string {
  let response = RESPONSES[key][language] ?? RESPONSES[key].fr;
  if (variables) {
    for (const [varKey, value] of Object.entries(variables)) {
      response = response.replace(new RegExp(`\\{${varKey}\\}`, "g"), value);
    }
  }
  return response;
}

export function getSystemPromptForLanguage(language: SupportedLanguage): string {
  const prompts: Record<SupportedLanguage, string> = {
    fr: "Réponds en français. Sois concis, professionnel et amical.",
    ar: "أجب باللغة العربية. كن موجزاً ومهنياً وودوداً.",
    en: "Respond in English. Be concise, professional, and friendly.",
  };
  return prompts[language];
}
