/**
 * WhatsApp Conversation Handler
 *
 * Manages multi-turn WhatsApp conversations for patient self-service:
 * - Book appointments (natural language parsing)
 * - Cancel appointments
 * - Get lab results (secure link)
 * - Pay invoices (payment link)
 * - Ask questions (FAQ/AI chatbot)
 * - Request prescription renewal
 *
 * Each conversation has a state machine tracked in the whatsapp_conversations table.
 */

import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { sendTextMessage } from "@/lib/whatsapp";

// ── Types ──

type ConversationIntent =
  | "booking"
  | "cancel"
  | "lab_results"
  | "payment"
  | "faq"
  | "prescription_renewal"
  | null;

interface ConversationState {
  clinic_id: string;
  patient_phone: string;
  patient_id: string | null;
  current_intent: ConversationIntent;
  context: Record<string, unknown>;
  last_message_at: string;
}

interface ConversationClient {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        val: unknown,
      ): {
        eq(
          col2: string,
          val2: unknown,
        ): {
          single(): Promise<{
            data: Record<string, unknown> | null;
            error: unknown;
          }>;
          order(
            col3: string,
            opts: { ascending: boolean },
          ): {
            limit(n: number): Promise<{
              data: Array<Record<string, unknown>> | null;
              error: unknown;
            }>;
          };
          gte(
            col3: string,
            val3: unknown,
          ): {
            order(
              col4: string,
              opts: { ascending: boolean },
            ): {
              limit(n: number): Promise<{
                data: Array<Record<string, unknown>> | null;
                error: unknown;
              }>;
            };
          };
          in(
            col3: string,
            val3: unknown[],
          ): {
            order(
              col4: string,
              opts: { ascending: boolean },
            ): {
              limit(n: number): Promise<{
                data: Array<Record<string, unknown>> | null;
                error: unknown;
              }>;
            };
          };
          limit(n: number): {
            single(): Promise<{
              data: Record<string, unknown> | null;
              error: unknown;
            }>;
          };
        };
        in(
          col2: string,
          val2: unknown[],
        ): {
          order(
            col3: string,
            opts: { ascending: boolean },
          ): {
            limit(n: number): Promise<{
              data: Array<Record<string, unknown>> | null;
              error: unknown;
            }>;
          };
        };
        order(
          col2: string,
          opts: { ascending: boolean },
        ): {
          limit(n: number): Promise<{
            data: Array<Record<string, unknown>> | null;
            error: unknown;
          }>;
        };
        single(): Promise<{
          data: Record<string, unknown> | null;
          error: unknown;
        }>;
      };
    };
    upsert(
      row: Record<string, unknown>,
      opts?: { onConflict: string },
    ): Promise<{ error: unknown }>;
    update(row: Record<string, unknown>): {
      eq(
        col: string,
        val: unknown,
      ): {
        eq(col2: string, val2: unknown): Promise<{ error: unknown }>;
      };
    };
    insert(row: Record<string, unknown>): {
      select(): Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
    };
  };
}

interface HandleMessageParams {
  supabase: ConversationClient;
  clinicId: string;
  clinicName: string;
  senderPhone: string;
  patientId: string | null;
  patientName: string;
  messageText: string;
}

// ── Intent Detection ──

const INTENT_PATTERNS: Array<{
  intent: ConversationIntent;
  patterns: RegExp[];
}> = [
  {
    intent: "booking",
    patterns: [
      /\b(book|rdv|rendez[- ]?vous|appointment|réserver|موعد|bghi\s+n(dir|akhod)\s+rdv|bghi\s+rdv)\b/i,
      /\b(see|voir|visit|consulter)\s+(dr|doctor|docteur|médecin)/i,
      /\b(demain|tomorrow|aujourd'?hui|today|غدا)\b.*\b(rdv|appointment|rendez)/i,
    ],
  },
  {
    intent: "cancel",
    patterns: [
      /\b(cancel|annuler|supprimer|إلغاء|bghit\s+n(annuler|cancel))\b/i,
      /\b(cancel|annuler)\s+(my|mon|ma)?\s*(rdv|appointment|rendez[- ]?vous|موعد)\b/i,
    ],
  },
  {
    intent: "lab_results",
    patterns: [
      /\b(lab|labo|résult|result|analyse|تحليل|bghit\s+n(chouf|3raf)\s+(analyse|résultat))\b/i,
      /\b(my|mes|mon)\s*(results?|résultat|analyses?)\b/i,
    ],
  },
  {
    intent: "payment",
    patterns: [
      /\b(pay|payer|facture|invoice|دفع|bghit\s+nkhless|paiement|payment)\b/i,
      /\b(my|ma|mon)\s*(facture|invoice|bill)\b/i,
    ],
  },
  {
    intent: "faq",
    patterns: [
      /\b(question|aide|help|info|information|مساعدة|comment|how|horaire|hours|prix|price|tarif)\b/i,
      /\b(c'?est\s+quoi|what\s+is|where|où|quand|when)\b/i,
    ],
  },
  {
    intent: "prescription_renewal",
    patterns: [
      /\b(prescription|ordonnance|médicament|medication|renouvell|renew|دواء)\b/i,
      /\b(refill|renouveler)\s+(my|ma|mon)?\s*(prescription|ordonnance)\b/i,
      /\b(bghit|need)\s+(dwa|medication|médicament)\b/i,
    ],
  },
];

function detectIntent(text: string): ConversationIntent {
  const normalized = text.toLowerCase().trim();

  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return intent;
      }
    }
  }

  return null;
}

// ── Booking Parser ──

interface ParsedBookingRequest {
  doctorName: string | null;
  dateStr: string | null;
  timeStr: string | null;
}

function parseBookingRequest(text: string): ParsedBookingRequest {
  const result: ParsedBookingRequest = {
    doctorName: null,
    dateStr: null,
    timeStr: null,
  };

  const doctorMatch = text.match(
    /(?:dr\.?|doctor|docteur|médecin)\s+([a-zàâäéèêëïôùûüÿçñ]+(?:\s+[a-zàâäéèêëïôùûüÿçñ]+)?)/i,
  );
  if (doctorMatch) {
    result.doctorName = doctorMatch[1].trim();
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (/\b(demain|tomorrow|غدا|ghda)\b/i.test(text)) {
    result.dateStr = tomorrow.toISOString().split("T")[0];
  } else if (/\b(aujourd'?hui|today|lyoum)\b/i.test(text)) {
    result.dateStr = now.toISOString().split("T")[0];
  } else {
    const dateMatch = text.match(/(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const year = dateMatch[3]
        ? parseInt(dateMatch[3], 10) < 100
          ? 2000 + parseInt(dateMatch[3], 10)
          : parseInt(dateMatch[3], 10)
        : now.getFullYear();
      result.dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const timeMatch = text.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3]?.toLowerCase();

    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    result.timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return result;
}

// ── Conversation State Management ──

async function getOrCreateConversation(
  supabase: ConversationClient,
  clinicId: string,
  senderPhone: string,
  patientId: string | null,
): Promise<ConversationState> {
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_phone", senderPhone)
    .single();

  if (existing) {
    const expiresAt = existing.expires_at as string;
    if (new Date(expiresAt) < new Date()) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          current_intent: null,
          context: {},
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("clinic_id", clinicId)
        .eq("patient_phone", senderPhone);

      return {
        clinic_id: clinicId,
        patient_phone: senderPhone,
        patient_id: patientId,
        current_intent: null,
        context: {},
        last_message_at: new Date().toISOString(),
      };
    }

    return {
      clinic_id: clinicId,
      patient_phone: senderPhone,
      patient_id: (existing.patient_id as string) ?? patientId,
      current_intent: (existing.current_intent as ConversationIntent) ?? null,
      context: (existing.context as Record<string, unknown>) ?? {},
      last_message_at: (existing.last_message_at as string) ?? new Date().toISOString(),
    };
  }

  await supabase.from("whatsapp_conversations").upsert(
    {
      clinic_id: clinicId,
      patient_phone: senderPhone,
      patient_id: patientId,
      current_intent: null,
      context: {},
      last_message_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
    { onConflict: "clinic_id,patient_phone" },
  );

  return {
    clinic_id: clinicId,
    patient_phone: senderPhone,
    patient_id: patientId,
    current_intent: null,
    context: {},
    last_message_at: new Date().toISOString(),
  };
}

async function updateConversation(
  supabase: ConversationClient,
  clinicId: string,
  senderPhone: string,
  intent: ConversationIntent,
  context: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("whatsapp_conversations")
    .update({
      current_intent: intent,
      context,
      last_message_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("clinic_id", clinicId)
    .eq("patient_phone", senderPhone);
}

// ── Intent Handlers ──

async function handleBookingIntent(
  supabase: ConversationClient,
  state: ConversationState,
  messageText: string,
  clinicName: string,
): Promise<string> {
  const parsed = parseBookingRequest(messageText);
  const clinicId = state.clinic_id;

  if (state.context.step === "confirm_booking") {
    const upper = messageText.trim().toUpperCase();
    if (upper === "OUI" || upper === "YES" || upper === "1") {
      const doctorId = state.context.doctor_id as string;
      const dateStr = state.context.date as string;
      const timeStr = state.context.time as string;
      const serviceId = state.context.service_id as string | undefined;
      const patientId = state.patient_id;

      if (!patientId || !doctorId || !dateStr || !timeStr) {
        await updateConversation(supabase, clinicId, state.patient_phone, null, {});
        return "Désolé, des informations manquent pour confirmer le rendez-vous. Veuillez réessayer.";
      }

      const { error: insertErr } = await supabase
        .from("appointments")
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          clinic_id: clinicId,
          appointment_date: dateStr,
          start_time: timeStr + ":00",
          status: "pending",
          booking_source: "whatsapp",
          service_id: serviceId ?? null,
        })
        .select();

      if (insertErr) {
        logger.warn("WhatsApp booking insert failed", {
          context: "whatsapp/booking",
          clinicId,
          error: insertErr,
        });
        await updateConversation(supabase, clinicId, state.patient_phone, null, {});
        return "Désolé, une erreur est survenue lors de la réservation. Veuillez réessayer plus tard.";
      }

      const auditClient = supabase as unknown as Parameters<typeof logAuditEvent>[0]["supabase"];
      await logAuditEvent({
        supabase: auditClient,
        action: "whatsapp_booking_created",
        type: "booking",
        clinicId,
        clinicName,
        actor: patientId,
        description: `Booking via WhatsApp: ${dateStr} at ${timeStr}`,
      });

      await updateConversation(supabase, clinicId, state.patient_phone, null, {});
      return `✅ Votre rendez-vous le ${dateStr} à ${timeStr} a été réservé avec succès! Vous recevrez une confirmation bientôt. — ${clinicName}`;
    } else if (upper === "NON" || upper === "NO" || upper === "2") {
      await updateConversation(supabase, clinicId, state.patient_phone, null, {});
      return "Rendez-vous annulé. N'hésitez pas à réessayer quand vous voulez!";
    }
  }

  if (parsed.doctorName) {
    const { data: doctors } = await supabase
      .from("users")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("role", "doctor")
      .order("name", { ascending: true })
      .limit(10);

    const matchedDoctor = doctors?.find(
      (d) =>
        typeof d.name === "string" &&
        d.name.toLowerCase().includes(parsed.doctorName!.toLowerCase()),
    );

    if (matchedDoctor && parsed.dateStr && parsed.timeStr) {
      const { data: services } = await supabase
        .from("services")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .order("name", { ascending: true })
        .limit(1);

      await updateConversation(supabase, clinicId, state.patient_phone, "booking", {
        step: "confirm_booking",
        doctor_id: matchedDoctor.id,
        doctor_name: matchedDoctor.name,
        date: parsed.dateStr,
        time: parsed.timeStr,
        service_id: services?.[0]?.id ?? null,
      });

      return (
        `Voulez-vous confirmer ce rendez-vous?\n` +
        `👨‍⚕️ Dr. ${matchedDoctor.name as string}\n` +
        `📅 ${parsed.dateStr}\n` +
        `🕐 ${parsed.timeStr}\n\n` +
        `Répondez OUI pour confirmer ou NON pour annuler.`
      );
    }

    if (matchedDoctor) {
      await updateConversation(supabase, clinicId, state.patient_phone, "booking", {
        step: "awaiting_datetime",
        doctor_id: matchedDoctor.id,
        doctor_name: matchedDoctor.name,
      });
      return `Dr. ${matchedDoctor.name as string} trouvé! Quand souhaitez-vous votre rendez-vous? (ex: demain à 15h00)`;
    }

    const doctorList = doctors?.map((d) => `• Dr. ${d.name as string}`).join("\n");
    return `Médecin non trouvé. Voici nos médecins disponibles:\n${doctorList ?? "Aucun médecin disponible"}\n\nVeuillez réessayer avec un nom exact.`;
  }

  if (state.context.step === "awaiting_datetime" && (parsed.dateStr || parsed.timeStr)) {
    const dateStr = parsed.dateStr ?? (state.context.date as string);
    const timeStr = parsed.timeStr ?? (state.context.time as string);

    if (dateStr && timeStr) {
      const { data: services } = await supabase
        .from("services")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .order("name", { ascending: true })
        .limit(1);

      await updateConversation(supabase, clinicId, state.patient_phone, "booking", {
        step: "confirm_booking",
        doctor_id: state.context.doctor_id,
        doctor_name: state.context.doctor_name,
        date: dateStr,
        time: timeStr,
        service_id: services?.[0]?.id ?? null,
      });

      return (
        `Voulez-vous confirmer ce rendez-vous?\n` +
        `👨‍⚕️ Dr. ${state.context.doctor_name as string}\n` +
        `📅 ${dateStr}\n` +
        `🕐 ${timeStr}\n\n` +
        `Répondez OUI pour confirmer ou NON pour annuler.`
      );
    }

    await updateConversation(supabase, clinicId, state.patient_phone, "booking", {
      ...state.context,
      date: dateStr ?? state.context.date,
      time: timeStr ?? state.context.time,
    });

    if (!dateStr) return "Quelle date souhaitez-vous? (ex: demain, 15/06)";
    return "À quelle heure souhaitez-vous? (ex: 15h00, 10:30)";
  }

  const { data: doctors } = await supabase
    .from("users")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .eq("role", "doctor")
    .order("name", { ascending: true })
    .limit(10);

  await updateConversation(supabase, clinicId, state.patient_phone, "booking", {
    step: "awaiting_doctor",
  });

  const doctorList = doctors?.map((d) => `• Dr. ${d.name as string}`).join("\n");

  return (
    `Pour prendre rendez-vous, indiquez le médecin, la date et l'heure.\n` +
    `Exemple: "Je veux voir Dr. Ahmed demain à 15h00"\n\n` +
    `Nos médecins:\n${doctorList ?? "Aucun médecin disponible"}`
  );
}

async function handleCancelIntent(
  supabase: ConversationClient,
  state: ConversationState,
  messageText: string,
  clinicName: string,
): Promise<string> {
  const clinicId = state.clinic_id;
  const patientId = state.patient_id;

  if (!patientId) {
    return "Désolé, nous ne trouvons pas votre dossier. Veuillez contacter la réception.";
  }

  if (state.context.step === "confirm_cancel") {
    const upper = messageText.trim().toUpperCase();
    if (upper === "OUI" || upper === "YES" || upper === "1") {
      const appointmentId = state.context.appointment_id as string;

      await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancellation_reason: "Annulé via WhatsApp par le patient",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", appointmentId)
        .eq("clinic_id", clinicId);

      const auditClient = supabase as unknown as Parameters<typeof logAuditEvent>[0]["supabase"];
      await logAuditEvent({
        supabase: auditClient,
        action: "whatsapp_appointment_cancelled",
        type: "booking",
        clinicId,
        clinicName,
        actor: patientId,
        description: `Appointment ${appointmentId} cancelled via WhatsApp`,
      });

      await updateConversation(supabase, clinicId, state.patient_phone, null, {});
      return `✅ Votre rendez-vous a été annulé. — ${clinicName}`;
    } else if (upper === "NON" || upper === "NO" || upper === "2") {
      await updateConversation(supabase, clinicId, state.patient_phone, null, {});
      return "Annulation annulée. Votre rendez-vous est maintenu.";
    }
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, doctors:doctor_id (name)")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .in("status", ["confirmed", "pending", "scheduled"])
    .order("appointment_date", { ascending: true })
    .limit(5);

  if (!appointments || appointments.length === 0) {
    await updateConversation(supabase, clinicId, state.patient_phone, null, {});
    return "Vous n'avez aucun rendez-vous à venir.";
  }

  if (appointments.length === 1) {
    const appt = appointments[0];
    const doctorInfo = appt.doctors as { name: string } | null;
    await updateConversation(supabase, clinicId, state.patient_phone, "cancel", {
      step: "confirm_cancel",
      appointment_id: appt.id,
    });

    return (
      `Voulez-vous annuler ce rendez-vous?\n` +
      `👨‍⚕️ Dr. ${doctorInfo?.name ?? "N/A"}\n` +
      `📅 ${appt.appointment_date as string}\n` +
      `🕐 ${appt.start_time as string}\n\n` +
      `Répondez OUI pour confirmer ou NON pour garder.`
    );
  }

  const list = appointments
    .map((a, i) => {
      const docInfo = a.doctors as { name: string } | null;
      return `${i + 1}. Dr. ${docInfo?.name ?? "N/A"} — ${a.appointment_date as string} à ${a.start_time as string}`;
    })
    .join("\n");

  await updateConversation(supabase, clinicId, state.patient_phone, "cancel", {
    step: "select_appointment",
    appointments: appointments.map((a) => a.id),
  });

  return `Quel rendez-vous souhaitez-vous annuler?\n${list}\n\nRépondez avec le numéro.`;
}

async function handleLabResultsIntent(
  supabase: ConversationClient,
  state: ConversationState,
  clinicName: string,
): Promise<string> {
  const clinicId = state.clinic_id;
  const patientId = state.patient_id;

  if (!patientId) {
    return "Désolé, nous ne trouvons pas votre dossier. Veuillez contacter la réception.";
  }

  const { data: reports } = await supabase
    .from("lab_reports")
    .select("id, test_name, status, created_at")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(5);

  await updateConversation(supabase, clinicId, state.patient_phone, null, {});

  if (!reports || reports.length === 0) {
    return "Aucun résultat d'analyse disponible pour le moment.";
  }

  const domain = process.env.NEXT_PUBLIC_APP_URL || "https://oltigo.com";

  const resultLines = reports.map((r) => {
    const status = r.status === "completed" ? "✅ Prêt" : "⏳ En cours";
    const link = `${domain}/patient/lab-results/${r.id as string}`;
    return `• ${r.test_name as string} — ${status}\n  ${link}`;
  });

  return (
    `Vos résultats d'analyses — ${clinicName}:\n\n` +
    resultLines.join("\n\n") +
    "\n\nCliquez sur le lien pour consulter vos résultats de manière sécurisée."
  );
}

async function handlePaymentIntent(
  supabase: ConversationClient,
  state: ConversationState,
  clinicName: string,
): Promise<string> {
  const clinicId = state.clinic_id;
  const patientId = state.patient_id;

  if (!patientId) {
    return "Désolé, nous ne trouvons pas votre dossier. Veuillez contacter la réception.";
  }

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, amount, status, due_date")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .in("status", ["pending", "overdue"])
    .order("due_date", { ascending: true })
    .limit(5);

  await updateConversation(supabase, clinicId, state.patient_phone, null, {});

  if (!invoices || invoices.length === 0) {
    return "Vous n'avez aucune facture en attente. 🎉";
  }

  const domain = process.env.NEXT_PUBLIC_APP_URL || "https://oltigo.com";

  const invoiceLines = invoices.map((inv) => {
    const status = inv.status === "overdue" ? "⚠️ En retard" : "📄 En attente";
    const amount = typeof inv.amount === "number" ? `${inv.amount} MAD` : "N/A";
    const link = `${domain}/patient/invoices/${inv.id as string}/pay`;
    return `${status} — ${amount}\n  Échéance: ${inv.due_date as string}\n  Payer: ${link}`;
  });

  return (
    `Vos factures — ${clinicName}:\n\n` +
    invoiceLines.join("\n\n") +
    "\n\nCliquez sur le lien pour payer en ligne."
  );
}

async function handleFaqIntent(
  supabase: ConversationClient,
  state: ConversationState,
  messageText: string,
  clinicName: string,
): Promise<string> {
  const clinicId = state.clinic_id;

  const { data: faqs } = await supabase
    .from("chatbot_faqs")
    .select("question, answer, keywords")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(20);

  await updateConversation(supabase, clinicId, state.patient_phone, null, {});

  if (faqs && faqs.length > 0) {
    const normalizedMsg = messageText.toLowerCase();
    for (const faq of faqs) {
      const keywords = faq.keywords as string[] | null;
      if (keywords) {
        for (const kw of keywords) {
          if (normalizedMsg.includes(kw.toLowerCase())) {
            return `${faq.answer as string}\n\n— ${clinicName}`;
          }
        }
      }
      const question = (faq.question as string).toLowerCase();
      if (normalizedMsg.includes(question.slice(0, 20))) {
        return `${faq.answer as string}\n\n— ${clinicName}`;
      }
    }
  }

  const { data: clinicData } = await supabase
    .from("clinics")
    .select("owner_phone, config")
    .eq("id", clinicId)
    .single();

  const clinicPhone = clinicData?.owner_phone as string | undefined;

  return (
    `Merci pour votre question. Je n'ai pas trouvé de réponse automatique.\n\n` +
    `Vous pouvez:\n` +
    `• Envoyer "rdv" pour prendre rendez-vous\n` +
    `• Envoyer "annuler" pour annuler un rendez-vous\n` +
    `• Envoyer "résultats" pour consulter vos analyses\n` +
    `• Envoyer "payer" pour régler une facture\n` +
    `• Envoyer "ordonnance" pour renouveler une ordonnance\n` +
    (clinicPhone ? `\nOu appelez-nous: ${clinicPhone}` : "") +
    `\n\n— ${clinicName}`
  );
}

async function handlePrescriptionRenewalIntent(
  supabase: ConversationClient,
  state: ConversationState,
  messageText: string,
  clinicName: string,
): Promise<string> {
  const clinicId = state.clinic_id;
  const patientId = state.patient_id;

  if (!patientId) {
    return "Désolé, nous ne trouvons pas votre dossier. Veuillez contacter la réception pour renouveler votre ordonnance.";
  }

  if (state.context.step === "confirm_renewal") {
    const upper = messageText.trim().toUpperCase();
    if (upper === "OUI" || upper === "YES" || upper === "1") {
      const medicationName = (state.context.medication_name as string) ?? null;

      const { data: lastDoctor } = await supabase
        .from("appointments")
        .select("doctor_id")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .in("status", ["completed", "confirmed"])
        .order("appointment_date", { ascending: false })
        .limit(1);

      const doctorId = lastDoctor?.[0]?.doctor_id as string | undefined;

      await supabase
        .from("prescription_renewal_requests")
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          patient_phone: state.patient_phone,
          medication_name: medicationName,
          status: "pending",
          doctor_id: doctorId ?? null,
        })
        .select();

      const auditClient = supabase as unknown as Parameters<typeof logAuditEvent>[0]["supabase"];
      await logAuditEvent({
        supabase: auditClient,
        action: "whatsapp_prescription_renewal_requested",
        type: "patient",
        clinicId,
        clinicName,
        actor: patientId,
        description: `Prescription renewal requested via WhatsApp: ${medicationName ?? "unspecified"}`,
      });

      await updateConversation(supabase, clinicId, state.patient_phone, null, {});
      return `✅ Votre demande de renouvellement d'ordonnance a été envoyée. Le médecin vous contactera bientôt. — ${clinicName}`;
    } else if (upper === "NON" || upper === "NO" || upper === "2") {
      await updateConversation(supabase, clinicId, state.patient_phone, null, {});
      return "Demande annulée.";
    }
  }

  if (state.context.step === "awaiting_medication") {
    await updateConversation(supabase, clinicId, state.patient_phone, "prescription_renewal", {
      step: "confirm_renewal",
      medication_name: messageText.trim(),
    });

    return `Vous souhaitez renouveler: "${messageText.trim()}"\n\nRépondez OUI pour confirmer ou NON pour annuler.`;
  }

  await updateConversation(supabase, clinicId, state.patient_phone, "prescription_renewal", {
    step: "awaiting_medication",
  });

  return "Quel médicament souhaitez-vous renouveler? Indiquez le nom du médicament.";
}

// ── Main Handler ──

export async function handleWhatsAppConversation(params: HandleMessageParams): Promise<void> {
  const { supabase, clinicId, clinicName, senderPhone, patientId, messageText } = params;

  try {
    const state = await getOrCreateConversation(supabase, clinicId, senderPhone, patientId);

    let response: string;

    if (state.current_intent && state.context.step) {
      switch (state.current_intent) {
        case "booking":
          response = await handleBookingIntent(supabase, state, messageText, clinicName);
          break;
        case "cancel":
          if (state.context.step === "select_appointment") {
            const num = parseInt(messageText.trim(), 10);
            const apptIds = state.context.appointments as string[];
            if (!isNaN(num) && num >= 1 && num <= apptIds.length) {
              await updateConversation(supabase, clinicId, senderPhone, "cancel", {
                step: "confirm_cancel",
                appointment_id: apptIds[num - 1],
              });
              response =
                "Voulez-vous vraiment annuler ce rendez-vous?\n\nRépondez OUI pour confirmer ou NON pour garder.";
            } else {
              response = "Numéro invalide. Veuillez entrer un numéro valide.";
            }
          } else {
            response = await handleCancelIntent(supabase, state, messageText, clinicName);
          }
          break;
        case "prescription_renewal":
          response = await handlePrescriptionRenewalIntent(
            supabase,
            state,
            messageText,
            clinicName,
          );
          break;
        default:
          response = await handleFaqIntent(supabase, state, messageText, clinicName);
      }
    } else {
      const intent = detectIntent(messageText);

      if (intent) {
        switch (intent) {
          case "booking":
            response = await handleBookingIntent(supabase, state, messageText, clinicName);
            break;
          case "cancel":
            response = await handleCancelIntent(supabase, state, messageText, clinicName);
            break;
          case "lab_results":
            response = await handleLabResultsIntent(supabase, state, clinicName);
            break;
          case "payment":
            response = await handlePaymentIntent(supabase, state, clinicName);
            break;
          case "prescription_renewal":
            response = await handlePrescriptionRenewalIntent(
              supabase,
              state,
              messageText,
              clinicName,
            );
            break;
          case "faq":
          default:
            response = await handleFaqIntent(supabase, state, messageText, clinicName);
            break;
        }
      } else {
        response = await handleFaqIntent(supabase, state, messageText, clinicName);
      }
    }

    await sendTextMessage(senderPhone, response);
  } catch (err) {
    logger.warn("WhatsApp conversation handler error", {
      context: "whatsapp/conversation",
      clinicId,
      senderPhone,
      error: err,
    });

    try {
      await sendTextMessage(
        senderPhone,
        `Désolé, une erreur est survenue. Veuillez réessayer ou contacter la clinique directement. — ${clinicName}`,
      );
    } catch {
      // Sending error message failed
    }
  }
}

export { detectIntent, parseBookingRequest };
export type { ConversationIntent, ParsedBookingRequest, ConversationState };
