/**
 * Bug Condition Exploration Tests — Agent Route (Bug 2)
 *
 * These tests encode the EXPECTED CORRECT behavior and MUST FAIL on unfixed code.
 * Failure confirms bug 2 exists. DO NOT fix the production code to make these pass.
 *
 * Bug 2 — Agent tool-loop with no text-delta:
 *   When super_admin triggers a multi-step tool loop and the provider emits only
 *   tool-call / tool-result chunks with no text-delta, `fullContent` stays "".
 *   `validateAIOutput("")` returns "" (falsy), so the route emits an
 *   `{ type: "error", code: "AI_OUTPUT_REJECTED" }` event instead of a `text` event.
 *
 *   Counter-example (unfixed code):
 *     SSE stream contains: { type: "error", code: "AI_OUTPUT_REJECTED" }
 *     No { type: "text" } event is present.
 *
 *   Expected behavior (fixed code):
 *     SSE stream contains at least one { type: "text" } event with non-empty content.
 *     No AI_OUTPUT_REJECTED error is emitted.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Auth mock (must come before module imports that use withAuthAnyRole) ──────

const mockAuthContext = {
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "auth-user-super" } },
        error: null,
      }),
    },
  },
  user: { id: "auth-user-super" },
  profile: { id: "profile-super", role: "super_admin" as const, clinic_id: null },
};

// Mock withAuthAnyRole to pass the handler directly with our mock auth context
type Handler = (req: NextRequest, auth: typeof mockAuthContext) => Promise<Response>;
vi.mock("@/lib/with-auth", () => ({
  withAuthAnyRole: (handler: Handler) => (req: NextRequest) => handler(req, mockAuthContext),
  withAuth: (handler: Handler) => (req: NextRequest) => handler(req, mockAuthContext),
}));

// ── Infrastructure mocks ─────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/rate-limit", () => ({
  aiManagerLimiter: { check: vi.fn(async () => true) },
  aiClinicCeilingLimiter: { check: vi.fn(async () => true) },
}));

vi.mock("@/lib/tenant", () => ({
  getTenant: vi.fn(async () => null),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
  isValidClinicId: vi.fn(() => true),
}));

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "auth-user-super" } },
        error: null,
      }),
    },
  })),
  createTenantClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
  createScopedAdminClient: vi.fn(() => null),
  createUntypedAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock("@/lib/request-context-response-headers", () => ({
  applyRequestScopedResponseHeaders: vi.fn((_req, res) => res),
}));

vi.mock("@/lib/profile-header-hmac", () => ({
  verifyProfileHeader: vi.fn(async () => null),
  PROFILE_HEADER_NAMES: {
    id: "x-auth-profile-id",
    role: "x-auth-profile-role",
    clinic: "x-auth-profile-clinic",
    sig: "x-auth-profile-sig",
    iat: "x-auth-profile-iat",
  },
}));

vi.mock("@/lib/ai/chat-history", () => ({
  saveAgentConversationTurn: vi.fn(async () => "conv-1"),
  incrementAgentTokenUsage: vi.fn(async () => {}),
}));

vi.mock("@/lib/ai/memory", () => ({
  retrieveMemories: vi.fn(async () => []),
  formatMemoryBlock: vi.fn(() => null),
}));

vi.mock("@/lib/ai/pseudonymise", () => ({
  createPseudonymMap: vi.fn(() => new Map()),
  depseudonymise: vi.fn((text: string) => text),
}));

vi.mock("@/lib/ai/sanitize", () => ({
  sanitizeUntrustedText: vi.fn((text: string) => text),
}));

vi.mock("@/lib/ai/prompts", () => ({
  getAgentSystemPrompt: vi.fn(() => "System prompt"),
  SITE_TEAM_AGENT_TYPES: [
    "super_admin",
    "clinic_admin",
    "doctor",
    "secretary",
    "receptionist",
    "patient",
  ],
}));

vi.mock("@/lib/ai/tools", () => ({
  getAgentTools: vi.fn(() => []),
  buildSDKTools: vi.fn(() => ({})),
}));

// ── Provider router mocks ─────────────────────────────────────────────────────

const mockLoadProviderConfigs = vi.fn(
  async (..._args: unknown[]) => new Map([["openai", { apiKey: "test-key" }]]),
);
const mockSelectAvailableProvider = vi.fn(async (..._args: unknown[]) => "openai" as const);

vi.mock("@/lib/ai/router", () => ({
  loadProviderConfigs: (...args: unknown[]) => mockLoadProviderConfigs(...args),
  selectAvailableProvider: (...args: unknown[]) => mockSelectAvailableProvider(...args),
  AllProvidersFailedError: class AllProvidersFailedError extends Error {
    errors: unknown[];
    constructor(errors: unknown[]) {
      super("All providers failed");
      this.name = "AllProvidersFailedError";
      this.errors = errors;
    }
  },
}));

// ── callProviderStream mock (the key mock for this test) ─────────────────────

/**
 * Build a mock ProviderStreamResult whose fullStream emits only tool-call
 * and tool-result chunks, with ZERO text-delta chunks.
 *
 * This is the isBugCondition_2 scenario: the multi-step tool loop terminates
 * with no text output, leaving fullContent = "".
 */
function buildToolOnlyStream(tools: Array<{ toolName: string; output?: unknown }>) {
  async function* generateChunks() {
    for (const tool of tools) {
      yield { type: "tool-call", toolName: tool.toolName };
      yield {
        type: "tool-result",
        toolName: tool.toolName,
        output: tool.output ?? { ok: true },
      };
    }
    // Deliberately NO text-delta chunks — this is the bug condition
  }

  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        // Empty text stream — no text produced
      },
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 0 }),
    response: Promise.resolve({ modelId: "gpt-4o" }),
    raw: {
      fullStream: generateChunks(),
    },
  };
}

const mockCallProviderStream = vi.fn();

vi.mock("@/lib/ai/providers", () => ({
  callProviderStream: (...args: unknown[]) => mockCallProviderStream(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collect all SSE events from a ReadableStream response body.
 * Returns the parsed payload objects (the JSON after "data: ").
 */
async function collectSseEvents(response: Response): Promise<Array<Record<string, unknown>>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response has no body");

  const decoder = new TextDecoder();
  const events: Array<Record<string, unknown>> = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const payload = JSON.parse(line.slice(6));
          events.push(payload);
        } catch {
          // ignore malformed lines
        }
      }
    }
  }

  return events;
}

function buildAgentRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/ai/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Bug 2 tests ───────────────────────────────────────────────────────────────

describe("Bug 2 — Agent tool-loop with no text-delta (EXPLORATION: expected to FAIL on unfixed code)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset infrastructure mocks
    mockLoadProviderConfigs.mockResolvedValue(
      new Map([["openai", { apiKey: "test-key", model: "gpt-4o" }]]),
    );
    mockSelectAvailableProvider.mockResolvedValue("openai");
  });

  /**
   * Counterexample (unfixed code):
   *   events = [
   *     { type: "error", message: "La réponse IA a été rejetée...", code: "AI_OUTPUT_REJECTED" },
   *     { type: "done" }
   *   ]
   *   No { type: "text" } event is present.
   *
   * Expected behavior (fixed code):
   *   events includes at least one { type: "text" } with non-empty content.
   */
  it("should emit a text event when the tool loop produces no text-delta chunks", async () => {
    // isBugCondition_2: zero text-delta chunks, only tool-call + tool-result
    mockCallProviderStream.mockReturnValueOnce(
      buildToolOnlyStream([{ toolName: "getClinicStats", output: { ok: true, stats: {} } }]),
    );

    const { POST } = await import("@/app/api/ai/agent/route");

    const req = buildAgentRequest({
      agentType: "super_admin",
      clinicId: null,
      conversationId: null,
      messages: [{ role: "user", content: "Show me clinic statistics" }],
    });

    const response = await POST(req);
    const events = await collectSseEvents(response);

    // On UNFIXED code: this assertion fails — no text event is emitted.
    // Only { type: "error", code: "AI_OUTPUT_REJECTED" } + { type: "done" } are present.
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents.length).toBeGreaterThan(0);

    // The text event content must not be empty
    for (const evt of textEvents) {
      expect(typeof evt.content).toBe("string");
      expect((evt.content as string).trim().length).toBeGreaterThan(0);
    }
  });

  it("should NOT emit AI_OUTPUT_REJECTED when tool loop has no text-delta", async () => {
    mockCallProviderStream.mockReturnValueOnce(
      buildToolOnlyStream([{ toolName: "getClinicStats", output: { ok: true } }]),
    );

    const { POST } = await import("@/app/api/ai/agent/route");

    const req = buildAgentRequest({
      agentType: "super_admin",
      clinicId: null,
      conversationId: null,
      messages: [{ role: "user", content: "What are the stats?" }],
    });

    const response = await POST(req);
    const events = await collectSseEvents(response);

    // On UNFIXED code: this assertion fails — AI_OUTPUT_REJECTED is emitted.
    const errorEvents = events.filter((e) => e.type === "error" && e.code === "AI_OUTPUT_REJECTED");
    expect(errorEvents).toHaveLength(0);
  });

  it("should always emit done as the final event", async () => {
    mockCallProviderStream.mockReturnValueOnce(
      buildToolOnlyStream([
        { toolName: "getClinicStats", output: { ok: true } },
        { toolName: "listPatients", output: { ok: true, count: 42 } },
      ]),
    );

    const { POST } = await import("@/app/api/ai/agent/route");

    const req = buildAgentRequest({
      agentType: "super_admin",
      clinicId: null,
      conversationId: null,
      messages: [{ role: "user", content: "Run multi-tool analysis" }],
    });

    const response = await POST(req);
    const events = await collectSseEvents(response);

    // done must be present (regardless of fix status)
    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents.length).toBeGreaterThan(0);

    // On UNFIXED code: the text assertion below fails.
    // There is a text event present (not just error + done).
    const hasTextOrError = events.some((e) => e.type === "text" || e.type === "error");
    expect(hasTextOrError).toBe(true);

    // Specifically: a text event must be present (not replaced by error)
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents.length).toBeGreaterThan(0);
  });

  it("documents the unfixed counterexample: only error+done are emitted on unfixed code", async () => {
    // This test documents what unfixed code produces.
    // It will PASS on unfixed code and FAIL after the fix is applied.
    // We include it here as documentation of the observed bug counterexample.
    //
    // Counterexample:
    //   events = [
    //     { type: "tool_call", name: "getClinicStats", step: 1 },
    //     { type: "tool_call", name: "getClinicStats", step: 1, resultSummary: "success" },
    //     { type: "error", message: "La réponse IA a été rejetée par le validateur de sécurité.", code: "AI_OUTPUT_REJECTED" },
    //     { type: "done" }
    //   ]
    //   No { type: "text" } event present.

    mockCallProviderStream.mockReturnValueOnce(
      buildToolOnlyStream([{ toolName: "getClinicStats", output: { ok: true } }]),
    );

    const { POST } = await import("@/app/api/ai/agent/route");

    const req = buildAgentRequest({
      agentType: "super_admin",
      clinicId: null,
      conversationId: null,
      messages: [{ role: "user", content: "Show stats" }],
    });

    const response = await POST(req);
    const events = await collectSseEvents(response);

    // BUG DOCUMENTATION: assert the EXPECTED FIXED behavior.
    // On UNFIXED code this will fail — the text assertion below does not hold.
    const textEvents = events.filter((e) => e.type === "text");
    expect(
      textEvents.length,
      `COUNTEREXAMPLE (unfixed): events were ${JSON.stringify(events, null, 2)}\n` +
        `Expected at least one { type: "text" } event, but found none. ` +
        `fullContent stayed "" after tool loop → validateAIOutput("") returned null → AI_OUTPUT_REJECTED emitted.`,
    ).toBeGreaterThan(0);
  });
});
