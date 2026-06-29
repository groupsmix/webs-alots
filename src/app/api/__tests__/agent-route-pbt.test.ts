/**
 * Property-Based Tests — Agent Route (Task 7)
 *
 * **Validates: Requirements 2.5, 2.6, 3.4, 3.5**
 *
 * Property 4 — Agent always exits spinner state with zero text-delta
 * Property 5 — Agent text-delta path preservation
 */

import * as fc from "fast-check";
import { NextRequest } from "next/server";
import { describe, it, expect, vi } from "vitest";

// ── Auth mock ─────────────────────────────────────────────────────────────────

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

// ── Provider router mocks ────────────────────────────────────────────────────

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

// ── callProviderStream + callProvider mocks ──────────────────────────────────

const mockCallProviderStream = vi.fn();
const mockCallProvider = vi.fn();

vi.mock("@/lib/ai/providers", () => ({
  callProviderStream: (...args: unknown[]) => mockCallProviderStream(...args),
  callProvider: (...args: unknown[]) => mockCallProvider(...args),
}));

// ── Stream builders ──────────────────────────────────────────────────────────

function buildToolOnlyStream(toolNames: string[]) {
  async function* generateChunks() {
    for (const toolName of toolNames) {
      yield { type: "tool-call", toolName };
      yield { type: "tool-result", toolName, output: { ok: true } };
    }
    // Deliberately NO text-delta chunks
  }

  return {
    textStream: { async *[Symbol.asyncIterator]() {} },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 0 }),
    response: Promise.resolve({ modelId: "gpt-4o" }),
    raw: { fullStream: generateChunks() },
  };
}

function buildTextDeltaStream(textDeltas: string[]) {
  async function* generateChunks() {
    for (const text of textDeltas) {
      yield { type: "text-delta", text };
    }
  }

  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        for (const text of textDeltas) yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 20, outputTokens: 10 }),
    response: Promise.resolve({ modelId: "gpt-4o" }),
    raw: { fullStream: generateChunks() },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Alphanumeric string arbitrary ─────────────────────────────────────────────
// Safe identifiers for tool names (no special chars that break JSON)
const alphanumericToolName = fc
  .string({ minLength: 1, maxLength: 20 })
  .map((s) => s.replace(/[^a-zA-Z0-9_]/g, "a") || "tool");

// ── Property 4 — Agent always exits spinner state with zero text-delta ────────

describe("7.4 — Property 4 (task 7.3): Agent always exits spinner state with zero text-delta", () => {
  /**
   * **Validates: Requirements 2.5, 2.6**
   *
   * For any sequence of tool-call/tool-result pairs with zero text-delta chunks,
   * the fixed agent route must emit at least one text event (or error event)
   * followed by a done event, and must never emit AI_OUTPUT_REJECTED.
   */

  it("always emits a text or non-rejected-error event when tool loop has no text-delta", async () => {
    const { POST } = await import("@/app/api/ai/agent/route");

    await fc.assert(
      fc.asyncProperty(
        fc.array(alphanumericToolName, { minLength: 0, maxLength: 3 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (toolNames, fallbackText) => {
          vi.clearAllMocks();
          mockLoadProviderConfigs.mockResolvedValue(
            new Map([["openai", { apiKey: "test-key", model: "gpt-4o" }]]),
          );
          mockSelectAvailableProvider.mockResolvedValue("openai");

          mockCallProviderStream.mockReturnValueOnce(buildToolOnlyStream(toolNames));
          mockCallProvider.mockResolvedValueOnce({ text: fallbackText });

          const req = buildAgentRequest({
            agentType: "super_admin",
            clinicId: null,
            conversationId: null,
            messages: [{ role: "user", content: "Use tools" }],
          });

          const response = await POST(req);
          const events = await collectSseEvents(response);

          // Must have at least one text OR error event
          const textEvents = events.filter((e) => e.type === "text");
          const errorEvents = events.filter((e) => e.type === "error");
          expect(textEvents.length + errorEvents.length).toBeGreaterThan(0);

          // Must NOT contain AI_OUTPUT_REJECTED
          const rejectedErrors = events.filter(
            (e) => e.type === "error" && e.code === "AI_OUTPUT_REJECTED",
          );
          expect(rejectedErrors).toHaveLength(0);

          // done must be the last event
          expect(events[events.length - 1].type).toBe("done");
        },
      ),
      { numRuns: 30, seed: 42 },
    );
  });
});

// ── Property 5 — Agent text-delta path preservation ──────────────────────────

describe("7.5 — Property 5: Agent text-delta path preservation", () => {
  /**
   * **Validates: Requirements 3.4, 3.5**
   *
   * For any sequence of non-empty text-delta chunks, the fixed agent route must:
   * - Emit all deltas as SSE text events (in order)
   * - NOT call callProvider (the empty-content guard must not fire)
   * - End with done as the last event
   */

  it("emits all text-delta chunks in SSE text events and ends with done", async () => {
    const { POST } = await import("@/app/api/ai/agent/route");

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
          { minLength: 1, maxLength: 5 },
        ),
        async (textDeltas) => {
          vi.clearAllMocks();
          mockLoadProviderConfigs.mockResolvedValue(
            new Map([["openai", { apiKey: "test-key", model: "gpt-4o" }]]),
          );
          mockSelectAvailableProvider.mockResolvedValue("openai");

          // Pure text-delta stream with no tool events
          mockCallProviderStream.mockReturnValueOnce(buildTextDeltaStream(textDeltas));

          const req = buildAgentRequest({
            agentType: "super_admin",
            clinicId: null,
            conversationId: null,
            messages: [{ role: "user", content: "Tell me something" }],
          });

          const response = await POST(req);
          const events = await collectSseEvents(response);

          // All deltas must appear in SSE text events in order
          const textEvents = events.filter((e) => e.type === "text");
          expect(textEvents.length).toBe(textDeltas.length);

          for (let i = 0; i < textDeltas.length; i++) {
            expect(textEvents[i].content).toBe(textDeltas[i]);
          }

          // callProvider (fallback guard) must NOT have been called
          expect(mockCallProvider).not.toHaveBeenCalled();

          // done is the last event
          expect(events[events.length - 1].type).toBe("done");
        },
      ),
      { numRuns: 30, seed: 42 },
    );
  });
});
