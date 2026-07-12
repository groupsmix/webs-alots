/**
 * Pipeline de transcription vocale → création de rendez-vous
 *
 * Adapté du pattern whatsapp-receptionist (ElevenLabs STT → intent extraction → booking).
 * Ce module traite les messages vocaux WhatsApp reçus par les cliniques:
 *
 * 1. Télécharge le fichier audio depuis l'API Meta
 * 2. Transcrit via un fournisseur STT configurable (OpenAI Whisper / ElevenLabs)
 * 3. Extrait l'intention et les entités (médecin, date, heure, service)
 * 4. Crée ou confirme un rendez-vous selon le contexte conversationnel
 *
 * Toutes les opérations DB sont scoped par clinic_id.
 * Les fichiers audio sont supprimés après traitement (pas de stockage PHI).
 */

import { logAuditEvent } from "@/lib/audit-log";
import { safeFetch } from "@/lib/fetch-wrapper";
import { logger } from "@/lib/logger";
import { sendTextMessage } from "@/lib/whatsapp";

// ── Types ──

export interface VoiceBookingConfig {
  sttProvider: "openai" | "elevenlabs";
  sttApiKey: string;
  sttModel?: string;
  sttLanguage?: string;
}

export interface VoiceNoteMetadata {
  mediaId: string;
  mimeType: string;
  senderPhone: string;
  clinicId: string;
  clinicName: string;
  patientId: string | null;
  patientName: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
}

interface BookingEntities {
  doctorName: string | null;
  dateStr: string | null;
  timeStr: string | null;
  serviceName: string | null;
}

export interface VoicePipelineClient {
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
          single(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          order(
            col3: string,
            opts: { ascending: boolean },
          ): {
            limit(
              n: number,
            ): Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
          };
        };
        order(
          col2: string,
          opts: { ascending: boolean },
        ): {
          limit(
            n: number,
          ): Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
        };
        single(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
    insert(row: Record<string, unknown>): {
      select(): Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
    };
  };
}

// ── Configuration ──

function getVoiceConfig(): VoiceBookingConfig | null {
  const sttApiKey = process.env.STT_API_KEY;
  if (!sttApiKey) return null;

  const provider = (process.env.STT_PROVIDER || "openai") as "openai" | "elevenlabs";
  return {
    sttProvider: provider,
    sttApiKey,
    sttModel: process.env.STT_MODEL || "whisper-1",
    sttLanguage: process.env.STT_LANGUAGE || "fr",
  };
}

// ── Téléchargement audio depuis Meta ──

export async function downloadWhatsAppAudio(
  mediaId: string,
): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    logger.warn("Impossible de télécharger l'audio: WHATSAPP_ACCESS_TOKEN manquant", {
      context: "whatsapp/voice-pipeline",
    });
    return null;
  }

  const metaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
  const mediaResponse = await safeFetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!mediaResponse.ok) {
    logger.warn("Échec de récupération des métadonnées audio WhatsApp", {
      context: "whatsapp/voice-pipeline",
      mediaId,
      status: mediaResponse.status,
    });
    return null;
  }

  const mediaInfo = (await mediaResponse.json()) as { url?: string; mime_type?: string };
  if (!mediaInfo.url) return null;

  const audioResponse = await safeFetch(mediaInfo.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!audioResponse.ok) return null;

  return {
    buffer: await audioResponse.arrayBuffer(),
    mimeType: mediaInfo.mime_type || "audio/ogg",
  };
}

// ── Transcription ──

export async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  mimeType: string,
  config: VoiceBookingConfig,
): Promise<TranscriptionResult | null> {
  if (config.sttProvider === "elevenlabs") {
    return transcribeViaElevenLabs(audioBuffer, config);
  }
  return transcribeViaOpenAI(audioBuffer, mimeType, config);
}

async function transcribeViaOpenAI(
  audioBuffer: ArrayBuffer,
  mimeType: string,
  config: VoiceBookingConfig,
): Promise<TranscriptionResult | null> {
  const extension = mimeType.includes("ogg") ? "ogg" : "mp3";
  const blob = new Blob([audioBuffer], { type: mimeType });

  const formData = new FormData();
  formData.append("file", blob, `audio.${extension}`);
  formData.append("model", config.sttModel || "whisper-1");
  formData.append("language", config.sttLanguage || "fr");
  formData.append("response_format", "verbose_json");

  const response = await safeFetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.sttApiKey}` },
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    logger.warn("Échec de la transcription OpenAI Whisper", {
      context: "whatsapp/voice-pipeline",
      status: response.status,
    });
    return null;
  }

  const data = (await response.json()) as {
    text?: string;
    language?: string;
  };

  return {
    text: data.text || "",
    language: data.language || "fr",
    confidence: 0.9,
  };
}

async function transcribeViaElevenLabs(
  audioBuffer: ArrayBuffer,
  config: VoiceBookingConfig,
): Promise<TranscriptionResult | null> {
  const blob = new Blob([audioBuffer], { type: "audio/ogg" });

  const formData = new FormData();
  formData.append("audio", blob, "audio.ogg");
  formData.append("model_id", config.sttModel || "scribe_v1");

  const response = await safeFetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": config.sttApiKey },
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    logger.warn("Échec de la transcription ElevenLabs", {
      context: "whatsapp/voice-pipeline",
      status: response.status,
    });
    return null;
  }

  const data = (await response.json()) as {
    text?: string;
    language_code?: string;
  };

  return {
    text: data.text || "",
    language: data.language_code || "fr",
    confidence: 0.85,
  };
}

// ── Extraction d'entités de réservation depuis le texte transcrit ──

export function extractBookingEntities(text: string): BookingEntities {
  const result: BookingEntities = {
    doctorName: null,
    dateStr: null,
    timeStr: null,
    serviceName: null,
  };

  // Extraction du médecin (FR/Darija/AR) — single capitalized name
  const doctorMatch = text.match(
    /(?:dr\.?|doctor|docteur|médecin|طبيب|tbib)\s+([a-zàâäéèêëïôùûüÿçñ]+)/i,
  );
  if (doctorMatch) {
    result.doctorName = doctorMatch[1].trim();
  }

  // Extraction de la date
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (/\b(demain|tomorrow|غدا|ghda|ghedda)\b/i.test(text)) {
    result.dateStr = tomorrow.toISOString().split("T")[0];
  } else if (/\b(aujourd'?hui|today|lyoum|اليوم)\b/i.test(text)) {
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

  // Extraction de l'heure
  const timeMatch = text.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3]?.toLowerCase();

    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    result.timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  // Extraction du service (FR)
  // More specific patterns first to avoid premature matches
  const servicePatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\b(dentaire|dents?|أسنان|snane)\b/i, name: "Consultation dentaire" },
    { pattern: /\b(nettoyage|détartrage|تنظيف)\b/i, name: "Détartrage" },
    { pattern: /\b(radio|radiographie|أشعة)\b/i, name: "Radiographie" },
    { pattern: /\b(urgence|emergency|طوارئ)\b/i, name: "Urgence" },
    { pattern: /\b(contrôle|check[- ]?up|فحص)\b/i, name: "Contrôle de routine" },
    { pattern: /\b(consultation|consulter|استشارة)\b/i, name: "Consultation générale" },
  ];

  for (const { pattern, name } of servicePatterns) {
    if (pattern.test(text)) {
      result.serviceName = name;
      break;
    }
  }

  return result;
}

// ── Pipeline principal ──

export async function handleVoiceMessage(
  supabase: VoicePipelineClient,
  metadata: VoiceNoteMetadata,
): Promise<void> {
  const { mediaId, clinicId, clinicName, senderPhone, patientId, patientName } = metadata;

  const config = getVoiceConfig();
  if (!config) {
    await sendTextMessage(
      senderPhone,
      `Désolé, la reconnaissance vocale n'est pas encore activée pour ${clinicName}. Veuillez envoyer un message texte.`,
      clinicId,
    );
    return;
  }

  // Étape 1: Télécharger l'audio
  const audio = await downloadWhatsAppAudio(mediaId);
  if (!audio) {
    await sendTextMessage(
      senderPhone,
      "Désolé, nous n'avons pas pu traiter votre message vocal. Veuillez réessayer ou envoyer un message texte.",
      clinicId,
    );
    return;
  }

  // Étape 2: Transcrire
  const transcription = await transcribeAudio(audio.buffer, audio.mimeType, config);
  if (!transcription || !transcription.text.trim()) {
    await sendTextMessage(
      senderPhone,
      "Désolé, nous n'avons pas pu comprendre votre message vocal. Veuillez réessayer en parlant plus clairement.",
      clinicId,
    );
    return;
  }

  // Journaliser la transcription (sans PHI)
  logger.info("Transcription vocale WhatsApp terminée", {
    context: "whatsapp/voice-pipeline",
    clinicId,
    language: transcription.language,
    textLength: transcription.text.length,
  });

  // Étape 3: Enregistrer la transcription
  await supabase
    .from("whatsapp_voice_transcriptions")
    .insert({
      clinic_id: clinicId,
      patient_phone: senderPhone,
      patient_id: patientId,
      transcription_text: transcription.text,
      language: transcription.language,
      confidence: transcription.confidence,
      stt_provider: config.sttProvider,
    })
    .select();

  // Étape 4: Extraire les entités de réservation
  const entities = extractBookingEntities(transcription.text);

  // Étape 5: Si on détecte une intention de réservation, créer le RDV
  if (entities.doctorName || entities.dateStr || entities.timeStr) {
    await processVoiceBooking(supabase, {
      clinicId,
      clinicName,
      senderPhone,
      patientId,
      patientName,
      entities,
      transcriptionText: transcription.text,
    });
    return;
  }

  // Pas d'intention de réservation détectée — confirmer la réception
  await sendTextMessage(
    senderPhone,
    `Merci pour votre message vocal, ${patientName}. ` +
      `Nous avons bien reçu votre message. ` +
      `Pour prendre un rendez-vous, vous pouvez dire par exemple: ` +
      `"Je veux voir Dr. Ahmed demain à 15h00"\n\n— ${clinicName}`,
    clinicId,
  );
}

// ── Création de rendez-vous depuis les entités vocales ──

async function processVoiceBooking(
  supabase: VoicePipelineClient,
  params: {
    clinicId: string;
    clinicName: string;
    senderPhone: string;
    patientId: string | null;
    patientName: string;
    entities: BookingEntities;
    transcriptionText: string;
  },
): Promise<void> {
  const { clinicId, clinicName, senderPhone, patientId, entities, transcriptionText } = params;

  if (!patientId) {
    await sendTextMessage(
      senderPhone,
      "Nous avons compris votre demande de rendez-vous, mais votre numéro n'est pas encore enregistré. " +
        `Veuillez contacter ${clinicName} pour créer votre dossier patient.`,
      clinicId,
    );
    return;
  }

  // Chercher le médecin correspondant
  let doctorId: string | null = null;
  let doctorDisplayName = "N/A";

  if (entities.doctorName) {
    const { data: doctors } = await supabase
      .from("users")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("role", "doctor")
      .order("name", { ascending: true })
      .limit(10);

    const matched = doctors?.find(
      (d) =>
        typeof d.name === "string" &&
        d.name.toLowerCase().includes(entities.doctorName!.toLowerCase()),
    );

    if (matched) {
      doctorId = matched.id as string;
      doctorDisplayName = matched.name as string;
    }
  }

  if (!doctorId) {
    const { data: doctors } = await supabase
      .from("users")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("role", "doctor")
      .order("name", { ascending: true })
      .limit(10);

    const doctorList = doctors?.map((d) => `• Dr. ${d.name as string}`).join("\n");
    await sendTextMessage(
      senderPhone,
      `Nous avons compris votre message vocal mais nous n'avons pas trouvé le médecin mentionné.\n\n` +
        `Médecins disponibles:\n${doctorList ?? "Aucun médecin disponible"}\n\n` +
        `Veuillez renvoyer un message avec le nom exact du médecin.\n— ${clinicName}`,
      clinicId,
    );
    return;
  }

  if (!entities.dateStr || !entities.timeStr) {
    const missing: string[] = [];
    if (!entities.dateStr) missing.push("la date (ex: demain, 15/06)");
    if (!entities.timeStr) missing.push("l'heure (ex: 15h00, 10:30)");

    await sendTextMessage(
      senderPhone,
      `Dr. ${doctorDisplayName} trouvé! Il manque: ${missing.join(" et ")}.\n` +
        `Veuillez renvoyer un message avec les informations manquantes.\n— ${clinicName}`,
      clinicId,
    );
    return;
  }

  // Créer le rendez-vous
  const { error: insertErr } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      doctor_id: doctorId,
      clinic_id: clinicId,
      appointment_date: entities.dateStr,
      start_time: entities.timeStr + ":00",
      status: "pending",
      booking_source: "whatsapp_voice",
      notes: `Réservation par message vocal. Transcription: "${transcriptionText.slice(0, 200)}"`,
    })
    .select();

  if (insertErr) {
    logger.warn("Échec de création du RDV vocal WhatsApp", {
      context: "whatsapp/voice-pipeline",
      clinicId,
      error: insertErr,
    });
    await sendTextMessage(
      senderPhone,
      "Désolé, une erreur est survenue lors de la réservation. Veuillez réessayer plus tard.",
      clinicId,
    );
    return;
  }

  const auditClient = supabase as unknown as Parameters<typeof logAuditEvent>[0]["supabase"];
  await logAuditEvent({
    supabase: auditClient,
    action: "whatsapp_voice_booking_created",
    type: "booking",
    clinicId,
    clinicName,
    actor: patientId,
    description: `Rendez-vous créé par message vocal: Dr. ${doctorDisplayName} le ${entities.dateStr} à ${entities.timeStr}`,
  });

  await sendTextMessage(
    senderPhone,
    `✅ Rendez-vous créé à partir de votre message vocal!\n\n` +
      `👨‍⚕️ Dr. ${doctorDisplayName}\n` +
      `📅 ${entities.dateStr}\n` +
      `🕐 ${entities.timeStr}\n\n` +
      `Vous recevrez une confirmation bientôt.\n— ${clinicName}`,
    clinicId,
  );
}

export { getVoiceConfig };
