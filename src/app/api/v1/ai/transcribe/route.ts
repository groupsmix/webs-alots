/**
 * POST /api/v1/ai/transcribe
 *
 * Audio-to-text transcription using OpenAI Whisper.
 * Accepts multipart/form-data with an audio file, returns the transcript.
 *
 * OWASP A01: withAuth enforces doctor/clinic_admin access only.
 * OWASP A03: Audio content type and size validated before forwarding.
 * OWASP A05: API key read from environment — never hardcoded.
 * OWASP A09: Structured logging via logger; audio content never logged.
 *
 * Note: route segment config "runtime" is not compatible with
 * nextConfig.experimental.useCache (Next 16+) — this route runs on the
 * default (Node) runtime under OpenNext/Cloudflare Workers.
 */

import { type NextRequest } from "next/server";
import { getAIDisclaimer } from "@/lib/ai-disclaimer";
import { apiError, apiInternalError, apiRateLimited, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { aiVoiceNoteLimiter, aiClinicCeilingLimiter } from "@/lib/rate-limit";
import { withAuth, type AuthContext } from "@/lib/with-auth";

/** Maximum audio upload size: 25 MB (Whisper API limit) */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Allowed audio content types for Whisper */
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/mp3",
  "video/webm", // MediaRecorder on Chrome produces video/webm even for audio-only
]);

export const POST = withAuth(
  async (request: NextRequest, auth: AuthContext) => {
    // F-AI-01: Kill switch
    if (!(await isAIEnabled())) {
      return apiError("AI features are disabled", 503, "AI_DISABLED");
    }

    const { profile } = auth;
    const clinicId = profile.clinic_id;
    const doctorId = profile.id;

    if (!clinicId) {
      return apiError("No clinic associated with this account", 403, "NO_CLINIC");
    }

    // OWASP A07: Rate limit per doctor (50/day) + per clinic ceiling
    const allowed = await aiVoiceNoteLimiter.check(`ai-transcribe:${doctorId}`);
    if (!allowed) {
      return apiRateLimited(
        "Limite quotidienne atteinte (50 transcriptions IA/jour). Réessayez demain.",
      );
    }

    const clinicAllowed = await aiClinicCeilingLimiter.check(`ai:clinic:${clinicId}`);
    if (!clinicAllowed) {
      return apiRateLimited(
        "Limite quotidienne de la clinique atteinte pour les fonctionnalités IA. Réessayez demain.",
      );
    }

    // OWASP A05: API key from environment only
    // nosemgrep: semgrep.env-access — Whisper API key read at runtime
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return apiError(
        "AI service not configured. Contact your administrator.",
        503,
        "AI_NOT_CONFIGURED",
      );
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiError("Invalid multipart form data", 400, "INVALID_BODY");
    }

    const audioFile = formData.get("audio");
    const language = (formData.get("language") as string | null) ?? "fr";

    // OWASP A03: Validate input
    if (!audioFile || !(audioFile instanceof Blob)) {
      return apiError("Missing audio file in request", 400, "MISSING_AUDIO");
    }

    // Validate file size
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return apiError(
        `Audio file too large. Maximum size is 25 MB (received ${Math.round(audioFile.size / 1024 / 1024)} MB).`,
        413,
        "FILE_TOO_LARGE",
      );
    }

    if (audioFile.size === 0) {
      return apiError("Audio file is empty", 400, "EMPTY_AUDIO");
    }

    // Validate content type
    const contentType = audioFile.type || "audio/webm";
    if (!ALLOWED_AUDIO_TYPES.has(contentType)) {
      return apiError(
        `Unsupported audio format: ${contentType}. Supported: webm, mp3, wav, ogg, flac.`,
        415,
        "UNSUPPORTED_FORMAT",
      );
    }

    // Validate language
    const validLanguages = new Set(["fr", "ar", "en"]);
    const whisperLang = validLanguages.has(language) ? language : "fr";

    logger.info("Audio transcription requested", {
      context: "ai-transcribe",
      clinicId,
      doctorId,
      sizeMb: Math.round((audioFile.size / 1024 / 1024) * 100) / 100,
      contentType,
      language: whisperLang,
    });

    // Build multipart body for Whisper API
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", whisperLang);
    whisperForm.append(
      "prompt",
      "Transcription médicale. Terminologie médicale, médicaments, diagnostics.",
    );

    try {
      const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: whisperForm,
        signal: AbortSignal.timeout(60_000),
      });

      if (!whisperResponse.ok) {
        const errText = await whisperResponse.text().catch(() => "unknown error");
        logger.error("Whisper API request failed", {
          context: "ai-transcribe",
          clinicId,
          doctorId,
          status: whisperResponse.status,
          // Never log the actual audio, only metadata
        });
        if (whisperResponse.status === 429) {
          return apiRateLimited("Le service de transcription est temporairement surchargé.");
        }
        logger.warn("Whisper error detail", {
          context: "ai-transcribe",
          statusCode: whisperResponse.status,
          // Truncate error — may contain partial file info but not the audio bytes
          detail: errText.slice(0, 200),
        });
        return apiInternalError("Le service de transcription est temporairement indisponible.");
      }

      const whisperData = (await whisperResponse.json()) as { text?: string };
      const transcript = whisperData.text?.trim() ?? "";

      if (!transcript) {
        return apiError(
          "La transcription est vide. Vérifiez que l'audio contient bien de la parole.",
          422,
          "EMPTY_TRANSCRIPT",
        );
      }

      // Audit log — success
      void logAuditEvent({
        supabase: auth.supabase,
        action: "audio_transcription_completed",
        type: "admin",
        clinicId,
        actor: doctorId,
        description: "Audio transcribed via Whisper API",
        metadata: {
          language: whisperLang,
          durationMs: Date.now(),
        },
      });

      return apiSuccess({
        transcript,
        language: whisperLang,
        disclaimer: getAIDisclaimer(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return apiError(
          "La transcription a pris trop de temps. Essayez avec un enregistrement plus court.",
          504,
          "TRANSCRIPTION_TIMEOUT",
        );
      }
      logger.error("Transcription failed unexpectedly", {
        context: "ai-transcribe",
        clinicId,
        doctorId,
        error: err instanceof Error ? err.message : String(err),
      });
      return apiInternalError("Erreur lors de la transcription audio. Veuillez réessayer.");
    }
  },
  ["doctor", "clinic_admin"],
);
