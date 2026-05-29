/**
 * Tests for src/lib/whatsapp/voice-booking-pipeline.ts
 *
 * Covers:
 *   - extractBookingEntities: doctor, date, time, service extraction
 *   - getVoiceConfig: env var resolution
 *   - downloadWhatsAppAudio: Meta API fetch + error handling
 *   - transcribeAudio: OpenAI + ElevenLabs dispatch + error handling
 *   - handleVoiceMessage: full pipeline (no config, no audio, no transcription,
 *     booking intent detected, no booking intent, no patientId, doctor mismatch,
 *     missing date/time, successful booking, insert failure)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/whatsapp", () => ({
  sendTextMessage: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ──

function createMockVoiceClient(overrides?: {
  insertError?: unknown;
  doctors?: Array<Record<string, unknown>> | null;
}) {
  const insertSelectMock = vi
    .fn()
    .mockResolvedValue({ data: [{}], error: overrides?.insertError ?? null });
  const orderLimitMock = vi.fn().mockResolvedValue({
    data: overrides?.doctors ?? [{ id: "doc-1", name: "Ahmed Benali" }],
    error: null,
  });

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockReturnValue({ limit: orderLimitMock }),
          }),
          order: vi.fn().mockReturnValue({ limit: orderLimitMock }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ select: insertSelectMock }),
    }),
  };
}

const baseMetadata = {
  mediaId: "media-123",
  mimeType: "audio/ogg",
  senderPhone: "+212600000000",
  clinicId: "clinic-1",
  clinicName: "Clinique Test",
  patientId: "patient-1",
  patientName: "Ahmed",
};

// ── Tests for extractBookingEntities ──

describe("voice-booking-pipeline — extractBookingEntities", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts doctor name from French text", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("Je veux voir Dr. Ahmed demain à 15h00");
    expect(result.doctorName).toBe("Ahmed");
  });

  it("extracts doctor name from Darija text", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("bghi ndir rdv m3a docteur Benali");
    expect(result.doctorName).toBe("Benali");
  });

  it("extracts date from 'demain'", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("rendez-vous demain");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    expect(result.dateStr).toBe(tomorrow);
  });

  it("extracts date from 'aujourd'hui'", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("rdv aujourd'hui");
    const today = new Date().toISOString().split("T")[0];
    expect(result.dateStr).toBe(today);
  });

  it("extracts date from DD/MM format", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("rdv le 15/06");
    expect(result.dateStr).toMatch(/\d{4}-06-15/);
  });

  it("extracts time from Xh00 format", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("rdv à 15h00");
    expect(result.timeStr).toBe("15:00");
  });

  it("extracts time from HH:MM format", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("à 10:30");
    expect(result.timeStr).toBe("10:30");
  });

  it("extracts service from text", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("consultation dentaire");
    expect(result.serviceName).toBe("Consultation dentaire");
  });

  it("extracts urgence service", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("c'est une urgence");
    expect(result.serviceName).toBe("Urgence");
  });

  it("extracts contrôle service", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("je veux un contrôle");
    expect(result.serviceName).toBe("Contrôle de routine");
  });

  it("handles text with all entities", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("Je veux une consultation avec Dr. Ahmed demain à 15h00");
    expect(result.doctorName).toBe("Ahmed");
    expect(result.dateStr).toBeTruthy();
    expect(result.timeStr).toBe("15:00");
    expect(result.serviceName).toBe("Consultation générale");
  });

  it("returns nulls for unrelated text", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("bonjour, comment allez-vous?");
    expect(result.doctorName).toBeNull();
    expect(result.dateStr).toBeNull();
    expect(result.timeStr).toBeNull();
    expect(result.serviceName).toBeNull();
  });

  it("extracts time from AM/PM format", async () => {
    const { extractBookingEntities } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = extractBookingEntities("rdv à 2:00 PM");
    expect(result.timeStr).toBe("14:00");
  });
});

// ── Tests for getVoiceConfig ──

describe("voice-booking-pipeline — getVoiceConfig", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("returns null when STT_API_KEY is not set", async () => {
    delete process.env.STT_API_KEY;
    const { getVoiceConfig } = await import("@/lib/whatsapp/voice-booking-pipeline");
    expect(getVoiceConfig()).toBeNull();
  });

  it("returns config with openai defaults when STT_API_KEY is set", async () => {
    process.env.STT_API_KEY = "test-key";
    delete process.env.STT_PROVIDER;
    const { getVoiceConfig } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const config = getVoiceConfig();
    expect(config).not.toBeNull();
    expect(config!.sttProvider).toBe("openai");
    expect(config!.sttApiKey).toBe("test-key");
    expect(config!.sttModel).toBe("whisper-1");
    expect(config!.sttLanguage).toBe("fr");
  });

  it("returns elevenlabs config when STT_PROVIDER is elevenlabs", async () => {
    process.env.STT_API_KEY = "eleven-key";
    process.env.STT_PROVIDER = "elevenlabs";
    const { getVoiceConfig } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const config = getVoiceConfig();
    expect(config!.sttProvider).toBe("elevenlabs");
  });
});

// ── Tests for downloadWhatsAppAudio ──

describe("voice-booking-pipeline — downloadWhatsAppAudio", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("returns null when WHATSAPP_ACCESS_TOKEN missing", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const { downloadWhatsAppAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await downloadWhatsAppAudio("media-123");
    expect(result).toBeNull();
  });

  it("returns null when metadata fetch fails", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { downloadWhatsAppAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await downloadWhatsAppAudio("media-123");
    expect(result).toBeNull();
  });

  it("returns null when media URL is missing from metadata", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ mime_type: "audio/ogg" }),
      }),
    );
    const { downloadWhatsAppAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await downloadWhatsAppAudio("media-123");
    expect(result).toBeNull();
  });

  it("returns null when audio download fails", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ url: "https://audio.example.com/file.ogg", mime_type: "audio/ogg" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);
    const { downloadWhatsAppAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await downloadWhatsAppAudio("media-123");
    expect(result).toBeNull();
  });

  it("returns buffer and mimeType on success", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ url: "https://audio.example.com/file.ogg", mime_type: "audio/ogg" }),
      })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) });
    vi.stubGlobal("fetch", fetchMock);
    const { downloadWhatsAppAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await downloadWhatsAppAudio("media-123");
    expect(result).not.toBeNull();
    expect(result!.buffer).toBe(audioBuffer);
    expect(result!.mimeType).toBe("audio/ogg");
  });

  it("defaults mimeType to audio/ogg when not provided", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ url: "https://audio.example.com/file.ogg" }),
      })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) });
    vi.stubGlobal("fetch", fetchMock);
    const { downloadWhatsAppAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await downloadWhatsAppAudio("media-123");
    expect(result!.mimeType).toBe("audio/ogg");
  });
});

// ── Tests for transcribeAudio ──

describe("voice-booking-pipeline — transcribeAudio", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openaiConfig = {
    sttProvider: "openai" as const,
    sttApiKey: "key",
    sttModel: "whisper-1",
    sttLanguage: "fr",
  };
  const elevenConfig = {
    sttProvider: "elevenlabs" as const,
    sttApiKey: "key",
    sttModel: "scribe_v1",
  };

  it("transcribes via OpenAI Whisper", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: "bonjour", language: "fr" }),
      }),
    );
    const { transcribeAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await transcribeAudio(new ArrayBuffer(10), "audio/ogg", openaiConfig);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("bonjour");
    expect(result!.language).toBe("fr");
    expect(result!.confidence).toBe(0.9);
  });

  it("returns null when OpenAI Whisper fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { transcribeAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await transcribeAudio(new ArrayBuffer(10), "audio/ogg", openaiConfig);
    expect(result).toBeNull();
  });

  it("transcribes via ElevenLabs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: "salam", language_code: "ar" }),
      }),
    );
    const { transcribeAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await transcribeAudio(new ArrayBuffer(10), "audio/ogg", elevenConfig);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("salam");
    expect(result!.language).toBe("ar");
    expect(result!.confidence).toBe(0.85);
  });

  it("returns null when ElevenLabs fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const { transcribeAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await transcribeAudio(new ArrayBuffer(10), "audio/ogg", elevenConfig);
    expect(result).toBeNull();
  });

  it("handles OpenAI response with missing text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      }),
    );
    const { transcribeAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await transcribeAudio(new ArrayBuffer(10), "audio/ogg", openaiConfig);
    expect(result!.text).toBe("");
  });

  it("handles ElevenLabs response with missing fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      }),
    );
    const { transcribeAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const result = await transcribeAudio(new ArrayBuffer(10), "audio/ogg", elevenConfig);
    expect(result!.text).toBe("");
    expect(result!.language).toBe("fr");
  });

  it("handles mp3 mimetype correctly in OpenAI request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: "test" }),
      }),
    );
    const { transcribeAudio } = await import("@/lib/whatsapp/voice-booking-pipeline");
    await transcribeAudio(new ArrayBuffer(10), "audio/mp3", openaiConfig);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

// ── Tests for handleVoiceMessage ──

describe("voice-booking-pipeline — handleVoiceMessage", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("sends 'not activated' when STT not configured", async () => {
    delete process.env.STT_API_KEY;
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const client = createMockVoiceClient();
    await handleVoiceMessage(client, baseMetadata);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("reconnaissance vocale n'est pas encore activée"),
    );
  });

  it("sends error when audio download fails", async () => {
    process.env.STT_API_KEY = "test-key";
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const client = createMockVoiceClient();
    await handleVoiceMessage(client, baseMetadata);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("n'avons pas pu traiter votre message vocal"),
    );
  });

  it("sends error when transcription fails", async () => {
    process.env.STT_API_KEY = "test-key";
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ url: "https://x.com/a.ogg", mime_type: "audio/ogg" }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) })
        .mockResolvedValueOnce({ ok: false, status: 500 }),
    );
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const client = createMockVoiceClient();
    await handleVoiceMessage(client, baseMetadata);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("n'avons pas pu comprendre"),
    );
  });

  it("sends generic response when no booking intent detected", async () => {
    process.env.STT_API_KEY = "test-key";
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ url: "https://x.com/a.ogg", mime_type: "audio/ogg" }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ text: "bonjour comment allez vous", language: "fr" }),
        }),
    );
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const client = createMockVoiceClient();
    await handleVoiceMessage(client, baseMetadata);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("Merci pour votre message vocal"),
    );
  });

  it("creates appointment when full booking entities detected", async () => {
    process.env.STT_API_KEY = "test-key";
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ url: "https://x.com/a.ogg", mime_type: "audio/ogg" }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) })
        .mockResolvedValueOnce({
          ok: true,
          json: vi
            .fn()
            .mockResolvedValue({ text: "je veux voir Dr. Ahmed demain à 15h00", language: "fr" }),
        }),
    );
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const client = createMockVoiceClient({ doctors: [{ id: "doc-1", name: "Ahmed Benali" }] });
    await handleVoiceMessage(client, baseMetadata);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("Rendez-vous créé"),
    );
  });

  it("prompts when patient is not registered", async () => {
    process.env.STT_API_KEY = "test-key";
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ url: "https://x.com/a.ogg", mime_type: "audio/ogg" }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ text: "Dr. Ahmed demain 15h00", language: "fr" }),
        }),
    );
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const meta = { ...baseMetadata, patientId: null };
    const client = createMockVoiceClient();
    await handleVoiceMessage(client, meta);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("numéro n'est pas encore enregistré"),
    );
  });

  it("prompts missing date/time when only doctor detected", async () => {
    process.env.STT_API_KEY = "test-key";
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ url: "https://x.com/a.ogg", mime_type: "audio/ogg" }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ text: "rendez-vous avec Dr. Ahmed", language: "fr" }),
        }),
    );
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const client = createMockVoiceClient({ doctors: [{ id: "doc-1", name: "Ahmed Benali" }] });
    await handleVoiceMessage(client, baseMetadata);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("Il manque"),
    );
  });

  it("lists available doctors when mentioned doctor not found", async () => {
    process.env.STT_API_KEY = "test-key";
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ url: "https://x.com/a.ogg", mime_type: "audio/ogg" }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) })
        .mockResolvedValueOnce({
          ok: true,
          json: vi
            .fn()
            .mockResolvedValue({ text: "rendez-vous Dr. Zidane demain 15h00", language: "fr" }),
        }),
    );
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const client = createMockVoiceClient({ doctors: [{ id: "doc-1", name: "Ahmed Benali" }] });
    await handleVoiceMessage(client, baseMetadata);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("Médecins disponibles"),
    );
  });

  it("handles booking insert failure", async () => {
    process.env.STT_API_KEY = "test-key";
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ url: "https://x.com/a.ogg", mime_type: "audio/ogg" }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ text: "Dr. Ahmed demain 15h00", language: "fr" }),
        }),
    );
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const client = createMockVoiceClient({
      insertError: { message: "DB error" },
      doctors: [{ id: "doc-1", name: "Ahmed Benali" }],
    });
    await handleVoiceMessage(client, baseMetadata);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("erreur est survenue"),
    );
  });

  it("handles empty transcription text", async () => {
    process.env.STT_API_KEY = "test-key";
    process.env.WHATSAPP_ACCESS_TOKEN = "token-123";
    const audioBuffer = new ArrayBuffer(10);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ url: "https://x.com/a.ogg", mime_type: "audio/ogg" }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(audioBuffer) })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ text: "   ", language: "fr" }),
        }),
    );
    const { handleVoiceMessage } = await import("@/lib/whatsapp/voice-booking-pipeline");
    const { sendTextMessage } = await import("@/lib/whatsapp");
    const client = createMockVoiceClient();
    await handleVoiceMessage(client, baseMetadata);
    expect(sendTextMessage).toHaveBeenCalledWith(
      "+212600000000",
      expect.stringContaining("n'avons pas pu comprendre"),
    );
  });
});
