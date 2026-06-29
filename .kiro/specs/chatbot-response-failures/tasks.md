# Implementation Plan

## Overview

Implementation tasks for the chatbot-response-failures bugfix. Covers Bug 1a (JSON envelope read path), Bug 1b (SSE line buffering), and Bug 2 (empty-fullContent agent guard), plus unit, property-based, and integration tests.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3"] },
    { "wave": 3, "tasks": ["4"] },
    { "wave": 4, "tasks": ["5"] },
    { "wave": 5, "tasks": ["6", "7"] },
    { "wave": 6, "tasks": ["8"] },
    { "wave": 7, "tasks": ["9"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - Envelope Mismatch + SSE Line Loss + Empty Agent Text
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms each bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: These tests encode the expected behavior — they will validate the fixes when they pass after implementation
  - **GOAL**: Surface concrete counterexamples that demonstrate each bug on unfixed code
  - File: `src/components/__tests__/chatbot-provider-bug-condition.test.tsx`
  - File: `src/app/api/__tests__/agent-route-bug-condition.test.ts`

  **Bug 1a — Envelope mismatch (JSON branch):**
  - Mock `fetch` to return `Content-Type: application/json` with body `{ ok: true, data: { message: { role: "assistant", content: "Bonjour" } } }`
  - Render `ChatbotProvider` and call `sendMessage("test")`
  - Assert rendered assistant message content equals `"Bonjour"`
  - Run on UNFIXED code → **EXPECTED OUTCOME: test FAILS** — `data.message?.content` is `undefined`, fallback "Sorry, I could not process your request." is shown
  - Document counterexample: `rendered === undefined`, hardcoded English fallback shown

  **Bug 1b — SSE line split across reads:**
  - Construct a mock `ReadableStream` that delivers an SSE response in two reads:
    - Read 1: `data: {"content":"Bon` (partial line — no closing `\n`)
    - Read 2: `jour"}\n\ndata: [DONE]\n\n`
  - Feed through the client SSE branch in `ChatbotProvider`
  - Assert accumulated content equals `"Bonjour"`
  - Run on UNFIXED code → **EXPECTED OUTCOME: test FAILS** — `JSON.parse` throws on the partial fragment, "jour" is dropped, accumulated content is `""`
  - Document counterexample: accumulated content `""` instead of `"Bonjour"`

  **Bug 2 — Agent tool-loop with no text-delta:**
  - Mock `callProviderStream` to return a `fullStream` that emits only:
    - `{ type: "tool-call", toolName: "getClinicStats" }`
    - `{ type: "tool-result", toolName: "getClinicStats", output: { ok: true } }`
    - No `text-delta` chunks
  - Mock `withAuthAnyRole` so the handler runs with `super_admin` profile
  - POST to the real `handlePost` function with `agentType: "super_admin"`
  - Collect all SSE events from the response `ReadableStream`
  - Assert that a `text` event with non-empty content is present in the event list
  - Run on UNFIXED code → **EXPECTED OUTCOME: test FAILS** — only `{ type: "error", code: "AI_OUTPUT_REJECTED" }` + `done` are emitted; `fullContent` stays `""`
  - Document counterexample: `{ type: "error", message: "La réponse IA a été rejetée…", code: "AI_OUTPUT_REJECTED" }`

  - Mark task complete when all three tests are written, run, and each failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing any fix)
  - **Property 2: Preservation** - ADVANCED SSE Streaming + Non-empty Agent Text Path
  - **IMPORTANT**: Follow observation-first methodology — observe unfixed code behavior for non-buggy inputs, then encode it as properties
  - **Scoped to non-bug-condition inputs**: cases where `isBugCondition_1`, `isBugCondition_1b`, and `isBugCondition_2` all return `false`
  - File: `src/components/__tests__/chatbot-provider-preservation.test.tsx`
  - File: `src/app/api/__tests__/agent-route-preservation.test.ts`

  **Preservation A — ADVANCED tier SSE with complete lines (Property 4 scope):**
  - Observe on unfixed code: when all `data:` lines arrive fully within a single read, the client accumulates content correctly and handles `data: [DONE]` termination
  - Write property-based test (use `@fast-check/vitest` / `fast-check`):
    - Generate 1–20 random `data: {"content":"<alphanumeric>"}` lines, each delivered in a single read (no split)
    - Assert fixed client accumulation equals `join("")` of all content values
    - Assert the SSE branch is taken (not the JSON branch) when `Content-Type: text/event-stream`
  - Verify test PASSES on unfixed code (baseline behavior confirmed)

  **Preservation B — Genuine error path (network failure):**
  - Observe on unfixed code: when `fetch` rejects with a `TypeError` (network error), the catch block fires and shows `t(locale, "chatbot.error")`
  - Write example-based test: stub `fetch` to `Promise.reject(new TypeError("network error"))`, assert `t(locale, "chatbot.error")` is rendered
  - Verify test PASSES on unfixed code

  **Preservation C — Agent non-empty text-delta path (Property 5 scope):**
  - Observe on unfixed code: when `fullStream` emits at least one `text-delta` chunk, all SSE events (`text`, `tool_call`, `tool-result`, `done`) are emitted, conversation is persisted, audit log is called, and token usage is tracked
  - Write property-based test:
    - Generate random mix of `tool-call`, `tool-result`, and ≥1 `text-delta` chunks (1–10 text-delta values, 0–3 tool steps)
    - Assert every generated `text-delta` appears in SSE `text` events
    - Assert `saveAgentConversationTurn`, `incrementAgentTokenUsage`, and `logAuditEvent` are called exactly once per run
    - Assert `done` event is always the last event emitted
  - Verify test PASSES on unfixed code

  - Mark task complete when all preservation tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix Bug 1a — Correct the JSON envelope read path in `chatbot-provider.tsx`

  - [x] 3.1 Add `ChatJsonResponse` typed interface and fix the read path
    - File: `src/components/chatbot/chatbot-provider.tsx`
    - Add the following interface above the `sendMessage` callback (or in a local types block):
      ```typescript
      interface ChatJsonResponse {
        ok: boolean;
        data?: {
          message?: { role: string; content: string };
          disclaimer?: string;
          language?: string;
        };
      }
      ```
    - In the `else` branch (JSON response, currently around line 130), replace:
      ```typescript
      const data = await response.json();
      ```
      with:
      ```typescript
      const data = (await response.json()) as ChatJsonResponse;
      ```
    - Replace the broken read:
      ```typescript
      content: data.message?.content || "Sorry, I could not process your request.",
      ```
      with the corrected envelope path and localized fallback:
      ```typescript
      content: data.data?.message?.content || t(locale, "chatbot.error"),
      ```
    - Remove the hardcoded English string `"Sorry, I could not process your request."` entirely — it must not appear anywhere in the file after this change
    - _Bug_Condition: `isBugCondition_1(X)` — `X.contentType = "application/json"` AND `X.body.ok = true` AND `X.body.data.message.content` is a string_
    - _Expected_Behavior: `rendered = X.body.data.message.content` AND `rendered ≠ "Sorry, I could not process your request."`_
    - _Preservation: JSON branch is only reached when `Content-Type` is NOT `text/event-stream`; ADVANCED SSE branch is untouched_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Verify Bug 1a exploration test now passes
    - **Property 1: Expected Behavior** - Envelope content is surfaced to the user
    - **IMPORTANT**: Re-run the SAME test from task 1 (Bug 1a section) — do NOT write a new test
    - Run `src/components/__tests__/chatbot-provider-bug-condition.test.tsx` (Bug 1a case only)
    - **EXPECTED OUTCOME: Test PASSES** — `data.data?.message?.content` is read correctly, `"Bonjour"` is rendered
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass after Bug 1a fix
    - **Property 2: Preservation** - ADVANCED SSE and error paths unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 (Preservation A and B) — do NOT write new tests
    - Run `src/components/__tests__/chatbot-provider-preservation.test.tsx`
    - **EXPECTED OUTCOME: Tests PASS** — SSE branch behavior and genuine-error path are identical before and after the fix

- [x] 4. Fix Bug 1b — Add SSE `lineBuffer` accumulator to the client SSE branch

  - [x] 4.1 Mirror the server-side `lineBuffer` pattern in the client SSE reader
    - File: `src/components/chatbot/chatbot-provider.tsx`
    - In the `if (contentType.includes("text/event-stream"))` branch, before the `while (true)` loop, add:
      ```typescript
      let lineBuffer = "";
      ```
    - Replace the existing chunk-split block:
      ```typescript
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");
      ```
      with the buffered pattern (matching `src/app/api/chat/route.ts` exactly):
      ```typescript
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      ```
    - The `for (const line of lines)` loop body (the `data: [DONE]` check and `JSON.parse` block) remains unchanged
    - Remove the `.filter((line) => line.trim() !== "")` call — the `lineBuffer` pattern supersedes it; blank lines (SSE event delimiters) are harmless because the loop only acts on `line.startsWith("data: ")` lines
    - _Bug_Condition: `isBugCondition_1b(stream)` — a `data:` line spans exactly one read boundary_
    - _Expected_Behavior: `accumulated(chatbotClient'(stream)) = concatOfAllContentDeltas(stream)` — no tokens dropped_
    - _Preservation: When all `data:` lines arrive within a single read, accumulated output is identical to before_
    - _Requirements: 2.4_

  - [x] 4.2 Verify Bug 1b exploration test now passes
    - **Property 1: Expected Behavior** - No token loss across SSE read boundaries
    - **IMPORTANT**: Re-run the SAME test from task 1 (Bug 1b section) — do NOT write a new test
    - Run `src/components/__tests__/chatbot-provider-bug-condition.test.tsx` (Bug 1b case only)
    - **EXPECTED OUTCOME: Test PASSES** — split `data:` line is reassembled, accumulated content is `"Bonjour"`
    - _Requirements: 2.4_

  - [x] 4.3 Verify preservation tests still pass after Bug 1b fix
    - **Property 2: Preservation** - Complete-line SSE sequences produce same output
    - **IMPORTANT**: Re-run the SAME tests from task 2 (Preservation A) — do NOT write new tests
    - Run `src/components/__tests__/chatbot-provider-preservation.test.tsx`
    - **EXPECTED OUTCOME: Tests PASS** — complete-line SSE sequences accumulate identically before and after

- [x] 5. Fix Bug 2 — Insert empty-`fullContent` guard in `agent/route.ts`

  - [x] 5.1 Import `callProvider` alongside `callProviderStream`
    - File: `src/app/api/ai/agent/route.ts`
    - Change the existing import line:
      ```typescript
      import { callProviderStream } from "@/lib/ai/providers";
      ```
      to:
      ```typescript
      import { callProviderStream, callProvider } from "@/lib/ai/providers";
      ```
    - Do NOT modify `src/lib/ai/providers.ts` or any other file in `src/lib/ai/`
    - _Requirements: 2.5_

  - [x] 5.2 Add the empty-`fullContent` guard after the `fullStream` loop
    - File: `src/app/api/ai/agent/route.ts`
    - Insert the following block immediately after the `for await (const chunk of (streamResult.raw as any).fullStream)` loop ends, **before** the `// ── Output validation ──` comment:
      ```typescript
      // ── Fallback synthesis when tool loop produced no text ──
      // Bug 2 fix: if the multi-step tool loop terminated with no text-delta
      // chunks (e.g. Workers AI / Llama ends on a tool-result step),
      // call the provider once more in non-streaming mode to synthesise
      // a plain-text summary of the tool results.
      if (!fullContent.trim()) {
        try {
          const fallbackResult = await callProvider(
            provider,
            {
              task: "conversation",
              complexity: "medium",
              prompt: `${prompt}\n\n[System: Les outils ont été exécutés. Résume les résultats en une réponse concise à l'utilisateur.]`,
              systemPrompt,
              maxTokens: 512,
              temperature: 0.3,
              context: "site-team-agent-fallback",
            },
            apiKey,
          );
          fullContent = fallbackResult.text;
        } catch (fallbackErr) {
          logger.warn("Agent fallback text generation failed", {
            context: "site-team-agent",
            agentType,
            clinicId,
            error: fallbackErr,
          });
          // Hard French fallback so validateAIOutput receives a non-empty string
          // and the user exits the "Réflexion…" state with a useful message.
          fullContent =
            "J'ai exécuté les outils demandés. Je n'ai pas pu générer un résumé textuel. Veuillez réessayer.";
        }
      }
      ```
    - The block inserts between the `for await` loop and the existing `validateAIOutput(fullContent)` call
    - No changes to `validateAIOutput`, `depseudonymise`, conversation persistence, usage tracking, or audit logging — those all run on the now-populated `fullContent` as before
    - All SSE event types (`meta`, `tool_call`, `tool-result`, `error`, `done`) remain emitted with identical shape for all non-buggy paths
    - _Bug_Condition: `isBugCondition_2(X)` — `X.agentType = "super_admin"` AND `enableDataTools = true` AND `emittedTextDeltaCount = 0`_
    - _Expected_Behavior: SSE stream emits a `text` event with non-empty content (or an `error` event), followed by `done`; UI exits "Réflexion…" state_
    - _Preservation: When `fullStream` emits ≥1 `text-delta` chunk, the guard block is skipped; all downstream behavior is identical_
    - _Requirements: 2.5, 2.6_

  - [x] 5.3 Verify Bug 2 exploration test now passes
    - **Property 1: Expected Behavior** - Agent never leaves user on a permanent spinner
    - **IMPORTANT**: Re-run the SAME test from task 1 (Bug 2 section) — do NOT write a new test
    - Run `src/app/api/__tests__/agent-route-bug-condition.test.ts` (Bug 2 case)
    - **EXPECTED OUTCOME: Test PASSES** — a `text` event with non-empty content is emitted; `AI_OUTPUT_REJECTED` error is not present
    - _Requirements: 2.5, 2.6_

  - [x] 5.4 Verify preservation tests still pass after Bug 2 fix
    - **Property 2: Preservation** - Non-empty agent text paths are unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 (Preservation C) — do NOT write new tests
    - Run `src/app/api/__tests__/agent-route-preservation.test.ts`
    - **EXPECTED OUTCOME: Tests PASS** — SSE events, conversation persistence, audit logs, and token tracking are all identical before and after

- [x] 6. Write unit tests covering all fixed paths
  - File: `src/components/__tests__/chatbot-provider.test.tsx`
  - File: `src/app/api/__tests__/agent-route.test.ts`
  - Use Vitest; import route handlers directly and invoke them as functions per project convention
  - Mock `@/lib/logger`, `@/lib/supabase-server`, `@/lib/tenant`, `@/lib/audit-log`, `@/lib/rate-limit` following the patterns in `rbac-access-control.test.ts` and `health-handler.test.ts`

  **Unit tests for `chatbot-provider.tsx`:**

  - [x] 6.1 BASIC-tier success: mock `fetch` returning `apiSuccess({ message: { role: "assistant", content: "Nos horaires sont…" }, disclaimer: "…" })`; assert rendered assistant message is `"Nos horaires sont…"` (not the fallback)
  - [x] 6.2 SMART-tier success (Workers AI): same as 6.1 with `content: "[AI‑Generated] Réponse Workers AI"`
  - [x] 6.3 Auth-fallback path: `apiSuccess({ message: { role: "assistant", content: "Keyword match reply" }, disclaimer: "…" })`; assert `"Keyword match reply"` rendered
  - [x] 6.4 JSON branch — absent content: mock `fetch` returning `{ ok: true, data: { message: {} } }` (no `content` field); assert `t(locale, "chatbot.error")` is rendered (localized fallback, not hardcoded English)
  - [x] 6.5 SSE branch with split line: two-read mock (as in task 1 Bug 1b); assert accumulated content is `"Bonjour"` and no logger warning about malformed JSON fires for the split fragment
  - [x] 6.6 SSE branch with complete lines: single-read mock with multiple `data: {"content":"…"}` lines; assert accumulated content equals their concatenation
  - [x] 6.7 Genuine network error: `fetch` rejects with `TypeError`; assert `t(locale, "chatbot.error")` rendered and no hardcoded English fallback
  - [x] 6.8 `ChatJsonResponse` interface: verify TypeScript compiles without errors after the interface addition (no `any` cast needed on the read path)

  **Unit tests for `agent/route.ts`:**

  - [x] 6.9 Empty-`fullContent` path — `callProvider` fallback succeeds: stub `callProviderStream` with zero `text-delta` chunks; stub `callProvider` to return `{ text: "Résumé des outils." }`; assert SSE stream contains `{ type: "text", content: "Résumé des outils." }` and no `AI_OUTPUT_REJECTED` error
  - [x] 6.10 Empty-`fullContent` path — `callProvider` fallback also fails: stub both `callProviderStream` (zero text-delta) and `callProvider` to throw; assert SSE stream contains a `text` event with the hardcoded French fallback string `"J'ai exécuté les outils demandés…"` and no `AI_OUTPUT_REJECTED` error
  - [x] 6.11 Normal text-delta path (preservation): stub `callProviderStream` with two `text-delta` chunks `"Bonjour "` and `"monde"`; assert SSE `text` events are emitted, `fullContent` is never passed through the guard, `saveAgentConversationTurn` is called with `assistantMessage` containing `"Bonjour monde"`, and `done` is the last event

  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 7. Write property-based tests (5 properties)
  - Use `fast-check` (already in the project's ecosystem); import via `import * as fc from "fast-check"` and use `fc.assert(fc.property(…))` inside Vitest `it` blocks
  - Files: `src/components/__tests__/chatbot-provider-pbt.test.tsx` and `src/app/api/__tests__/agent-route-pbt.test.ts`

  - [x] 7.1 **Property 1 — Envelope content always surfaced (fix-checking)**
    - `fc.string({ minLength: 1, maxLength: 500 })` for `content`
    - For all generated `content` strings: mock `fetch` to return `{ ok: true, data: { message: { role: "assistant", content } } }`
    - Assert rendered assistant message equals the generated `content` string
    - Assert rendered message does NOT equal `"Sorry, I could not process your request."`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 7.2 **Property 2 — No token loss across arbitrary SSE split positions (fix-checking)**
    - `fc.array(fc.string({ minLength: 1, maxLength: 50, charset: "alphanumeric" }), { minLength: 1, maxLength: 20 })` for content tokens
    - `fc.integer({ min: 1, max: totalBytes - 1 })` for the split byte position within the SSE payload
    - Build full SSE payload as `tokens.map(t => \`data: {"content":"${t}"}\n\n\`).join("") + "data: [DONE]\n\n"`
    - Split it at the generated position into two reads
    - Assert accumulated content from the fixed `ChatbotProvider` SSE branch equals `tokens.join("")`
    - _Requirements: 2.4_

  - [x] 7.3 **Property 3 — Agent always exits spinner state with zero text-delta (fix-checking)**
    - `fc.array(fc.record({ toolName: fc.string({ minLength: 1, maxLength: 30 }) }), { minLength: 0, maxLength: 5 })` for tool steps
    - For each generated tool-step sequence: stub `callProviderStream` with matching `tool-call` + `tool-result` pairs and zero `text-delta` chunks; also stub `callProvider` to return a random non-empty string
    - Assert SSE event list contains at least one `{ type: "text" }` event with non-empty content OR one `{ type: "error" }` event
    - Assert `done` is always the final event in the list
    - Assert no `{ type: "error", code: "AI_OUTPUT_REJECTED" }` event is present
    - _Requirements: 2.5, 2.6_

  - [x] 7.4 **Property 4 — ADVANCED SSE preservation with complete lines (preservation)**
    - `fc.array(fc.string({ minLength: 0, maxLength: 80, charset: "alphanumeric" }), { minLength: 1, maxLength: 20 })` for content tokens
    - Build SSE payload with all lines complete within a single read (no split)
    - Assert fixed `ChatbotProvider` accumulated content equals `tokens.join("")`
    - Assert this result is identical to what the original (unfixed) code produced for the same input (snapshot the unfixed behavior once in task 2 and compare)
    - _Requirements: 3.1, 3.2_

  - [x] 7.5 **Property 5 — Agent text-delta path preservation**
    - `fc.tuple(fc.array(fc.string({ minLength: 1, maxLength: 80 }), { minLength: 1, maxLength: 10 }), fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 3 }))` for `[textDeltas, toolNames]`
    - Build `fullStream` stub emitting `textDeltas` as `text-delta` chunks interleaved with `tool-call`/`tool-result` pairs from `toolNames`
    - Assert every `text-delta` text appears in the emitted SSE `text` events (in order)
    - Assert `saveAgentConversationTurn` is called exactly once with `assistantMessage` equal to `depseudonymise(validateAIOutput(textDeltas.join("")))`
    - Assert `incrementAgentTokenUsage` and `logAuditEvent` (for `site_team_agent_chat`) are each called exactly once
    - Assert `done` is the last SSE event
    - _Requirements: 3.4, 3.5, 3.6, 3.7_

- [x] 8. Write integration tests
  - Use Vitest + React Testing Library for component-level integration tests
  - File: `src/components/__tests__/chatbot-integration.test.tsx`
  - File: `src/app/api/__tests__/agent-route-integration.test.ts`
  - Follow the full-chain integration pattern: mock external dependencies (Supabase, AI providers), invoke real handlers/components, verify observable end-to-end behavior

  - [x] 8.1 Full BASIC-tier flow: render `ChatbotProvider` in a test tree wrapping a minimal chat UI; mock `/api/chat` to return BASIC-tier `apiSuccess` envelope; call `sendMessage("Quels sont vos horaires?")` via `useChatbot()`; assert the reply `"Nos horaires sont…"` appears in the message list and no fallback is shown
  - [x] 8.2 Full SMART-tier flow: same setup with Workers AI JSON response `{ ok: true, data: { message: { role: "assistant", content: "[AI‑Generated] Réponse IA" } } }`; assert `"[AI‑Generated] Réponse IA"` renders
  - [x] 8.3 Full ADVANCED-tier flow (SSE with split line): mock `/api/chat` with a chunked SSE response where `data: {"content":"Bon` and `jour"}` arrive in two reads followed by `data: [DONE]`; assert `"Bonjour"` accumulates in the message and no tokens are dropped
  - [x] 8.4 Full super_admin agent flow — tool-only loop: mock `callProviderStream` to emit only tool events (no `text-delta`); mock `callProvider` to return `"Voici un résumé des outils exécutés."`; POST to `/api/ai/agent` with `agentType: "super_admin"`; collect SSE events; assert a `{ type: "text", content: "Voici un résumé…" }` event is emitted and `done` follows; assert `"Réflexion…"` spinner class is not present after the stream ends
  - [x] 8.5 Full super_admin agent flow — normal text: mock `callProviderStream` to emit `text-delta` chunks; assert streamed answer accumulates in `AgentWidget` message list; assert `saveAgentConversationTurn`, `incrementAgentTokenUsage`, and `logAuditEvent` are each called once with correct arguments

  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5_

## Notes

- Do NOT modify `src/lib/ai/providers.ts` or `validateAIOutput` — fixes are scoped to `chatbot-provider.tsx` and `agent/route.ts` only.
- All tests go in `src/app/api/__tests__/` (API/route tests) and `src/components/__tests__/` (component tests).
- Use `createMockSupabaseClient()`, `createMockTenantHeaders()`, and `createMockRequest()` from `src/components/__tests__/test-utils.ts` when available.
- Property-based tests use `fast-check` (`fc.assert` / `fc.property`); run with `--run` flag for single execution in CI.
- The hardcoded English string `"Sorry, I could not process your request."` must be completely removed from `chatbot-provider.tsx` — the localized `t(locale, "chatbot.error")` replaces it everywhere.
- SSE event types (`meta`, `tool_call`, `tool-result`, `text`, `error`, `done`) must retain their exact shapes after the Bug 2 fix.
- Conversation persistence, audit logging, and token usage tracking in `agent/route.ts` are downstream of the fix point and must remain unmodified.

- [x] 9. Checkpoint — Ensure all tests pass and no regressions
  - Run the full unit test suite: `npm run test -- --run`
  - Confirm all 5 property-based tests pass (tasks 7.1–7.5)
  - Confirm all 8 integration tests pass (tasks 8.1–8.5)
  - Confirm all unit tests pass (tasks 6.1–6.11)
  - Confirm bug condition exploration tests from task 1 now pass (confirming fixes are in place)
  - Confirm preservation tests from task 2 still pass (no regressions)
  - Verify no TypeScript errors: `npx tsc --noEmit`
  - Verify no new ESLint violations on the three changed files:
    `npx eslint src/components/chatbot/chatbot-provider.tsx src/app/api/ai/agent/route.ts`
  - Verify the hardcoded English string `"Sorry, I could not process your request."` does not appear anywhere in `chatbot-provider.tsx`
  - Verify `src/lib/ai/providers.ts` and `validateAIOutput` are unchanged (no modifications to shared AI pipeline)
  - Ask the user if any questions arise before closing the spec
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
