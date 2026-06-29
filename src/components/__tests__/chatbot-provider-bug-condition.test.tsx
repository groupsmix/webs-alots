/**
 * Bug Condition Exploration Tests — ChatbotProvider
 *
 * These tests encode the EXPECTED CORRECT behavior and MUST FAIL on unfixed code.
 * Failure confirms each bug exists. DO NOT fix the production code to make these pass.
 *
 * Bug 1a — JSON envelope mismatch:
 *   Unfixed code reads `data.message?.content` (one level too shallow).
 *   The actual path is `data.data.message.content`.
 *   Counter-example: rendered === undefined, fallback shown instead.
 *
 * Bug 1b — SSE line split across reads:
 *   Unfixed code does not buffer partial lines across reads.
 *   When a `data:` line spans two reads, the partial fragment is discarded.
 *   Counter-example: accumulated content is "" instead of "Bonjour".
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

// ── Test consumer component ──────────────────────────────────────────────────

/**
 * Minimal component that exposes ChatbotProvider state and the sendMessage
 * action so tests can trigger and inspect the result.
 */
function TestConsumer() {
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
      <button data-testid="send" onClick={() => sendMessage("test")}>
        Send
      </button>
    </div>
  );
}

function renderProvider(clinicId?: string) {
  return render(
    <ChatbotProvider clinicId={clinicId ?? "clinic-test"}>
      <TestConsumer />
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
 * Create a Response with a given body and content-type.
 * Wraps the body as a string into a ReadableStream so reader.read() works.
 */
function buildJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function buildSseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ── Bug 1a: JSON envelope mismatch ──────────────────────────────────────────

describe("Bug 1a — JSON envelope read path (EXPLORATION: expected to FAIL on unfixed code)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Counterexample (unfixed code):
   *   rendered === "Sorry, I could not process your request."
   *   because data.message?.content is undefined (correct path: data.data.message.content)
   *
   * Expected behavior (fixed code):
   *   rendered === "Bonjour"
   */
  it("should render assistant message content from the apiSuccess envelope", async () => {
    // The server returns { ok: true, data: { message: { role, content } } }
    // via apiSuccess(). The correct client read path is data.data.message.content.
    const envelope = {
      ok: true,
      data: {
        message: { role: "assistant", content: "Bonjour" },
        disclaimer: "Test disclaimer",
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(buildJsonResponse(envelope));

    renderProvider();

    await act(async () => {
      const sendButton = screen.getByTestId("send");
      sendButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("idle");
    });

    // On UNFIXED code: this fails because the assistant message renders
    // "Sorry, I could not process your request." instead of "Bonjour".
    // Counterexample: data.message?.content === undefined
    const assistantMsg = screen.getByTestId("msg-assistant");
    expect(assistantMsg.textContent).toBe("Bonjour");
    expect(assistantMsg.textContent).not.toBe("Sorry, I could not process your request.");
  });

  it("should NOT show the hardcoded English fallback for a valid apiSuccess response", async () => {
    const envelope = {
      ok: true,
      data: {
        message: { role: "assistant", content: "Nos horaires sont 9h-18h." },
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

    // On UNFIXED code: fails — hardcoded English fallback is shown
    const assistantMsg = screen.getByTestId("msg-assistant");
    expect(assistantMsg.textContent).not.toBe("Sorry, I could not process your request.");
    expect(assistantMsg.textContent).toBe("Nos horaires sont 9h-18h.");
  });
});

// ── Bug 1b: SSE line split across reads ─────────────────────────────────────

describe("Bug 1b — SSE line buffering across read boundaries (EXPLORATION: expected to FAIL on unfixed code)", () => {
  const encoder = new TextEncoder();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Counterexample (unfixed code):
   *   accumulated content === ""
   *   because the partial line 'data: {"content":"Bon' cannot be JSON-parsed;
   *   it is caught and discarded. The second read 'jour"}\n\n...' starts with
   *   'jour"}' which is also not a valid `data:` prefix, so it too is discarded.
   *
   * Expected behavior (fixed code):
   *   accumulated content === "Bonjour"
   */
  it("should accumulate content when a data: line is split across two reads", async () => {
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

    // On UNFIXED code: fails — accumulated content is "" (both fragments discarded)
    const assistantMsg = screen.getByTestId("msg-assistant");
    expect(assistantMsg.textContent).toBe("Bonjour");
  });

  it("should handle a split that cuts mid-JSON on an object boundary", async () => {
    // Read 1: ends right after the content key
    const read1 = encoder.encode('data: {"content":"He');
    // Read 2: rest of the content + a second complete line + done
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

    // On UNFIXED code: fails — "He" fragment is discarded, only " world" may appear
    const assistantMsg = screen.getByTestId("msg-assistant");
    expect(assistantMsg.textContent).toBe("Hello world");
  });
});
