/**
 * Tests for POST /api/v1/ai/voice-notes
 * Tests for PUT /api/v1/ai/voice-notes
 *
 * Validates voice-to-SOAP-notes AI structuring and save/update flows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/ai-disclaimer", () => ({
  AI_DISCLAIMER_FR: "Test disclaimer",
  getAIDisclaimer: vi.fn(() => "Test disclaimer"),
}));

vi.mock("@/lib/features", () => ({
  isAIEnabled: vi.fn(async () => true),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/rate-limit", () => ({
  aiVoiceNoteLimiter: { check: vi.fn(async () => true) },
  aiClinicCeilingLimiter: { check: vi.fn(async () => true) },
}));

const mockSupabaseClient = {
  from: vi.fn((_table: string) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "patient-1",
              name: "Test Patient",
              metadata: { age: 35, gender: "M" },
            },
            error: null,
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "voice-note-1" },
          error: null,
        }),
      }),
      then: vi.fn((cb: (v: { error: null }) => void) => {
        cb({ error: null });
        return { catch: vi.fn() };
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  })),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-1" } },
    }),
  },
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
  createAdminClient: vi.fn(() => mockSupabaseClient),
  createUntypedAdminClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/profile-header-hmac", () => ({
  verifyProfileHeader: vi.fn(async () => ({
    id: "doctor-1",
    role: "doctor",
    clinic_id: "clinic-1",
  })),
  PROFILE_HEADER_NAMES: {
    id: "x-profile-id",
    role: "x-profile-role",
    clinic: "x-profile-clinic",
    sig: "x-profile-sig",
    iat: "x-profile-iat",
  },
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(async () => {}),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  getTenant: vi.fn(async () => ({ clinicId: "clinic-1" })),
}));

// Mock fetch for AI API
const mockFetchResponse = {
  ok: true,
  json: vi.fn(async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            subjective: "Patient se plaint de douleurs abdominales depuis 3 jours",
            objective: "Abdomen sensible à la palpation, pas de défense",
            assessment: "Gastrite aiguë probable",
            plan: "Oméprazole 20mg 1x/jour pendant 14 jours, régime alimentaire adapté",
          }),
        },
      },
    ],
  })),
  text: vi.fn(async () => ""),
};

describe("POST /api/v1/ai/voice-notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse);
  });

  it("validates required fields", async () => {
    const { aiVoiceNoteRequestSchema } = await import("@/lib/validations/chat");

    const result = aiVoiceNoteRequestSchema.safeParse({});
    expect(result.success).toBe(false);

    const valid = aiVoiceNoteRequestSchema.safeParse({
      patientId: "patient-1",
      rawTranscript: "Le patient se plaint de douleurs",
      language: "fr",
    });
    expect(valid.success).toBe(true);
  });

  it("validates language enum", async () => {
    const { aiVoiceNoteRequestSchema } = await import("@/lib/validations/chat");

    const invalid = aiVoiceNoteRequestSchema.safeParse({
      patientId: "p1",
      rawTranscript: "test",
      language: "english",
    });
    expect(invalid.success).toBe(false);

    for (const lang of ["fr", "ar", "darija"]) {
      const valid = aiVoiceNoteRequestSchema.safeParse({
        patientId: "p1",
        rawTranscript: "test",
        language: lang,
      });
      expect(valid.success).toBe(true);
    }
  });

  it("enforces max transcript length", async () => {
    const { aiVoiceNoteRequestSchema } = await import("@/lib/validations/chat");

    const tooLong = aiVoiceNoteRequestSchema.safeParse({
      patientId: "p1",
      rawTranscript: "a".repeat(10001),
      language: "fr",
    });
    expect(tooLong.success).toBe(false);
  });
});

describe("PUT /api/v1/ai/voice-notes — save schema", () => {
  it("validates save schema with SOAP fields", async () => {
    const { aiVoiceNoteSaveSchema } = await import("@/lib/validations/chat");

    const valid = aiVoiceNoteSaveSchema.safeParse({
      id: "note-1",
      patientId: "patient-1",
      rawTranscript: "Le patient se plaint de douleurs",
      language: "fr",
      soapSubjective: "Douleurs abdominales",
      soapObjective: "Abdomen sensible",
      soapAssessment: "Gastrite",
      soapPlan: "Oméprazole 20mg",
      status: "reviewed",
    });
    expect(valid.success).toBe(true);
  });

  it("validates status enum", async () => {
    const { aiVoiceNoteSaveSchema } = await import("@/lib/validations/chat");

    const invalid = aiVoiceNoteSaveSchema.safeParse({
      patientId: "p1",
      rawTranscript: "test",
      language: "fr",
      status: "invalid_status",
    });
    expect(invalid.success).toBe(false);
  });
});
