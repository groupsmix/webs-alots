/**
 * Machine à états pour le flux de réservation WhatsApp
 *
 * Adapté du pattern whatsapp-receptionist (conversation flow state machine).
 * Fournit une machine à états déterministe pour le parcours de réservation
 * via WhatsApp, avec des transitions claires et une gestion des timeouts.
 *
 * États:
 *   IDLE → AWAITING_SERVICE → AWAITING_DOCTOR → AWAITING_DATE →
 *   AWAITING_TIME → CONFIRMING → COMPLETED / CANCELLED
 *
 * Chaque transition déclenche un message WhatsApp au patient.
 * Toutes les opérations DB sont scoped par clinic_id.
 */

import { logger } from "@/lib/logger";

// ── Types ──

export type BookingState =
  | "idle"
  | "awaiting_service"
  | "awaiting_doctor"
  | "awaiting_date"
  | "awaiting_time"
  | "confirming"
  | "completed"
  | "cancelled"
  | "escalated";

export interface BookingContext {
  clinicId: string;
  clinicName: string;
  patientId: string | null;
  patientPhone: string;
  serviceId: string | null;
  serviceName: string | null;
  doctorId: string | null;
  doctorName: string | null;
  dateStr: string | null;
  timeStr: string | null;
  escalationReason: string | null;
  attempts: number;
  lastTransitionAt: string;
}

export interface BookingTransitionResult {
  newState: BookingState;
  context: BookingContext;
  responseMessage: string;
}

export interface BookingStateMachineClient {
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
      };
    };
  };
}

// ── Configuration ──

const MAX_ATTEMPTS = 3;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ── Validation des entrées ──

function parseDate(text: string): string | null {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (/\b(demain|tomorrow|غدا|ghda)\b/i.test(text)) {
    return tomorrow.toISOString().split("T")[0];
  }
  if (/\b(aujourd'?hui|today|lyoum)\b/i.test(text)) {
    return now.toISOString().split("T")[0];
  }

  const dateMatch = text.match(/(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const year = dateMatch[3]
      ? parseInt(dateMatch[3], 10) < 100
        ? 2000 + parseInt(dateMatch[3], 10)
        : parseInt(dateMatch[3], 10)
      : now.getFullYear();

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function parseTime(text: string): string | null {
  const timeMatch = text.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\s*(am|pm)?\b/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1], 10);
  const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const period = timeMatch[3]?.toLowerCase();

  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// ── Transitions ──

export function createInitialContext(
  clinicId: string,
  clinicName: string,
  patientId: string | null,
  patientPhone: string,
): BookingContext {
  return {
    clinicId,
    clinicName,
    patientId,
    patientPhone,
    serviceId: null,
    serviceName: null,
    doctorId: null,
    doctorName: null,
    dateStr: null,
    timeStr: null,
    escalationReason: null,
    attempts: 0,
    lastTransitionAt: new Date().toISOString(),
  };
}

/**
 * Vérifier si la session de réservation a expiré.
 */
export function isSessionExpired(context: BookingContext): boolean {
  const lastActivity = new Date(context.lastTransitionAt).getTime();
  return Date.now() - lastActivity > SESSION_TIMEOUT_MS;
}

/**
 * Traiter un message dans le contexte d'une réservation en cours.
 * Retourne le nouvel état, le contexte mis à jour, et le message de réponse.
 */
export async function processBookingMessage(
  supabase: BookingStateMachineClient,
  currentState: BookingState,
  context: BookingContext,
  messageText: string,
): Promise<BookingTransitionResult> {
  const updated = { ...context, lastTransitionAt: new Date().toISOString() };

  // Vérifier le timeout
  if (isSessionExpired(context)) {
    return {
      newState: "idle",
      context: createInitialContext(
        context.clinicId,
        context.clinicName,
        context.patientId,
        context.patientPhone,
      ),
      responseMessage: "Votre session de réservation a expiré. Envoyez 'rdv' pour recommencer.",
    };
  }

  // Commande d'annulation globale
  const upper = messageText.trim().toUpperCase();
  if (upper === "ANNULER" || upper === "CANCEL" || upper === "QUIT") {
    return {
      newState: "cancelled",
      context: { ...updated, attempts: 0 },
      responseMessage: "Réservation annulée. N'hésitez pas à réessayer quand vous voulez!",
    };
  }

  switch (currentState) {
    case "idle":
    case "awaiting_service":
      return handleAwaitingService(supabase, updated, messageText);

    case "awaiting_doctor":
      return handleAwaitingDoctor(supabase, updated, messageText);

    case "awaiting_date":
      return handleAwaitingDate(updated, messageText);

    case "awaiting_time":
      return handleAwaitingTime(updated, messageText);

    case "confirming":
      return handleConfirming(updated, messageText);

    default:
      return {
        newState: "idle",
        context: updated,
        responseMessage: "Pour prendre rendez-vous, envoyez 'rdv'.\n" + `— ${context.clinicName}`,
      };
  }
}

// ── Handlers par état ──

async function handleAwaitingService(
  supabase: BookingStateMachineClient,
  context: BookingContext,
  messageText: string,
): Promise<BookingTransitionResult> {
  const { data: services } = await supabase
    .from("services")
    .select("id, name")
    .eq("clinic_id", context.clinicId)
    .order("name", { ascending: true })
    .limit(10);

  if (!services || services.length === 0) {
    return {
      newState: "awaiting_doctor",
      context,
      responseMessage: "Quel médecin souhaitez-vous consulter?",
    };
  }

  // Chercher un match par numéro ou par nom
  const num = parseInt(messageText.trim(), 10);
  if (!isNaN(num) && num >= 1 && num <= services.length) {
    const selected = services[num - 1] as Record<string, unknown>;
    return {
      newState: "awaiting_doctor",
      context: {
        ...context,
        serviceId: selected.id as string,
        serviceName: selected.name as string,
      },
      responseMessage: `Service sélectionné: ${selected.name as string}\n\nQuel médecin souhaitez-vous consulter?`,
    };
  }

  // Chercher par nom
  const normalizedInput = messageText.toLowerCase().trim();
  const matched = (services as Array<Record<string, unknown>>).find(
    (s) => typeof s.name === "string" && s.name.toLowerCase().includes(normalizedInput),
  );

  if (matched) {
    return {
      newState: "awaiting_doctor",
      context: {
        ...context,
        serviceId: matched.id as string,
        serviceName: matched.name as string,
      },
      responseMessage: `Service sélectionné: ${matched.name as string}\n\nQuel médecin souhaitez-vous consulter?`,
    };
  }

  // Pas de match — lister les services disponibles
  const updated = { ...context, attempts: context.attempts + 1 };
  if (updated.attempts >= MAX_ATTEMPTS) {
    return escalate(updated, "Trop de tentatives pour sélectionner un service");
  }

  const serviceList = (services as Array<Record<string, unknown>>)
    .map((s, i) => `${i + 1}. ${s.name as string}`)
    .join("\n");

  return {
    newState: "awaiting_service",
    context: updated,
    responseMessage:
      `Choisissez un service:\n\n${serviceList}\n\n` +
      `Répondez avec le numéro ou le nom du service.`,
  };
}

async function handleAwaitingDoctor(
  supabase: BookingStateMachineClient,
  context: BookingContext,
  messageText: string,
): Promise<BookingTransitionResult> {
  const { data: doctors } = await supabase
    .from("users")
    .select("id, name")
    .eq("clinic_id", context.clinicId)
    .eq("role", "doctor")
    .order("name", { ascending: true })
    .limit(10);

  if (!doctors || doctors.length === 0) {
    return {
      newState: "escalated",
      context: { ...context, escalationReason: "Aucun médecin disponible" },
      responseMessage: `Aucun médecin n'est disponible pour le moment. Veuillez contacter la clinique directement.\n— ${context.clinicName}`,
    };
  }

  const num = parseInt(messageText.trim(), 10);
  if (!isNaN(num) && num >= 1 && num <= doctors.length) {
    const selected = doctors[num - 1] as Record<string, unknown>;
    return {
      newState: "awaiting_date",
      context: {
        ...context,
        doctorId: selected.id as string,
        doctorName: selected.name as string,
        attempts: 0,
      },
      responseMessage: `Dr. ${selected.name as string} sélectionné.\n\nQuelle date souhaitez-vous? (ex: demain, 15/06, aujourd'hui)`,
    };
  }

  const normalizedInput = messageText.toLowerCase().trim();
  const doctorNameMatch = normalizedInput.replace(/^dr\.?\s*/i, "");
  const matched = (doctors as Array<Record<string, unknown>>).find(
    (d) => typeof d.name === "string" && d.name.toLowerCase().includes(doctorNameMatch),
  );

  if (matched) {
    return {
      newState: "awaiting_date",
      context: {
        ...context,
        doctorId: matched.id as string,
        doctorName: matched.name as string,
        attempts: 0,
      },
      responseMessage: `Dr. ${matched.name as string} sélectionné.\n\nQuelle date souhaitez-vous? (ex: demain, 15/06, aujourd'hui)`,
    };
  }

  const updated = { ...context, attempts: context.attempts + 1 };
  if (updated.attempts >= MAX_ATTEMPTS) {
    return escalate(updated, "Trop de tentatives pour sélectionner un médecin");
  }

  const doctorList = (doctors as Array<Record<string, unknown>>)
    .map((d, i) => `${i + 1}. Dr. ${d.name as string}`)
    .join("\n");

  return {
    newState: "awaiting_doctor",
    context: updated,
    responseMessage:
      `Médecin non trouvé. Voici nos médecins:\n\n${doctorList}\n\n` +
      `Répondez avec le numéro ou le nom du médecin.`,
  };
}

function handleAwaitingDate(context: BookingContext, messageText: string): BookingTransitionResult {
  const dateStr = parseDate(messageText);

  if (dateStr) {
    return {
      newState: "awaiting_time",
      context: { ...context, dateStr, attempts: 0 },
      responseMessage: `Date sélectionnée: ${dateStr}\n\nÀ quelle heure? (ex: 15h00, 10:30, 9h)`,
    };
  }

  const updated = { ...context, attempts: context.attempts + 1 };
  if (updated.attempts >= MAX_ATTEMPTS) {
    return escalate(updated, "Format de date non reconnu après plusieurs tentatives");
  }

  return {
    newState: "awaiting_date",
    context: updated,
    responseMessage:
      "Format de date non reconnu.\n\n" +
      "Exemples acceptés:\n" +
      "• demain\n" +
      "• aujourd'hui\n" +
      "• 15/06\n" +
      "• 15/06/2026\n\n" +
      "Veuillez réessayer.",
  };
}

function handleAwaitingTime(context: BookingContext, messageText: string): BookingTransitionResult {
  const timeStr = parseTime(messageText);

  if (timeStr) {
    return {
      newState: "confirming",
      context: { ...context, timeStr, attempts: 0 },
      responseMessage:
        `Voulez-vous confirmer ce rendez-vous?\n\n` +
        (context.serviceName ? `💼 ${context.serviceName}\n` : "") +
        `👨‍⚕️ Dr. ${context.doctorName}\n` +
        `📅 ${context.dateStr}\n` +
        `🕐 ${timeStr}\n\n` +
        `Répondez OUI pour confirmer ou NON pour annuler.`,
    };
  }

  const updated = { ...context, attempts: context.attempts + 1 };
  if (updated.attempts >= MAX_ATTEMPTS) {
    return escalate(updated, "Format d'heure non reconnu après plusieurs tentatives");
  }

  return {
    newState: "awaiting_time",
    context: updated,
    responseMessage:
      "Format d'heure non reconnu.\n\n" +
      "Exemples acceptés:\n" +
      "• 15h00\n" +
      "• 10:30\n" +
      "• 9h\n" +
      "• 2:00 PM\n\n" +
      "Veuillez réessayer.",
  };
}

function handleConfirming(context: BookingContext, messageText: string): BookingTransitionResult {
  const upper = messageText.trim().toUpperCase();

  if (upper === "OUI" || upper === "YES" || upper === "1" || upper === "نعم") {
    return {
      newState: "completed",
      context,
      responseMessage:
        `✅ Rendez-vous confirmé!\n\n` +
        (context.serviceName ? `💼 ${context.serviceName}\n` : "") +
        `👨‍⚕️ Dr. ${context.doctorName}\n` +
        `📅 ${context.dateStr}\n` +
        `🕐 ${context.timeStr}\n\n` +
        `Vous recevrez une confirmation bientôt.\n— ${context.clinicName}`,
    };
  }

  if (upper === "NON" || upper === "NO" || upper === "2" || upper === "لا") {
    return {
      newState: "cancelled",
      context,
      responseMessage: "Rendez-vous annulé. N'hésitez pas à réessayer quand vous voulez!",
    };
  }

  return {
    newState: "confirming",
    context: { ...context, attempts: context.attempts + 1 },
    responseMessage: "Répondez OUI pour confirmer ou NON pour annuler.",
  };
}

// ── Escalation ──

function escalate(context: BookingContext, reason: string): BookingTransitionResult {
  logger.info("Réservation WhatsApp escaladée à la réception", {
    context: "whatsapp/booking-state-machine",
    clinicId: context.clinicId,
    reason,
  });

  return {
    newState: "escalated",
    context: { ...context, escalationReason: reason },
    responseMessage:
      `Nous allons transférer votre demande à notre réception.\n` +
      `Un membre de l'équipe vous contactera bientôt.\n\n` +
      `— ${context.clinicName}`,
  };
}

export { parseDate, parseTime };
