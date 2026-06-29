# Chatbot Response Failures — Bugfix Design

## Overview

Two AI chatbot surfaces in the Oltigo Health platform return no useful answer
to the user despite the underlying AI pipeline producing valid responses.

**Bug 1 — Clinic-site chatbot JSON envelope mismatch.**
`src/app/api/chat/route.ts` wraps all non-streaming replies with `apiSuccess()`
from `src/lib/api-response.ts`, producing `{ ok: true, data: { message: {…} } }`.
The client `src/components/chatbot/chatbot-provider.tsx` reads `data.message?.content`
(one level too shallow — the real path is `data.data.message.content`), so the
value is always `undefined` and the hardcoded fallback is shown instead.  A
secondary robustness issue in the same file: the SSE branch splits each decoded
chunk on `"\n"` without buffering partial lines across reads, which can silently
drop tokens when a `data:` line spans two network reads.

**Bug 2 — Super-admin "Assistant Oltigo" stuck on "Réflexion…" spinner.**
`src/app/api/ai/agent/route.ts` streams `fullStream` from the AI SDK and
accumulates text only from `text-delta` chunks.  When `super_admin` triggers a
multi-step tool loop (`enableDataTools: true`, `stopWhen: stepCountIs(5)`) and
the loop terminates on a tool step with no trailing text step, `fullContent`
stays `""`.  The route then passes `""` to `validateAIOutput` which returns
`null`, emitting an `error` SSE event.  However `src/components/ai/AgentWidget.tsx`
only removes the empty placeholder message when an error is **thrown**; an SSE
`error` event is thrown via `throw new Error(payload.message)`, so the empty
`assistantMessageId` placeholder is removed from state correctly in theory — but
when `fullContent === ""` and `validateAIOutput("")` returns `null` (falsy), the
route emits `error` then `done`, and `AgentWidget` does filter out the empty
placeholder.  The actual root-cause path confirmed by code inspection is:
`validateAIOutput("")` is called with an empty string; `null` causes the error
branch, which is surfaced to the user as a generic "La réponse IA a été rejetée"
error rather than a meaningful fallback answer.  The spinner persists when the
error path re-throws but the placeholder was never cleared before the `throw`.

Fix strategy: minimal, targeted changes — correct the one-level envelope read in
the client, add cross-read line buffering to the SSE client branch, and add a
fallback text emission in the agent route when `fullContent` is empty after the
stream loop so the `error` path is never triggered by an empty string.

## Glossary

- **Bug_Condition (C)**: The set of runtime inputs that trigger defective behaviour.
- **Property (P)**: The observable outcome required when C holds — the correct answer.
- **Preservation**: All runtime inputs where C does NOT hold; these must produce
  identical results before and after the fix.
- **apiSuccess envelope**: The standard response shape `{ ok: true, data: T }` returned
  by `apiSuccess<T>()` in `src/lib/api-response.ts`.  When `T = { message, disclaimer }`,
  the full JSON path to the content string is `data.data.message.content`.
- **chatbot-provider**: `src/components/chatbot/chatbot-provider.tsx` — the React
  context provider that calls `/api/chat` and renders assistant messages.
- **chat/route**: `src/app/api/chat/route.ts` — the tenant-aware chatbot API route
  supporting BASIC, SMART (Workers AI), and ADVANCED (streaming SSE) tiers.
- **agent/route**: `src/app/api/ai/agent/route.ts` — the site-team agent API route
  that runs a multi-step tool loop and streams SSE events to `AgentWidget`.
- **AgentWidget**: `src/components/ai/AgentWidget.tsx` — the super-admin (and
  site-team) chat widget that consumes agent/route SSE events.
- **Chat / Réflexion spinner**: `src/components/ui/chat.tsx` renders the spinning
  `"Réflexion…"` placeholder whenever an assistant message has empty content.
- **fullContent**: The string accumulated from `text-delta` SSE chunks in agent/route.
- **fullStream**: The async iterable of AI SDK stream events exposed via
  `(streamResult.raw as any).fullStream`; can emit `text-delta`, `tool-call`,
  and `tool-result` chunk types.
- **callProviderStream**: `src/lib/ai/providers.ts callProviderStream()` — returns
  a `ProviderStreamResult` wrapping the AI SDK `streamText` result.
- **enableDataTools**: Flag in `src/config/agent.config.ts`; `true` for
  `super_admin`, `clinic_admin`, `doctor`, `secretary`, and `receptionist`.
- **lineBuffer**: The cross-read buffer pattern (used correctly in the server
  ADVANCED tier path) that keeps a partial line and prepends it to the next
  decoded chunk before splitting on `"\n"`.

## Bug Details

### Bug 1 — Envelope Mismatch (BASIC / SMART tiers)

The bug manifests for every non-streaming `/api/chat` response. `apiSuccess(payload)`
wraps the caller-supplied object one extra level:

```
// What the server sends:
{ ok: true, data: { message: { role: "assistant", content: "…" }, disclaimer: "…" } }

// What the client reads (WRONG):
const content = data.message?.content   // → undefined

// What the client should read (CORRECT):
const content = data.data.message.content
```

**Formal Specification:**

```
FUNCTION isBugCondition_1(X)
  INPUT: X = HTTP response from /api/chat
  OUTPUT: boolean

  RETURN X.headers["content-type"] CONTAINS "application/json"
     AND X.body MATCHES { ok: true, data: { message: { content: string } } }
END FUNCTION
```

**Concrete examples:**

- BASIC tier: `getBasicResponse()` returns a keyword-match string; server calls
  `apiSuccess({ message: { role: "assistant", content: "Nos horaires sont…" }, … })`.
  Client reads `data.message?.content` → `undefined` → shows fallback.
- SMART tier (Workers AI success): server calls `apiSuccess({ message: { role: "assistant",
  content: "[AI-Generated] …" }, … })`.  Client reads `data.message?.content` → `undefined`.
- Auth-failed fallback: server calls `apiSuccess({ message: …, disclaimer: … })` with
  keyword-match content.  Client reads `undefined` → shows fallback.
- Edge case — ADVANCED tier (SSE): `content-type: text/event-stream`; isBugCondition_1
  is `false`; the SSE branch is taken; this path is **unaffected**.

### Bug 1b — SSE Line Buffering (ADVANCED tier — secondary robustness)

```
FUNCTION isBugCondition_1b(stream)
  INPUT: stream = sequence of ReadableStream reads for an SSE /api/chat response
  OUTPUT: boolean

  RETURN EXISTS a "data: …\n" line L
         SUCH THAT L spans exactly one read boundary
         (first part ends the previous read, remainder begins the next)
END FUNCTION
```

**Concrete example:** The server emits `data: {"content":"Bon"}\ndata: {"content":"jour"}\n\n`.
If the first network read delivers `data: {"content":"Bon"}\ndata: {"content":"Bon`, the
current `chunk.split("\n")` yields `['data: {"content":"Bon"}', 'data: {"content":"Bon']`.
The second fragment is not valid JSON, so the `catch` discards it and "jour" is lost.

### Bug 2 — Agent "Réflexion…" Spinner (super_admin tool-loop)

```
FUNCTION isBugCondition_2(X)
  INPUT: X = POST /api/ai/agent request
  OUTPUT: boolean

  RETURN X.agentType = "super_admin"
     AND X.enableDataTools = true
     AND (
           emittedTextDeltaCount(fullStream(X)) = 0
           // i.e. the provider ran tool steps but emitted no text-delta
         )
END FUNCTION
```

**Concrete examples:**

- Workers AI / Llama via OpenAI-compatible endpoint does not reliably support
  tool-call → text-step sequences; the loop can end after a `tool-result` chunk
  with no follow-up text.
- Any provider where the final step is a `tool-result` without a synthesising
  text step (possible when `stopWhen: stepCountIs(5)` terminates the loop mid-
  reasoning) leaves `fullContent = ""`.
- In the current code: `validateAIOutput("") === null`, so the route emits
  `sseChunk("error", { message: "La réponse IA a été rejetée…" })` then
  `sseChunk("done")`.  `AgentWidget` throws on the `error` event, the
  `catch` block fires, and — because `assistantMessageId` placeholder has
  `content: ""` — `setMessages` filters it out.  The `error` state is set and
  displayed in the error bar at the bottom.  The widget exits the spinner
  (`setIsLoading(false)` in `finally`).  **So the spinner does clear**, but the
  user sees a misleading "safety validator rejected" error instead of a real
  answer or a useful fallback.  The true fix is to ensure `fullContent` is never
  empty when the AI pipeline succeeds structurally.

## Expected Behavior

### Preservation Requirements

**Unchanged behaviors (must survive both fixes):**

- ADVANCED tier SSE streaming (`content-type: text/event-stream`) in
  `chatbot-provider.tsx` must continue to accumulate `json.content` deltas and
  terminate on `data: [DONE]`.
- All genuine error paths (network failure, thrown exception) in
  `chatbot-provider.tsx` must continue to display `t(locale, "chatbot.error")`.
- Every SSE event type in `agent/route.ts` — `meta`, `tool_call`, `tool-result`,
  `error`, `done` — must continue to be emitted with identical shape.
- Per-step audit logs (`site_team_agent_tool_step`) and the final conversation
  persistence (`saveAgentConversationTurn`, `incrementAgentTokenUsage`,
  `logAuditEvent`) must fire exactly as before for non-buggy inputs.
- `callProviderStream` in `providers.ts` must not be modified; the fix lives
  entirely in `agent/route.ts` and `chatbot-provider.tsx`.
- All other surfaces on the shared AI pipeline (`/api/ai/manager`,
  `/api/chat/stream`, `/api/ai/team/*`, cron AI jobs) must be unaffected.
- The `isAIEnabled()` kill switch, rate limiters, circuit breaker, and
  output-validation (`validateAIOutput`) must all continue to function
  identically for inputs that are not in C.

**Scope:** Every input that does NOT match `isBugCondition_1`, `isBugCondition_1b`,
or `isBugCondition_2` must produce exactly the same observable result after the
fix as it did before.

## Hypothesized Root Cause

### Bug 1 — Envelope mismatch

1. **Off-by-one envelope read**: `apiSuccess({ message, disclaimer })` produces
   `{ ok: true, data: { message, disclaimer } }`.  A client that reads `data.message`
   instead of `data.data.message` sees `undefined`.  This is the confirmed root cause;
   the server shape has not changed since `apiSuccess` was introduced.

2. **No type-safe contract between server and client**: The route returns
   `NextResponse<ApiSuccessBody<{ message: … }>>` which TypeScript tracks, but
   `chatbot-provider.tsx` calls `response.json()` returning `unknown` / `any`,
   losing the type information.  The mismatch was invisible to the compiler.

3. **Secondary — missing lineBuffer in client SSE branch**: The server-side
   ADVANCED-tier streaming in `chat/route.ts` already uses a correct `lineBuffer`
   accumulator pattern (added in a prior audit).  The client SSE reader in
   `chatbot-provider.tsx` does not mirror this, leaving it vulnerable to split lines.

### Bug 2 — Empty fullContent after tool loop

1. **Provider does not emit a text step after tool use**: Workers AI (Llama
   via the OpenAI-compatible endpoint) may not reliably produce a synthesising
   text step after executing tool calls, leaving `fullContent = ""`.

2. **validateAIOutput("") returns null**: The output validator treats an empty
   string as a rejected response, triggering the `AI_OUTPUT_REJECTED` error path
   even though the pipeline succeeded structurally and merely has no text to show.

3. **No fallback text generation after empty tool loop**: The agent route does
   not detect the empty-content case and re-request a plain text summary from the
   provider after tool steps complete.

4. **Misleading error surfaced to user**: Because the route emits `error` instead
   of a fallback text, the user sees "La réponse IA a été rejetée par le
   validateur de sécurité" rather than an answer or a polite "I could not find
   the data" message.

## Correctness Properties

Property 1: Bug Condition — Envelope content is surfaced to the user

_For any_ HTTP response from `/api/chat` where `isBugCondition_1` holds (i.e.
`content-type: application/json` and body is `{ ok: true, data: { message: { content } } }`),
the fixed `chatbot-provider` SHALL extract `data.data.message.content` and render
it as the assistant message, and SHALL NOT display the hardcoded fallback string
"Sorry, I could not process your request."

**Validates: Requirements 2.1, 2.2, 2.3**

---

Property 2: Bug Condition — No token loss across SSE read boundaries

_For any_ SSE response stream from `/api/chat` (ADVANCED tier) where
`isBugCondition_1b` holds (i.e. at least one `data:` line spans two consecutive
network reads), the fixed `chatbot-provider` SHALL accumulate the same total
content as if every line were delivered in a single read — no `json.content`
delta may be silently dropped or corrupted.

**Validates: Requirements 2.4**

---

Property 3: Bug Condition — Agent never leaves user on a permanent spinner

_For any_ POST to `/api/ai/agent` where `isBugCondition_2` holds (i.e. the
multi-step tool loop completes with zero `text-delta` chunks emitted), the fixed
`agent/route` SHALL emit either:

- a `text` SSE event carrying a non-empty fallback content string synthesised
  from the tool results, **OR**
- an `error` SSE event with a meaningful, user-visible message,

followed by a `done` event — ensuring `AgentWidget` exits the loading state and
the `Chat` component never displays the "Réflexion…" spinner indefinitely.

**Validates: Requirements 2.5, 2.6**

---

Property 4: Preservation — Existing SSE streaming (ADVANCED tier) is unaffected

_For any_ SSE response stream from `/api/chat` where `isBugCondition_1b` does
NOT hold (i.e. all `data:` lines are fully contained within a single read), the
fixed `chatbot-provider` SHALL produce the same accumulated content and state
transitions as the original code.

**Validates: Requirements 3.1, 3.2, 3.3**

---

Property 5: Preservation — Non-empty agent text paths are unaffected

_For any_ POST to `/api/ai/agent` where `isBugCondition_2` does NOT hold (i.e.
the provider emits at least one `text-delta` chunk), the fixed `agent/route`
SHALL produce identical `text`, `tool_call`, `tool-result`, `meta`, and `done`
SSE events, identical conversation persistence, identical audit logs, and
identical token usage tracking as the original code.

**Validates: Requirements 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Bug 1a — Correct the envelope read path

**File:** `src/components/chatbot/chatbot-provider.tsx`

**Function:** `sendMessage` — the `else` branch (JSON response, line ~130 in current file)

**Specific changes:**

1. **Read from `data.data.message.content` instead of `data.message?.content`.**

   ```typescript
   // BEFORE (broken):
   content: data.message?.content || "Sorry, I could not process your request.",

   // AFTER (fixed):
   content: (data as { ok: boolean; data?: { message?: { content?: string } } })
              .data?.message?.content
            || t(locale, "chatbot.error"),
   ```

   Prefer `t(locale, "chatbot.error")` for the fallback so the error string is
   localised and consistent with the genuine-error path.  The hardcoded English
   string is removed entirely.

2. **Add a typed interface for the JSON response** (inline or via import from a
   shared types file) so TypeScript catches future envelope drift at compile time:

   ```typescript
   interface ChatJsonResponse {
     ok: boolean;
     data?: {
       message?: { role: string; content: string };
       disclaimer?: string;
       language?: string;
     };
   }
   const data = (await response.json()) as ChatJsonResponse;
   ```

### Bug 1b — Add SSE line buffering to the client reader

**File:** `src/components/chatbot/chatbot-provider.tsx`

**Function:** `sendMessage` — the `if (contentType.includes("text/event-stream"))` branch

**Specific changes:**

1. **Add a `lineBuffer` accumulator** before the `while(true)` loop, mirroring
   the pattern already present in the server-side ADVANCED tier path in
   `src/app/api/chat/route.ts`:

   ```typescript
   let lineBuffer = "";

   while (true) {
     const { done, value } = await reader.read();
     if (done) break;

     lineBuffer += decoder.decode(value, { stream: true });
     const lines = lineBuffer.split("\n");
     lineBuffer = lines.pop() ?? ""; // hold the (possibly partial) last segment

     for (const line of lines) {
       if (line === "data: [DONE]") continue;
       if (line.startsWith("data: ")) {
         try {
           const json = JSON.parse(line.slice(6));
           // … existing accumulation logic …
         } catch (parseErr) { … }
       }
     }
   }
   ```

2. **Remove the `.filter((line) => line.trim() !== "")` call** that currently
   discards blank lines before the loop, replacing it with the `lineBuffer` pattern
   above.  Blank lines act as SSE event delimiters; discarding them prematurely is
   safe here because the client only uses `data:` lines, but the `lineBuffer` pattern
   supersedes the filter.

### Bug 2 — Emit a fallback text when fullContent is empty after the tool loop

**File:** `src/app/api/ai/agent/route.ts`

**Location:** Between the `for await (const chunk of fullStream)` loop and the
existing `validateAIOutput(fullContent)` call (the "Output validation" comment block).

**Specific changes:**

1. **Detect empty fullContent after the stream loop:**

   ```typescript
   // After the fullStream for-await loop:
   if (!fullContent.trim()) {
     // The tool loop ran but produced no text step.
     // Synthesise a fallback by calling the provider once more in non-streaming
     // mode, asking it to summarise the tool results already in the conversation.
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
       // Use a localised generic fallback so validateAIOutput has something to work with.
       fullContent =
         "J'ai exécuté les outils demandés. Je n'ai pas pu générer un résumé textuel. Veuillez réessayer.";
     }
   }
   ```

2. **Import `callProvider` at the top of `agent/route.ts`** (it is already exported
   from `src/lib/ai/providers.ts` alongside `callProviderStream`):

   ```typescript
   import { callProviderStream, callProvider } from "@/lib/ai/providers";
   ```

3. **No change to `validateAIOutput`**, the output-rejection error path, the
   `depseudonymise` call, conversation persistence, usage tracking, or audit logging —
   all of those run on the (now non-empty) `fullContent` as before.

4. **No change to `callProviderStream` or `providers.ts`** — the fix stays entirely
   inside `agent/route.ts`.

## Testing Strategy

### Validation Approach

The strategy is two-phase: first run tests on **unfixed** code to surface
counterexamples that confirm the root cause; then verify the fix and run
preservation checks.  Property-based tests are used where inputs have a large
domain (envelope shapes, SSE chunk splits, stream sequences); example-based
unit tests cover concrete integration paths.

Tests live under `src/app/api/__tests__/` and `src/components/__tests__/` per
the project's Vitest conventions.  Shared mocks (`createMockRequest`,
`createJsonRequest`, `mockLogger`) are imported from
`src/components/__tests__/test-utils.ts`.

---

### Exploratory Bug Condition Checking

**Goal:** Surface concrete counterexamples that demonstrate each bug on unfixed
code to confirm the hypothesised root causes.

**Test plan — Bug 1a (envelope mismatch):**

Write a test that:
1. Mocks `fetch` to return a `Response` with `content-type: application/json`
   and body `JSON.stringify({ ok: true, data: { message: { role: "assistant", content: "Bonjour" } } })`.
2. Calls the real `sendMessage` via the `ChatbotProvider`.
3. Asserts that the rendered assistant message content is `"Bonjour"`.

Run on unfixed code → **expected to fail**: rendered content is `undefined`,
fallback "Sorry, I could not process your request." is shown instead.

**Test plan — Bug 1b (SSE line buffering):**

Write a test that:
1. Produces an SSE response as two reads:
   - Read 1: `data: {"content":"Bon`  (partial line)
   - Read 2: `jour"}\n\ndata: [DONE]\n\n`
2. Feeds these through the client SSE branch.
3. Asserts accumulated content equals `"Bonjour"`.

Run on unfixed code → **expected to fail**: the partial line is discarded by
`JSON.parse`, accumulated content is `""`.

**Test plan — Bug 2 (empty fullContent):**

Write a test that:
1. Stubs `callProviderStream` to return a `fullStream` that emits only
   `{ type: "tool-call", toolName: "getClinicStats" }` and
   `{ type: "tool-result", toolName: "getClinicStats", output: { ok: true } }`
   with no `text-delta` chunks.
2. POSTs to the real `handlePost` handler with `agentType: "super_admin"`.
3. Collects all SSE events from the response stream.
4. Asserts that a `text` event with non-empty content is present (not an `error`
   event with `AI_OUTPUT_REJECTED`).

Run on unfixed code → **expected to fail**: only `error` + `done` are emitted;
`fullContent` remains `""`.

**Expected counterexamples (summary):**
- Bug 1a: `rendered === undefined`, fallback shown.
- Bug 1b: Final accumulated string is `""` or missing tokens.
- Bug 2: SSE stream contains `{ type: "error", code: "AI_OUTPUT_REJECTED" }`.

---

### Fix Checking

**Goal:** Verify that for all inputs where the bug condition holds, the fixed
code produces the expected behaviour.

```
FOR ALL X WHERE isBugCondition_1(X) DO
  rendered := chatbotProvider'(X)
  ASSERT rendered = X.body.data.message.content
     AND rendered ≠ "Sorry, I could not process your request."
END FOR

FOR ALL stream WHERE isBugCondition_1b(stream) DO
  accumulated := chatbotProvider'(stream)
  ASSERT accumulated = concatOfAllContentDeltas(stream)
END FOR

FOR ALL X WHERE isBugCondition_2(X) DO
  events := agentRoute'(X)
  ASSERT (EXISTS e IN events: e.type = "text" AND e.content ≠ "")
      OR (EXISTS e IN events: e.type = "error")
  ASSERT "done" IN events
END FOR
```

---

### Preservation Checking

**Goal:** Verify that for all inputs where no bug condition holds, the fixed
code produces the same result as the original.

```
FOR ALL X WHERE NOT isBugCondition_1(X)
                AND NOT isBugCondition_1b(X)
                AND NOT isBugCondition_2(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

Property-based tests are used for preservation because they generate many
input variants automatically, catching edge cases that manual unit tests miss.

**Test plan:**

1. **ADVANCED tier SSE preservation** (Property 4): Generate random sequences
   of complete (non-split) `data: {"content":"…"}` lines followed by
   `data: [DONE]`.  Assert that the fixed client accumulates content identically
   to the original.
2. **Non-empty agent text path preservation** (Property 5): Stub `callProviderStream`
   to emit a mix of `tool-call`, `tool-result`, and ≥1 `text-delta` chunks.
   Assert that all SSE events, conversation persistence calls, and audit log
   calls are identical before and after the fix.
3. **Genuine error path preservation**: Stub `fetch` to reject with a network
   error in `chatbot-provider.tsx`.  Assert `t(locale, "chatbot.error")` is
   still shown.

---

### Unit Tests

- `chatbot-provider.tsx` JSON branch: BASIC-tier success path — mock `fetch`
  returning `apiSuccess` envelope, assert the real content is rendered.
- `chatbot-provider.tsx` JSON branch: SMART-tier success path — same as above
  with Workers AI `[AI-Generated]`-prefixed content.
- `chatbot-provider.tsx` JSON branch: auth-fallback path — `apiSuccess` with
  basic keyword-match content, assert rendered correctly.
- `chatbot-provider.tsx` SSE branch with split line — assert no token loss.
- `chatbot-provider.tsx` SSE branch with complete lines — assert unchanged.
- `agent/route.ts` empty-fullContent path: stub `callProviderStream` with
  zero text-delta, stub `callProvider` fallback, assert `text` SSE event emitted.
- `agent/route.ts` empty-fullContent path where fallback `callProvider` also
  fails: assert hardcoded French fallback string in `text` event.
- `agent/route.ts` normal text-delta path: assert behavior unchanged (Property 5).

### Property-Based Tests

- **Envelope content preservation (Property 1)**: Generate arbitrary string
  values for `message.content` in the `apiSuccess` envelope; assert the fixed
  client always renders that exact string.
- **SSE no-loss across splits (Property 2)**: Generate a random SSE payload
  (1–20 `data:` lines, each with a random alphanumeric `content` value) and
  random split positions; assert fixed client accumulation equals `join("")` of
  all content values.
- **Agent fallback non-empty (Property 3)**: Generate arbitrary tool-call /
  tool-result sequences with zero text-delta chunks; assert every run produces
  a non-empty `text` or `error` SSE event.
- **ADVANCED SSE preservation (Property 4)**: Generate random complete-line
  SSE sequences; assert fixed and original client produce the same accumulated
  content.
- **Agent text-delta preservation (Property 5)**: Generate random mixtures of
  tool events and ≥1 text-delta chunks; assert SSE output is identical before
  and after the fix.

### Integration Tests

- Full BASIC-tier chatbot flow: render `ChatbotProvider` in a test tree, mock
  the `/api/chat` endpoint, send a message, assert the real reply appears in
  the message list.
- Full SMART-tier chatbot flow: same as above with Workers AI JSON response.
- Full ADVANCED-tier chatbot flow: same with chunked SSE response including
  a split `data:` line.
- Full super_admin agent flow (tool loop, no text): render `AgentWidget` with
  `agentType="super_admin"`, mock `/api/ai/agent` SSE to emit only tool events,
  assert a fallback text message appears and spinner is not visible.
- Full super_admin agent flow (normal text): render `AgentWidget`, mock SSE
  with text-delta chunks, assert streamed answer appears and all events fire.
