import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import {
  getPublicDoctors,
  getPublicServices,
  getPublicSpecialties,
  getPublicAvailableSlots,
} from "@/lib/data/public";
import { detectLanguage } from "@/lib/support/language-detect";
import { requireTenantWithConfig } from "@/lib/tenant";
import { safeText } from "@/lib/validations/primitives";

const chatBookingIntentSchema = z.object({
  message: safeText.pipe(z.string().min(1).max(2000)),
  step: z
    .enum(["detect_intent", "list_services", "list_doctors", "list_slots", "confirm"])
    .optional()
    .default("detect_intent"),
  context: z
    .object({
      specialty_id: z.string().optional(),
      doctor_id: z.string().optional(),
      service_id: z.string().optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      time: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
      patient_name: z.string().optional(),
      patient_phone: z.string().optional(),
    })
    .optional()
    .default({}),
});

const BOOKING_KEYWORDS: Record<string, string[]> = {
  fr: ["rendez-vous", "rdv", "réserver", "booking", "consultation", "prendre", "planifier"],
  ar: ["موعد", "حجز", "استشارة", "زيارة"],
  en: ["appointment", "book", "schedule", "visit", "consultation", "reserve"],
};

function isBookingIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return Object.values(BOOKING_KEYWORDS).some((keywords) =>
    keywords.some((kw) => lower.includes(kw)),
  );
}

/**
 * POST /api/support/chat-booking
 * Multi-step appointment booking through the chatbot.
 * Integrates with the existing booking data infrastructure.
 */
export const POST = withValidation(chatBookingIntentSchema, async (data, _request: NextRequest) => {
  await requireTenantWithConfig();
  const language = detectLanguage(data.message);

  const messages: Record<string, Record<string, string>> = {
    detect_intent: {
      fr: "Je peux vous aider à prendre un rendez-vous. Voici nos services disponibles :",
      ar: "يمكنني مساعدتك في حجز موعد. إليك خدماتنا المتاحة:",
      en: "I can help you book an appointment. Here are our available services:",
    },
    no_booking: {
      fr: "Je n'ai pas détecté une demande de rendez-vous. Pouvez-vous reformuler ?",
      ar: "لم أفهم طلب حجز. هل يمكنك إعادة الصياغة؟",
      en: "I didn't detect a booking request. Could you rephrase?",
    },
    select_doctor: {
      fr: "Veuillez choisir un médecin :",
      ar: "يرجى اختيار طبيب:",
      en: "Please choose a doctor:",
    },
    select_slot: {
      fr: "Voici les créneaux disponibles :",
      ar: "إليك المواعيد المتاحة:",
      en: "Here are the available slots:",
    },
    no_slots: {
      fr: "Aucun créneau disponible pour cette date. Essayez une autre date.",
      ar: "لا توجد مواعيد متاحة لهذا التاريخ. جرب تاريخاً آخر.",
      en: "No slots available for this date. Try another date.",
    },
    booking_info: {
      fr: "Pour confirmer votre rendez-vous, veuillez fournir votre nom et numéro de téléphone.",
      ar: "لتأكيد موعدك، يرجى تقديم اسمك ورقم هاتفك.",
      en: "To confirm your appointment, please provide your name and phone number.",
    },
  };

  const msg = (key: string): string => messages[key]?.[language] ?? messages[key]?.fr ?? "";

  if (data.step === "detect_intent") {
    if (!isBookingIntent(data.message)) {
      return apiSuccess({
        reply: msg("no_booking"),
        step: "detect_intent",
        booking_detected: false,
      });
    }

    const services = await getPublicServices();
    return apiSuccess({
      reply: msg("detect_intent"),
      step: "list_services",
      booking_detected: true,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration: s.duration,
        category: s.category,
      })),
      language,
    });
  }

  if (data.step === "list_services" || data.step === "list_doctors") {
    const doctors = await getPublicDoctors();
    const specialties = await getPublicSpecialties(doctors);

    return apiSuccess({
      reply: msg("select_doctor"),
      step: "list_doctors",
      doctors: doctors.map((d) => ({
        id: d.id,
        name: d.name,
      })),
      specialties: specialties.map((s) => ({
        id: s.id,
        name: s.name,
      })),
      language,
    });
  }

  if (data.step === "list_slots") {
    const ctx = data.context;
    if (!ctx.date || !ctx.doctor_id) {
      return apiError("Date and doctor_id required for slot listing", 400, "VALIDATION_ERROR");
    }

    const availableSlots = await getPublicAvailableSlots(ctx.date, ctx.doctor_id);

    if (availableSlots.length === 0) {
      return apiSuccess({ reply: msg("no_slots"), step: "list_slots", slots: [], language });
    }

    return apiSuccess({
      reply: msg("select_slot"),
      step: "list_slots",
      slots: availableSlots.map((time) => ({ time })),
      language,
    });
  }

  if (data.step === "confirm") {
    return apiSuccess({
      reply: msg("booking_info"),
      step: "confirm",
      booking_url: "/booking",
      language,
    });
  }

  return apiSuccess({ reply: msg("no_booking"), step: "detect_intent", language });
});
