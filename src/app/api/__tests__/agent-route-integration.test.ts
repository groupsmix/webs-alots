/**
 * Integration Tests — Agent Route (Task 8)
 *
 * Validates end-to-end behavior through the real POST handler:
 * - 8.4 Full super_admin agent flow — tool-only loop (no text-delta)
 * - 8.5 Full super_admin agent flow — normal text (text-delta only)
 *
 * These tests verify the complete request → auth → provider → SSE → response
 * chain. External dependencies (Supabase, AI providers) are mocked; the real
 * route handler is invoked directly.
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

// ── callProviderStream + callProvider mocks ───────────────────────────────────

const mockCallProviderStream = vi.fn();
const mockCallProvider = vi.fn();

vi.mock("@/lib/ai/providers", () => ({
  callProviderStream: (...args: unknown[]) => mockCallProviderStream(...args),
  callProvider: (...args: unknown[]) => mockCallProvider(...args),
}));

// ── Stream builders ──────────────────────────────────────────────────────────

/**
 * Build a mock ProviderStreamResult whose fullStream emits only tool-call
 * and tool-result chunks with ZERO text-delta chunks.
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
    // No text-delta chunks — this triggers the fallback synthesis path
  }

  return {
    textStream: {
      async *[Symbol.asyncIterator]() {},
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 0 }),
    response: Promise.resolve({ modelId: "gpt-4o" }),
    raw: { fullStream: generateChunks() },
  };
}

/**
 * Build a mock ProviderStreamResult whose fullStream emits only text-delta chunks.
 */
function buildTextDeltaStream(deltas: string[]) {
  async function* generateChunks() {
    for (const text of deltas) {
      yield { type: "text-delta", text };
    }
  }

  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        for (const text of deltas) yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 20, outputTokens: 5 }),
    response: Promise.resolve({ modelId: "gpt-4o" }),
    raw: { fullStream: generateChunks() },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collect all SSE events from a ReadableStream response body.
 * Returns parsed payload objects (the JSON after "data: ").
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

// ── 8.4 Full super_admin agent flow — tool-only loop ─────────────────────────

describe("8.4 — Full super_admin agent flow: tool-only loop (no text-delta)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadProviderConfigs.mockResolvedValue(
      new Map([["openai", { apiKey: "test-key", model: "gpt-4o" }]]),
    );
    mockSelectAvailableProvider.mockResolvedValue("openai");
  });

  it("emits a text event containing the fallback summary, followed by done, with no AI_OUTPUT_REJECTED", async () => {
    // callProviderStream emits only tool events — no text-delta
    mockCallProviderStream.mockReturnValueOnce(
      buildToolOnlyStream([{ toolName: "getClinicStats", output: { ok: true } }]),
    );

    // callProvider fallback returns a non-empty summary
    mockCallProvider.mockResolvedValueOnce({
      text: "Voici un résumé des outils exécutés.",
    });

    const { POST } = await import("@/app/api/ai/agent/route");

    const req = buildAgentRequest({
      agentType: "super_admin",
      clinicId: null,
      conversationId: null,
      messages: [{ role: "user", content: "Show me clinic statistics" }],
    });

    const response = await POST(req);
    const events = await collectSseEvents(response);

    // Must contain at least one text event
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents.length).toBeGreaterThan(0);

    // The text content must contain the fallback summary
    const allTextContent = textEvents.map((e) => e.content as string).join("");
    expect(allTextContent).toContain("Voici un résumé");

    // done must be the last event
    expect(events[events.length - 1].type).toBe("done");

    // No AI_OUTPUT_REJECTED error event
    const rejectedErrors = events.filter(
      (e) => e.type === "error" && e.code === "AI_OUTPUT_REJECTED",
    );
    expect(rejectedErrors).toHaveLength(0);
  });
});

// ── 8.5 Full super_admin agent flow — normal text ─────────────────────────────

describe("8.5 — Full super_admin agent flow: normal text-delta stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadProviderConfigs.mockResolvedValue(
      new Map([["openai", { apiKey: "test-key", model: "gpt-4o" }]]),
    );
    mockSelectAvailableProvider.mockResolvedValue("openai");
  });

  it("emits 2 text events with streamed deltas and done as the last event", async () => {
    // callProviderStream emits two text-delta chunks — no tool events
    mockCallProviderStream.mockReturnValueOnce(buildTextDeltaStream(["Bonjour ", "monde"]));

    const { POST } = await import("@/app/api/ai/agent/route");

    const req = buildAgentRequest({
      agentType: "super_admin",
      clinicId: null,
      conversationId: null,
      messages: [{ role: "user", content: "Hello" }],
    });

    const response = await POST(req);
    const events = await collectSseEvents(response);

    // Exactly 2 text events with the streamed content
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents.length).toBe(2);
    expect(textEvents[0].content).toBe("Bonjour ");
    expect(textEvents[1].content).toBe("monde");

    // done must be the last event
    expect(events[events.length - 1].type).toBe("done");

    // The empty-fullContent guard must NOT have fired — callProvider not called
    expect(mockCallProvider).not.toHaveBeenCalled();
  });

  it("does NOT call saveAgentConversationTurn for super_admin with clinicId: null", async () => {
    // super_admin + clinicId: null → historySupabase is null → persistence skipped
    mockCallProviderStream.mockReturnValueOnce(buildTextDeltaStream(["Bonjour ", "monde"]));

    const { POST } = await import("@/app/api/ai/agent/route");
    const { saveAgentConversationTurn } = await import("@/lib/ai/chat-history");

    const req = buildAgentRequest({
      agentType: "super_admin",
      clinicId: null,
      conversationId: null,
      messages: [{ role: "user", content: "Hello" }],
    });

    await POST(req);

    // historySupabase is null when clinicId is null for super_admin,
    // so saveAgentConversationTurn must never be called
    expect(saveAgentConversationTurn).not.toHaveBeenCalled();
  });
});
