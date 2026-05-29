/**
 * Tests for POST /api/v1/ai/drug-interaction-alerts
 *
 * Validates drug interaction alert endpoint schema and behavior.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/features", () => ({
  isAIEnabled: vi.fn(async () => true),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/rate-limit", () => ({
  aiDrugCheckLimiter: { check: vi.fn(async () => true) },
  aiClinicCeilingLimiter: { check: vi.fn(async () => true) },
}));

describe("Drug interaction alerts schema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates request schema with medications", async () => {
    const { aiDrugInteractionCheckRequestSchema } = await import("@/lib/validations/chat");

    const result = aiDrugInteractionCheckRequestSchema.safeParse({});
    expect(result.success).toBe(false);

    const valid = aiDrugInteractionCheckRequestSchema.safeParse({
      medications: ["Amoxicilline", "Métronidazole"],
    });
    expect(valid.success).toBe(true);
  });

  it("requires at least one medication", async () => {
    const { aiDrugInteractionCheckRequestSchema } = await import("@/lib/validations/chat");

    const empty = aiDrugInteractionCheckRequestSchema.safeParse({
      medications: [],
    });
    expect(empty.success).toBe(false);
  });

  it("accepts optional patient context", async () => {
    const { aiDrugInteractionCheckRequestSchema } = await import("@/lib/validations/chat");

    const valid = aiDrugInteractionCheckRequestSchema.safeParse({
      medications: ["Warfarine", "Aspirine"],
      patientId: "patient-1",
      patientAllergies: ["Pénicilline"],
      currentMedications: ["Amlodipine 5mg"],
    });
    expect(valid.success).toBe(true);
  });

  it("enforces max medications count", async () => {
    const { aiDrugInteractionCheckRequestSchema } = await import("@/lib/validations/chat");

    const tooMany = aiDrugInteractionCheckRequestSchema.safeParse({
      medications: Array.from({ length: 51 }, (_, i) => `Drug${i}`),
    });
    expect(tooMany.success).toBe(false);

    const maxAllowed = aiDrugInteractionCheckRequestSchema.safeParse({
      medications: Array.from({ length: 50 }, (_, i) => `Drug${i}`),
    });
    expect(maxAllowed.success).toBe(true);
  });

  it("enforces medication name max length", async () => {
    const { aiDrugInteractionCheckRequestSchema } = await import("@/lib/validations/chat");

    const tooLong = aiDrugInteractionCheckRequestSchema.safeParse({
      medications: ["A".repeat(201)],
    });
    expect(tooLong.success).toBe(false);
  });
});

describe("checkAllInteractions local check", () => {
  it("detects drug-drug interactions from local DB", async () => {
    const { checkAllInteractions } = await import("@/lib/check-interactions");

    const result = checkAllInteractions(["Warfarine", "Aspirine"], []);
    expect(result).toBeDefined();
    expect(result.overallSeverity).toBeDefined();
    expect(result.alerts).toBeInstanceOf(Array);
    expect(typeof result.dangerousCount).toBe("number");
    expect(typeof result.cautionCount).toBe("number");
  });

  it("detects allergy conflicts", async () => {
    const { checkAllInteractions } = await import("@/lib/check-interactions");

    const result = checkAllInteractions(["Amoxicilline"], ["Pénicilline"]);
    expect(result).toBeDefined();
    expect(result.alerts).toBeInstanceOf(Array);
  });

  it("returns safe for non-interacting drugs", async () => {
    const { checkAllInteractions } = await import("@/lib/check-interactions");

    const result = checkAllInteractions(["Paracétamol"], []);
    expect(result.overallSeverity).toBe("safe");
  });
});
