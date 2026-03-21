/**
 * Server-side data fetching for the chatbot.
 * Loads clinic context from Supabase so the bot can answer
 * questions about services, doctors, hours, etc.
 */

import { createClient } from "@/lib/supabase-server";

export interface ChatbotClinicContext {
  clinic: {
    id: string;
    name: string;
    type: string;
    tier: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string;
    domain?: string;
    config: Record<string, unknown>;
  } | null;
  services: { name: string; price: number | null; category: string | null; duration_minutes: number }[];
  doctors: { name: string; phone: string | null; email: string | null }[];
  workingHours: { day_of_week: number; start_time: string; end_time: string; is_available: boolean }[];
  faqs: { question: string; answer: string; keywords: string[] }[];
  chatbotConfig: {
    enabled: boolean;
    intelligence: "basic" | "smart" | "advanced";
    greeting: string;
    language: string;
  } | null;
}

/**
 * Fetch all context needed for the chatbot to answer questions
 * about a specific clinic.
 */
export async function fetchChatbotContext(clinicId: string): Promise<ChatbotClinicContext> {
  const supabase = await createClient();

  // Query known tables via typed client
  const [clinicRes, servicesRes, doctorsRes, slotsRes] =
    await Promise.all([
      supabase
        .from("clinics")
        .select("id, name, type, tier, config, domain, city, owner_phone, owner_email")
        .eq("id", clinicId)
        .single(),
      supabase
        .from("services")
        .select("name, price, category, duration_minutes")
        .eq("clinic_id", clinicId),
      supabase
        .from("users")
        .select("name, phone, email")
        .eq("clinic_id", clinicId)
        .eq("role", "doctor"),
      supabase
        .from("time_slots")
        .select("day_of_week, start_time, end_time")
        .eq("clinic_id", clinicId),
    ]);

  // Query chatbot tables (not yet in generated DB types) via untyped client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untypedSupabase = supabase as any;
  const [faqsRes, configRes] = await Promise.all([
    untypedSupabase
      .from("chatbot_faqs")
      .select("question, answer, keywords")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }) as Promise<{ data: { question: string; answer: string; keywords: string[] }[] | null }>,
    untypedSupabase
      .from("chatbot_config")
      .select("enabled, intelligence, greeting, language")
      .eq("clinic_id", clinicId)
      .single() as Promise<{ data: Record<string, unknown> | null }>,
  ]);

  const clinicData = clinicRes.data as Record<string, unknown> | null;

  return {
    clinic: clinicData
      ? {
          id: clinicData.id as string,
          name: clinicData.name as string,
          type: clinicData.type as string,
          tier: clinicData.tier as string,
          address: (clinicData.config as Record<string, unknown>)?.address as string | undefined,
          city: clinicData.city as string | undefined,
          phone: clinicData.owner_phone as string | undefined,
          email: clinicData.owner_email as string | undefined,
          domain: clinicData.domain as string | undefined,
          config: (clinicData.config as Record<string, unknown>) ?? {},
        }
      : null,
    services: ((servicesRes.data ?? []) as { name: string; price: number | null; category: string | null; duration_minutes: number }[]),
    doctors: ((doctorsRes.data ?? []) as { name: string; phone: string | null; email: string | null }[]),
    workingHours: ((slotsRes.data ?? []) as unknown as { day_of_week: number; start_time: string; end_time: string; is_available: boolean }[]),
    faqs: ((faqsRes.data ?? []) as { question: string; answer: string; keywords: string[] }[]),
    chatbotConfig: configRes.data
      ? {
          enabled: (configRes.data as Record<string, unknown>).enabled as boolean,
          intelligence: (configRes.data as Record<string, unknown>).intelligence as "basic" | "smart" | "advanced",
          greeting: (configRes.data as Record<string, unknown>).greeting as string,
          language: (configRes.data as Record<string, unknown>).language as string,
        }
      : null,
  };
}

/**
 * Build a system prompt from clinic context for AI-powered responses.
 */
export function buildSystemPrompt(ctx: ChatbotClinicContext): string {
  const { clinic, services, doctors, workingHours, faqs } = ctx;
  if (!clinic) return "You are a helpful clinic assistant.";

  const typeLabels: Record<string, string> = {
    doctor: "cabinet médical",
    dentist: "cabinet dentaire",
    pharmacy: "pharmacie",
  };

  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  const hoursText = workingHours.length > 0
    ? workingHours
        .filter((s) => s.is_available)
        .map((s) => `${dayNames[s.day_of_week]}: ${s.start_time} - ${s.end_time}`)
        .join("\n")
    : "Non renseigné";

  const servicesText = services.length > 0
    ? services
        .map((s) => {
          const price = s.price != null ? `${s.price} MAD` : "Prix sur demande";
          const cat = s.category ? ` (${s.category})` : "";
          return `- ${s.name}${cat}: ${price} — ${s.duration_minutes} min`;
        })
        .join("\n")
    : "Aucun service configuré";

  const doctorsText = doctors.length > 0
    ? doctors.map((d) => `- Dr. ${d.name}`).join("\n")
    : "Aucun médecin configuré";

  const faqsText = faqs.length > 0
    ? faqs.map((f) => `Q: ${f.question}\nR: ${f.answer}`).join("\n\n")
    : "";

  const contactParts: string[] = [];
  if (clinic.phone) contactParts.push(`Téléphone: ${clinic.phone}`);
  if (clinic.email) contactParts.push(`Email: ${clinic.email}`);
  if (clinic.address) contactParts.push(`Adresse: ${clinic.address}`);
  if (clinic.city) contactParts.push(`Ville: ${clinic.city}`);
  if (clinic.domain) contactParts.push(`Site web: ${clinic.domain}`);

  return `Tu es l'assistant virtuel de "${clinic.name}", un(e) ${typeLabels[clinic.type] ?? clinic.type}.
Tu aides les patients avec leurs questions sur les rendez-vous, services, horaires et informations du cabinet.

=== INFORMATIONS DU CABINET ===
Nom: ${clinic.name}
Type: ${typeLabels[clinic.type] ?? clinic.type}
${contactParts.length > 0 ? contactParts.join("\n") : "Contact: non renseigné"}

=== HORAIRES ===
${hoursText}

=== SERVICES & TARIFS ===
${servicesText}

=== MÉDECINS / PRATICIENS ===
${doctorsText}

${faqsText ? `=== FAQ PERSONNALISÉES ===\n${faqsText}` : ""}

=== RÈGLES ===
- Réponds dans la même langue que le patient (français, arabe, anglais, darija).
- Sois concis, professionnel et amical.
- Pour prendre rendez-vous, dirige vers la page de réservation.
- Ne donne jamais de diagnostic médical.
- Si tu ne connais pas une info, dis-le et suggère de contacter le cabinet directement.
- Utilise les données ci-dessus pour répondre précisément aux questions.`;
}

/**
 * Basic intelligence: keyword-matching against DB data + custom FAQs.
 * No AI API needed — works offline.
 */
export function getBasicResponse(userMessage: string, ctx: ChatbotClinicContext): string {
  const msg = userMessage.toLowerCase();
  const { clinic, services, doctors, workingHours, faqs } = ctx;
  const clinicName = clinic?.name ?? "notre cabinet";

  // Check custom FAQs first (highest priority)
  for (const faq of faqs) {
    const questionWords = faq.question.toLowerCase().split(/\s+/);
    const keywordList = [...(faq.keywords ?? []).map((k) => k.toLowerCase()), ...questionWords];
    const matchCount = keywordList.filter((kw) => msg.includes(kw)).length;
    if (matchCount >= 2 || keywordList.some((kw) => kw.length > 4 && msg.includes(kw))) {
      return faq.answer;
    }
  }

  // Working hours
  if (msg.includes("horaire") || msg.includes("hours") || msg.includes("ouvert") || msg.includes("open") ||
      msg.includes("وقت") || msg.includes("ساعات") || msg.includes("شحال")) {
    if (workingHours.length === 0) {
      return `Les horaires de ${clinicName} ne sont pas encore configurés. Veuillez nous contacter directement.`;
    }
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const hours = workingHours
      .filter((s) => s.is_available)
      .map((s) => `${dayNames[s.day_of_week]}: ${s.start_time} - ${s.end_time}`)
      .join("\n");
    return `Voici les horaires de ${clinicName} :\n${hours}`;
  }

  // Services & prices
  if (msg.includes("service") || msg.includes("tarif") || msg.includes("prix") || msg.includes("price") ||
      msg.includes("coût") || msg.includes("combien") || msg.includes("تمن") || msg.includes("خدمات") ||
      msg.includes("بشحال")) {
    if (services.length === 0) {
      return `Les services de ${clinicName} ne sont pas encore configurés. Contactez-nous pour plus d'informations.`;
    }

    // Try to match specific service
    const matchedService = services.find((s) => {
      const sName = s.name.toLowerCase();
      return msg.includes(sName) || sName.split(/\s+/).some((w) => w.length > 3 && msg.includes(w));
    });

    if (matchedService) {
      const price = matchedService.price != null ? `${matchedService.price} MAD` : "Prix sur demande";
      return `${matchedService.name} chez ${clinicName} : ${price} (durée : ${matchedService.duration_minutes} min).\nVoulez-vous prendre rendez-vous ?`;
    }

    const list = services
      .map((s) => {
        const price = s.price != null ? `${s.price} MAD` : "Sur demande";
        return `• ${s.name} — ${price}`;
      })
      .join("\n");
    return `Voici nos services et tarifs :\n${list}`;
  }

  // Doctors
  if (msg.includes("docteur") || msg.includes("médecin") || msg.includes("doctor") || msg.includes("praticien") ||
      msg.includes("طبيب") || msg.includes("دكتور")) {
    if (doctors.length === 0) {
      return `Aucun praticien n'est encore configuré pour ${clinicName}.`;
    }
    const list = doctors.map((d) => `• Dr. ${d.name}`).join("\n");
    return `Nos praticiens :\n${list}`;
  }

  // Contact info
  if (msg.includes("contact") || msg.includes("téléphone") || msg.includes("phone") || msg.includes("email") ||
      msg.includes("adresse") || msg.includes("address") || msg.includes("عنوان") || msg.includes("تيليفون")) {
    const parts: string[] = [];
    if (clinic?.phone) parts.push(`Téléphone : ${clinic.phone}`);
    if (clinic?.email) parts.push(`Email : ${clinic.email}`);
    if (clinic?.address) parts.push(`Adresse : ${clinic.address}`);
    if (clinic?.city) parts.push(`Ville : ${clinic.city}`);
    return parts.length > 0
      ? `Voici nos coordonnées :\n${parts.join("\n")}`
      : `Les coordonnées de ${clinicName} ne sont pas encore configurées.`;
  }

  // Location
  if (msg.includes("où") || msg.includes("location") || msg.includes("localisation") || msg.includes("adresse") ||
      msg.includes("فين") || msg.includes("وين")) {
    const parts: string[] = [];
    if (clinic?.address) parts.push(clinic.address);
    if (clinic?.city) parts.push(clinic.city);
    return parts.length > 0
      ? `${clinicName} se trouve à : ${parts.join(", ")}`
      : `L'adresse de ${clinicName} n'est pas encore configurée.`;
  }

  // Booking
  if (msg.includes("rendez-vous") || msg.includes("appointment") || msg.includes("book") || msg.includes("réserv") ||
      msg.includes("حجز") || msg.includes("موعد")) {
    return `Pour prendre un rendez-vous chez ${clinicName}, utilisez notre page de réservation en ligne ou contactez-nous directement. Souhaitez-vous connaître nos horaires ou services disponibles ?`;
  }

  // Greetings
  if (msg.includes("bonjour") || msg.includes("hello") || msg.includes("hi") || msg.includes("salut") ||
      msg.includes("سلام") || msg.includes("مرحبا")) {
    return `Bonjour ! Bienvenue chez ${clinicName}. Comment puis-je vous aider ? Je peux vous renseigner sur nos services, tarifs, horaires ou vous aider à prendre rendez-vous.`;
  }

  // Thanks
  if (msg.includes("merci") || msg.includes("thank") || msg.includes("شكرا")) {
    return "Je vous en prie ! N'hésitez pas si vous avez d'autres questions.";
  }

  // Default
  return `Merci pour votre message. Je suis l'assistant virtuel de ${clinicName}. Je peux vous aider avec :\n• Les services et tarifs\n• Les horaires d'ouverture\n• Les coordonnées du cabinet\n• La prise de rendez-vous\n• Nos praticiens\n\nComment puis-je vous aider ?`;
}
