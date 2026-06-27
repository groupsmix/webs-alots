/**
 * Integration Tests — ChatbotProvider (Task 8)
 *
 * Validates end-to-end behavior through the real ChatbotProvider component:
 * - 8.1 Full BASIC-tier flow (JSON response)
 * - 8.2 Full SMART-tier flow (Workers AI JSON response)
 * - 8.3 Full ADVANCED-tier flow (SSE with split line)
 */

import { render, screen, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChatbotProvider, useChatbot } from "@/components/chatbot/chatbot-provider";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock locale-switcher to return a stable "fr" locale so t() calls work
vi.mock("@/components/locale-switcher", () => ({
  useLocale: () => ["fr", vi.fn()],
}));

// ── Expected i18n fallback text ───────────────────────────────────────────────
// t("fr", "chatbot.error") resolves to this string
const CHATBOT_ERROR_FR = "Désolé, une erreur est survenue. Veuillez réessayer.";

// ── Test consumer component ──────────────────────────────────────────────────

/**
 * Minimal component that exposes ChatbotProvider state and the sendMessage
 * action so tests can trigger and inspect the result.
 */
function TestConsumer({ message = "test" }: { message?: string }) {
  const { messages, sendMessage, isLoading } = useChatbot();

  return (
    <div>
      <div data-testid="loading">{isLoading ? "loading" : "idle"}</div>
      <div data-testid="message-count">{messages.length}</div>
      {messages.map((m) => (
        <div key={m.id} data-testid={`msg-${m.role}`}>
          {m.content}
        </div>
      ))}
      <button data-testid="send" onClick={() => sendMessage(message)}>
        Send
      </button>
    </div>
  );
}

function renderProvider(clinicId?: string, message?: string) {
  return render(
    <ChatbotProvider clinicId={clinicId ?? "clinic-test"}>
      <TestConsumer message={message} />
    </ChatbotProvider>,
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a fake ReadableStream backed by an array of Uint8Array reads.
 * Each call to reader.read() returns one entry from the array.
 */
function buildFakeStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Create a Response with Content-Type: application/json.
 */
function buildJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a Response with Content-Type: text/event-stream.
 */
function buildSseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ── 8.1 Full BASIC-tier flow ──────────────────────────────────────────────────

describe("8.1 — Full BASIC-tier flow (JSON apiSuccess envelope)", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("renders the assistant reply from the BASIC-tier JSON envelope", async () => {
    const envelope = {
      ok: true,
      data: {
        message: { role: "assistant", content: "Nos horaires sont 9h-18h." },
        disclaimer: "Aide",
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(buildJsonResponse(envelope));

    renderProvider("clinic-test", "Quels sont vos horaires?");

    await act(async () => {
      screen.getByTestId("send").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("idle");
    });

    // User message should appear in the list
    const userMsg = screen.getByTestId("msg-user");
    expect(userMsg.textContent).toBe("Quels sont vos horaires?");

    // Assistant reply must match the content from the envelope
    const assistantMsg = screen.getByTestId("msg-assistant");
    expect(assistantMsg.textContent).toBe("Nos horaires sont 9h-18h.");

    // No fallback error message
    expect(assistantMsg.textContent).not.toBe(CHATBOT_ERROR_FR);
    expect(assistantMsg.textContent).not.toBe("Sorry, I could not process your request.");
  });
});

// ── 8.2 Full SMART-tier flow ──────────────────────────────────────────────────

describe("8.2 — Full SMART-tier flow (Workers AI JSON response)", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("renders the assistant reply from the Workers AI JSON envelope", async () => {
    const envelope = {
      ok: true,
      data: {
        message: { role: "assistant", content: "[AI-Generated] Réponse IA" },
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(buildJsonResponse(envelope));

    renderProvider();

    await act(async () => {
      screen.getByTestId("send").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("idle");
    });

    const assistantMsg = screen.getByTestId("msg-assistant");
    expect(assistantMsg.textContent).toBe("[AI-Generated] Réponse IA");

    // No fallback error message
    expect(assistantMsg.textContent).not.toBe(CHATBOT_ERROR_FR);
    expect(assistantMsg.textContent).not.toBe("Sorry, I could not process your request.");
  });
});

// ── 8.3 Full ADVANCED-tier flow (SSE with split line) ────────────────────────

describe("8.3 — Full ADVANCED-tier flow (SSE with split line across reads)", () => {
  const encoder = new TextEncoder();

  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("accumulates Bonjour when the data: line is split across two reads", async () => {
    // Read 1: partial line — no closing \n
    const read1 = encoder.encode('data: {"content":"Bon');
    // Read 2: remainder of line + done signal
    const read2 = encoder.encode('jour"}\n\ndata: [DONE]\n\n');

    const stream = buildFakeStream([read1, read2]);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(buildSseResponse(stream));

    renderProvider();

    await act(async () => {
      screen.getByTestId("send").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("idle");
    });

    // The lineBuffer must have reassembled "Bonjour" across the two reads
    const assistantMsg = screen.getByTestId("msg-assistant");
    expect(assistantMsg.textContent).toBe("Bonjour");

    // No tokens were dropped — no fallback error shown
    expect(assistantMsg.textContent).not.toBe(CHATBOT_ERROR_FR);
    expect(assistantMsg.textContent).not.toBe("");
  });

  it("does not drop any tokens when the SSE payload is split at a mid-JSON boundary", async () => {
    // Two tokens, split mid-way through the first
    const read1 = encoder.encode('data: {"content":"He');
    const read2 = encoder.encode('llo"}\ndata: {"content":" world"}\n\ndata: [DONE]\n\n');

    const stream = buildFakeStream([read1, read2]);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(buildSseResponse(stream));

    renderProvider();

    await act(async () => {
      screen.getByTestId("send").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("idle");
    });

    const assistantMsg = screen.getByTestId("msg-assistant");
    expect(assistantMsg.textContent).toBe("Hello world");
  });
});
