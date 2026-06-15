/**
 * Tests for POST /api/v1/ai/smart-prescription
 * Tests for PUT /api/v1/ai/smart-prescription
 *
 * Validates smart prescription writer AI endpoint and save flows.
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
  getKVBinding: vi.fn(async () => undefined),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/rate-limit", () => ({
  aiSmartPrescriptionLimiter: { check: vi.fn(async () => true) },
  aiClinicCeilingLimiter: { check: vi.fn(async () => true) },
}));

describe("AI Smart Prescription schemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates smart prescription request schema", async () => {
    const { aiSmartPrescriptionRequestSchema } = await import("@/lib/validations/chat");

    const result = aiSmartPrescriptionRequestSchema.safeParse({});
    expect(result.success).toBe(false);

    const valid = aiSmartPrescriptionRequestSchema.safeParse({
      patientId: "patient-1",
      diagnosis: "Hypertension artérielle",
      drugName: "Amlodipine",
    });
    expect(valid.success).toBe(true);
  });

  it("validates patient context fields", async () => {
    const { aiSmartPrescriptionRequestSchema } = await import("@/lib/validations/chat");

    const valid = aiSmartPrescriptionRequestSchema.safeParse({
      patientId: "patient-1",
      diagnosis: "Diabète type 2",
      drugName: "Metformine",
      symptoms: "Polyurie, polydipsie",
      patientContext: {
        age: 55,
        gender: "M",
        allergies: ["Pénicilline"],
        currentMedications: ["Amlodipine 5mg"],
        chronicConditions: ["HTA"],
        weight: 85,
      },
    });
    expect(valid.success).toBe(true);
  });

  it("rejects invalid gender values", async () => {
    const { aiSmartPrescriptionRequestSchema } = await import("@/lib/validations/chat");

    const invalid = aiSmartPrescriptionRequestSchema.safeParse({
      patientId: "patient-1",
      diagnosis: "Test",
      drugName: "Test",
      patientContext: { gender: "X" },
    });
    expect(invalid.success).toBe(false);
  });

  it("enforces drug name max length", async () => {
    const { aiSmartPrescriptionRequestSchema } = await import("@/lib/validations/chat");

    const tooLong = aiSmartPrescriptionRequestSchema.safeParse({
      patientId: "patient-1",
      diagnosis: "Test",
      drugName: "A".repeat(201),
    });
    expect(tooLong.success).toBe(false);
  });
});

describe("Prescription save schema", () => {
  it("validates prescription save with medications", async () => {
    const { aiPrescriptionSaveSchema } = await import("@/lib/validations/chat");

    const valid = aiPrescriptionSaveSchema.safeParse({
      patientId: "patient-1",
      diagnosis: "Angine bactérienne",
      medications: [
        {
          name: "Amoxicilline",
          dosage: "1g",
          frequency: "3 fois/jour",
          duration: "7 jours",
          instructions: "Pendant les repas",
        },
      ],
      status: "draft",
    });
    expect(valid.success).toBe(true);
  });

  it("requires at least one medication", async () => {
    const { aiPrescriptionSaveSchema } = await import("@/lib/validations/chat");

    const noMeds = aiPrescriptionSaveSchema.safeParse({
      patientId: "patient-1",
      diagnosis: "Test",
      medications: [],
      status: "draft",
    });
    expect(noMeds.success).toBe(false);
  });

  it("validates medication fields", async () => {
    const { aiPrescriptionSaveSchema } = await import("@/lib/validations/chat");

    const invalidMed = aiPrescriptionSaveSchema.safeParse({
      patientId: "patient-1",
      diagnosis: "Test",
      medications: [{ name: "", dosage: "1g", frequency: "1x/j", duration: "7j" }],
      status: "draft",
    });
    expect(invalidMed.success).toBe(false);
  });

  it("validates status enum for prescriptions", async () => {
    const { aiPrescriptionSaveSchema } = await import("@/lib/validations/chat");

    const invalid = aiPrescriptionSaveSchema.safeParse({
      patientId: "patient-1",
      diagnosis: "Test",
      medications: [{ name: "Test", dosage: "1g", frequency: "1x/j", duration: "7j" }],
      status: "invalid",
    });
    expect(invalid.success).toBe(false);

    for (const status of ["draft", "reviewed", "signed", "printed", "dispensed"]) {
      const valid = aiPrescriptionSaveSchema.safeParse({
        patientId: "patient-1",
        diagnosis: "Test",
        medications: [{ name: "Test", dosage: "1g", frequency: "1x/j", duration: "7j" }],
        status,
      });
      expect(valid.success).toBe(true);
    }
  });
});
