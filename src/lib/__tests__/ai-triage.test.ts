/**
 * Tests for Phase D1: AI triage pipeline.
 *
 * Covers:
 * - Red-flag detection for medical emergencies
 * - Heuristic fallback when AI is disabled
 * - triageTicket() fail-open behaviour
 * - triageOutputSchema validation
 * - applyTriageToTicket writes correct columns
 * - escalateUrgentTicket creates alerts only for urgent
 */
import { describe, it, expect, vi } from "vitest";
import { hasRedFlag, triageOutputSchema } from "@/lib/ai/triage";

// ── Mocks ──

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/features", () => ({
  isAIEnabled: vi.fn().mockResolvedValue(false),
}));

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});

const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "support_tickets") {
        return { update: mockUpdate };
      }
      if (table === "platform_alerts") {
        return { insert: mockInsert };
      }
      return { update: mockUpdate, insert: mockInsert };
    }),
  })),
}));

vi.mock("@/lib/ai/router", () => ({
  loadProviderConfigs: vi.fn().mockResolvedValue(new Map()),
  selectAvailableProvider: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/ai/pseudonymise", () => ({
  createPseudonymMap: vi.fn(() => ({ forward: new Map(), reverse: new Map() })),
  pseudonymise: vi.fn((obj: Record<string, unknown>) => obj),
  depseudonymise: vi.fn((text: string) => text),
}));

describe("Red flag detection", () => {
  it("detects chest pain in French", () => {
    expect(hasRedFlag("j'ai une douleur thoracique forte")).toBe(true);
  });

  it("detects bleeding in English", () => {
    expect(hasRedFlag("heavy bleeding from wound")).toBe(true);
  });

  it("detects infant fever in French", () => {
    expect(hasRedFlag("mon bébé a de la fièvre très haute")).toBe(true);
  });

  it("detects breathing difficulty in Arabic", () => {
    expect(hasRedFlag("أعاني من ضيق تنفس شديد")).toBe(true);
  });

  it("detects seizure", () => {
    expect(hasRedFlag("il a eu des convulsions")).toBe(true);
  });

  it("detects suicidal ideation", () => {
    expect(hasRedFlag("thoughts of suicide")).toBe(true);
  });

  it("detects allergic reaction", () => {
    expect(hasRedFlag("réaction allergique sévère")).toBe(true);
  });

  it("returns false for non-medical text", () => {
    expect(hasRedFlag("je voudrais prendre un rendez-vous")).toBe(false);
  });

  it("returns false for billing inquiry", () => {
    expect(hasRedFlag("question about my invoice")).toBe(false);
  });
});

describe("triageOutputSchema", () => {
  it("validates a correct triage output", () => {
    const result = triageOutputSchema.safeParse({
      language: "fr",
      urgency: "high",
      tags: ["technical"],
      summary: "User reports login issue",
      draftReply: "Merci, nous vérifions votre accès.",
      confidence: 0.85,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid urgency", () => {
    const result = triageOutputSchema.safeParse({
      language: "fr",
      urgency: "critical",
      tags: ["general"],
      summary: "test",
      draftReply: "test",
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty tags", () => {
    const result = triageOutputSchema.safeParse({
      language: "fr",
      urgency: "normal",
      tags: [],
      summary: "test",
      draftReply: "test",
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence > 1", () => {
    const result = triageOutputSchema.safeParse({
      language: "fr",
      urgency: "normal",
      tags: ["general"],
      summary: "test",
      draftReply: "test",
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts darija language", () => {
    const result = triageOutputSchema.safeParse({
      language: "darija",
      urgency: "normal",
      tags: ["general"],
      summary: "test",
      draftReply: "test",
      confidence: 0.5,
    });
    expect(result.success).toBe(true);
  });
});

describe("triageTicket (heuristic fallback)", () => {
  it("returns heuristic triage when AI is disabled", async () => {
    const { triageTicket } = await import("@/lib/ai/triage");
    const result = await triageTicket("Test ticket", [
      { senderType: "patient", content: "I need help with my appointment" },
    ]);
    expect(result).toMatchObject({
      language: "fr",
      confidence: 0.3,
    });
    expect(result.urgency).toBe("normal");
  });

  it("forces urgent when red flag is detected even with AI disabled", async () => {
    const { triageTicket } = await import("@/lib/ai/triage");
    const result = await triageTicket("Medical emergency", [
      { senderType: "patient", content: "J'ai une douleur thoracique très forte" },
    ]);
    expect(result.urgency).toBe("urgent");
  });

  it("handles empty messages array", async () => {
    const { triageTicket } = await import("@/lib/ai/triage");
    const result = await triageTicket("General question", []);
    expect(result.urgency).toBe("normal");
    expect(result.tags).toContain("general");
  });
});

describe("applyTriageToTicket", () => {
  it("calls update with correct columns", async () => {
    mockUpdate.mockClear();
    const { applyTriageToTicket } = await import("@/lib/ai/triage");
    await applyTriageToTicket("tid-1", "cid-1", {
      language: "fr",
      urgency: "high",
      tags: ["technical"],
      summary: "Login issue",
      draftReply: "We are looking into it",
      confidence: 0.9,
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ai_urgency: "high",
        ai_tags: ["technical"],
        ai_summary: "Login issue",
        ai_draft_reply: "We are looking into it",
        ai_confidence: 0.9,
      }),
    );
  });
});

describe("escalateUrgentTicket", () => {
  it("creates alert for urgent tickets", async () => {
    mockInsert.mockClear();
    mockUpdate.mockClear();
    const { escalateUrgentTicket } = await import("@/lib/ai/triage");
    await escalateUrgentTicket("tid-1", "cid-1", {
      language: "fr",
      urgency: "urgent",
      tags: ["medical_urgent"],
      summary: "Chest pain reported",
      draftReply: "Merci",
      confidence: 0.95,
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: "cid-1",
        alert_type: "urgent_ticket",
        severity: "critical",
      }),
    );
  });

  it("skips escalation for non-urgent tickets", async () => {
    mockInsert.mockClear();
    const { escalateUrgentTicket } = await import("@/lib/ai/triage");
    await escalateUrgentTicket("tid-1", "cid-1", {
      language: "fr",
      urgency: "normal",
      tags: ["general"],
      summary: "Normal ticket",
      draftReply: "Merci",
      confidence: 0.7,
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
