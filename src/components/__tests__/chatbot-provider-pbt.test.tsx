/**
 * Property-Based Tests — ChatbotProvider (Task 7)
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.1, 3.2**
 *
 * Property 1 — Envelope content always surfaced (fix-checking)
 * Property 2 — No token loss across arbitrary SSE split positions (fix-checking)
 * Property 3 — ADVANCED SSE preservation with complete lines
 */

import { render, screen, act, waitFor } from "@testing-library/react";
import * as fc from "fast-check";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { ChatbotProvider, useChatbot } from "@/components/chatbot/chatbot-provider";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/components/locale-switcher", () => ({
  useLocale: () => ["fr", vi.fn()],
}));

// ── Expected i18n fallback text ───────────────────────────────────────────────
const CHATBOT_ERROR_FR = "Désolé, une erreur est survenue. Veuillez réessayer.";

// ── Test consumer component ──────────────────────────────────────────────────

function TestConsumer() {
  const { messages, sendMessage, isLoading } = useChatbot();

  return (
    <div>
      <div data-testid="loading">{isLoading ? "loading" : "idle"}</div>
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

function renderProvider() {
  return render(
    <ChatbotProvider clinicId="clinic-test">
      <TestConsumer />
    </ChatbotProvider>,
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Trigger sendMessage, wait for loading to complete, return the assistant message text.
 */
async function triggerAndWait(): Promise<string> {
  await act(async () => {
    screen.getByTestId("send").click();
  });
  await waitFor(() => {
    expect(screen.getByTestId("loading").textContent).toBe("idle");
  });
  const el = screen.queryByTestId("msg-assistant");
  return el?.textContent ?? "";
}

// ── Alphanumeric string arbitrary ─────────────────────────────────────────────
// Alphanumeric chars only, safe for embedding in JSON SSE payloads without escaping
const alphanumericString = (minLength: number, maxLength: number) =>
  fc
    .string({ minLength, maxLength })
    .map((s) => s.replace(/[^a-zA-Z0-9]/g, "a"))
    .filter((s) => s.length >= minLength);

// ── Property 1 — Envelope content always surfaced ────────────────────────────

describe("7.1 — Property 1: Envelope content always surfaced (fix-checking)", () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * For any non-empty content string, the fixed chatbot-provider must render
   * that exact string from the apiSuccess envelope and never show the hardcoded
   * English fallback.
   */
  it("always renders content from data.data.message.content for any string", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 200 }), async (content) => {
        vi.restoreAllMocks();

        const envelope = {
          ok: true,
          data: {
            message: { role: "assistant", content },
          },
        };

        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(buildJsonResponse(envelope));

        const { unmount } = renderProvider();

        const rendered = await triggerAndWait();

        // Must render the generated content
        expect(rendered).toBe(content);

        // Must NOT render the hardcoded English fallback
        expect(rendered).not.toBe("Sorry, I could not process your request.");

        unmount();
      }),
      { numRuns: 50, seed: 42 },
    );
  });
});

// ── Property 2 — No token loss across arbitrary SSE split positions ───────────

describe("7.2 — Property 2: No token loss across arbitrary SSE split positions (fix-checking)", () => {
  /**
   * **Validates: Requirements 2.4**
   *
   * For any list of alphanumeric tokens delivered as an SSE stream split at a
   * random byte position, the fixed chatbot-provider must accumulate content
   * equal to tokens.join("").
   */
  it("accumulates all tokens regardless of where the SSE payload is split", async () => {
    const encoder = new TextEncoder();

    await fc.assert(
      fc.asyncProperty(
        fc.array(alphanumericString(1, 10), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 99 }),
        async (tokens, splitPercent) => {
          vi.restoreAllMocks();

          const fullPayload =
            tokens.map((tk) => `data: {"content":"${tk}"}\n\n`).join("") + "data: [DONE]\n\n";

          const payloadBytes = encoder.encode(fullPayload);
          const totalBytes = payloadBytes.length;

          // Use splitPercent to derive a valid split position
          const splitPos = Math.max(
            1,
            Math.min(totalBytes - 1, Math.floor((splitPercent / 100) * totalBytes)),
          );

          const read1 = payloadBytes.slice(0, splitPos);
          const read2 = payloadBytes.slice(splitPos);

          const stream = buildFakeStream([read1, read2]);
          vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(buildSseResponse(stream));

          const { unmount } = renderProvider();

          const rendered = await triggerAndWait();

          expect(rendered).toBe(tokens.join(""));

          unmount();
        },
      ),
      { numRuns: 50, seed: 42 },
    );
  });
});

// ── Property 3 — ADVANCED SSE preservation with complete lines ───────────────

describe("7.3 — Property 3 (task 7.4): ADVANCED SSE preservation with complete lines", () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any list of alphanumeric tokens where all SSE lines are complete within
   * a single read, the fixed chatbot-provider must accumulate content equal to
   * tokens.join("").
   */
  it("produces the correct accumulated content for complete-line SSE sequences", async () => {
    const encoder = new TextEncoder();

    await fc.assert(
      fc.asyncProperty(
        fc.array(alphanumericString(1, 20), { minLength: 1, maxLength: 10 }),
        async (tokens) => {
          vi.restoreAllMocks();

          // All tokens delivered as complete SSE lines in a single read
          const fullPayload =
            tokens.map((tk) => `data: {"content":"${tk}"}\n\n`).join("") + "data: [DONE]\n\n";

          const stream = buildFakeStream([encoder.encode(fullPayload)]);
          vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(buildSseResponse(stream));

          const { unmount } = renderProvider();

          const rendered = await triggerAndWait();

          expect(rendered).toBe(tokens.join(""));

          // Must not fall back to the error message
          expect(rendered).not.toBe(CHATBOT_ERROR_FR);

          unmount();
        },
      ),
      { numRuns: 50, seed: 42 },
    );
  });
});
