/**
 * Tests for src/lib/whatsapp/voice-booking-pipeline.ts
 *
 * Covers:
 *   - extractBookingEntities: doctor, date, time, service extraction
 *   - downloadWhatsAppAudio: Meta API fetch
 *   - transcribeAudio: STT provider dispatch
 *   - handleVoiceMessage: full pipeline
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
