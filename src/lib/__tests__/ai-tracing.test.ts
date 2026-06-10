import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordAITrace, traceFromSuccess, traceFromFailure, type AITrace } from "@/lib/ai/tracing";

// Mock supabase-server before importing tracing module
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: vi.fn(() => ({ from: mockFrom })),
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("AI Tracing (E1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("traceFromSuccess", () => {
    it("builds a success trace with correct fields", () => {
      const trace = traceFromSuccess("triage", {
        clinicId: "clinic-123",
        provider: "openai",
        model: "gpt-4.1-mini",
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 1200,
        costCents: 0.5,
        fromFallback: false,
      });

      expect(trace.feature).toBe("triage");
      expect(trace.provider).toBe("openai");
      expect(trace.model).toBe("gpt-4.1-mini");
      expect(trace.status).toBe("ok");
      expect(trace.inputTokens).toBe(100);
      expect(trace.outputTokens).toBe(50);
      expect(trace.latencyMs).toBe(1200);
      expect(trace.costCents).toBe(0.5);
      expect(trace.clinicId).toBe("clinic-123");
    });

    it("includes fallback chain when provided", () => {
      const chain = [
        { provider: "openai", error: "rate_limited" },
        { provider: "anthropic", error: "timeout" },
      ];
      const trace = traceFromSuccess("conversation", {
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        inputTokens: 200,
        outputTokens: 100,
        latencyMs: 2000,
        costCents: 0.1,
        fromFallback: true,
        fallbackChain: chain,
      });

      expect(trace.fallbackChain).toHaveLength(2);
      expect(trace.fallbackChain[0].provider).toBe("openai");
      expect(trace.fallbackChain[1].provider).toBe("anthropic");
    });
  });

  describe("traceFromFailure", () => {
    it("builds a failure trace with 2-entry fallback chain", () => {
      const chain = [
        { provider: "openai", error: "rate_limited (60000ms)" },
        { provider: "anthropic", error: "500 Internal Server Error" },
      ];

      const trace = traceFromFailure("classify", {
        clinicId: "clinic-456",
        latencyMs: 5000,
        fallbackChain: chain,
      });

      expect(trace.status).toBe("all_providers_failed");
      expect(trace.fallbackChain).toHaveLength(2);
      expect(trace.fallbackChain[0].provider).toBe("openai");
      expect(trace.fallbackChain[0].error).toContain("rate_limited");
      expect(trace.fallbackChain[1].provider).toBe("anthropic");
      expect(trace.provider).toBe("openai");
      expect(trace.model).toBe("none");
      expect(trace.inputTokens).toBe(0);
      expect(trace.outputTokens).toBe(0);
      expect(trace.costCents).toBe(0);
    });

    it("handles empty fallback chain gracefully", () => {
      const trace = traceFromFailure("summarize", {
        latencyMs: 100,
        fallbackChain: [],
      });

      expect(trace.provider).toBe("unknown");
      expect(trace.fallbackChain).toHaveLength(0);
    });
  });

  describe("recordAITrace", () => {
    it("writes trace to database asynchronously", async () => {
      const trace: AITrace = {
        clinicId: "clinic-789",
        feature: "triage",
        provider: "openai",
        model: "gpt-4.1-mini",
        fallbackChain: [],
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 1200,
        status: "ok",
        costCents: 0.5,
      };

      recordAITrace(trace);

      // Allow the async void to flush
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockFrom).toHaveBeenCalledWith("ai_traces");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          clinic_id: "clinic-789",
          feature: "triage",
          provider: "openai",
          model: "gpt-4.1-mini",
          status: "ok",
          cost_cents: 0.5,
        }),
      );
    });

    it("does not store prompt or response bodies (PHI safety)", async () => {
      const trace: AITrace = {
        feature: "conversation",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        fallbackChain: [],
        inputTokens: 500,
        outputTokens: 200,
        latencyMs: 3000,
        status: "ok",
        costCents: 1.2,
      };

      recordAITrace(trace);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const insertedData = mockInsert.mock.calls[0][0];
      // Assert no prompt or response fields exist
      expect(insertedData).not.toHaveProperty("prompt");
      expect(insertedData).not.toHaveProperty("response");
      expect(insertedData).not.toHaveProperty("input_text");
      expect(insertedData).not.toHaveProperty("output_text");
      expect(insertedData).not.toHaveProperty("messages");
    });
  });
});
