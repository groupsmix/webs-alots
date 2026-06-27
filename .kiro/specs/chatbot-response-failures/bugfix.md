# Bugfix Requirements Document

## Introduction

Two AI chatbot surfaces in the Oltigo Health platform fail to deliver answers to users, even though the underlying AI pipeline produces valid responses.

**Bug 1 — Clinic public-site patient chatbot always replies "Sorry, I could not process your request."**
The clinic-facing chatbot widget never shows a real answer for the most common configurations. The server route `src/app/api/chat/route.ts` returns non-streaming replies through `apiSuccess(...)` (`src/lib/api-response.ts`), which wraps the payload as `{ ok: true, data: { message: { role, content }, ... } }`. The client `src/components/chatbot/chatbot-provider.tsx` reads the JSON reply as `data.message?.content`, which is one level too shallow (the real path is `data.data.message.content`). The value is always `undefined`, so the client falls back to the hardcoded `"Sorry, I could not process your request."` string. This breaks the BASIC tier (always JSON) and the SMART tier when Cloudflare Workers AI returns content (also JSON). Because chatbot intelligence defaults to `"smart"` and `"basic"` is the entry plan, most clinics see the broken behavior. The ADVANCED tier streams Server-Sent Events with raw `{content}` chunks (not wrapped by `apiSuccess`) and works. A secondary robustness concern in the same client: the SSE branch splits chunks on `"\n"` without buffering partial lines across reads, which can drop tokens.

**Bug 2 — Super-admin "Assistant Oltigo" stays stuck on the "Réflexion…" spinner with no answer.**
In the super-admin dashboard, the AI assistant remains in the "Réflexion…" loading placeholder (`src/components/ui/chat.tsx`, shown whenever an assistant message has empty content) and never produces text. `src/components/ai/AgentWidget.tsx` POSTs to `src/app/api/ai/agent/route.ts` and fills the assistant message only from SSE events of `type: "text"`. The route streams `(streamResult.raw as any).fullStream` and accumulates `text-delta` chunks into `fullContent`. Because `super_admin` has `enableDataTools: true` (`src/config/agent.config.ts`), the agent runs a multi-step tool loop (`stopWhen: stepCountIs(MAX_AGENT_STEPS)` in `src/lib/ai/providers.ts callProviderStream`). When the selected provider does not emit a final text step (e.g. Workers AI / Llama via the OpenAI-compatible endpoint does not reliably support tool calling, or the loop terminates on a tool step), `fullContent` stays empty, producing an empty assistant message and a permanent "Réflexion…" spinner. The runtime root cause (which provider is selected and whether tool-calls occur without a final text step) still needs confirmation, but the stuck-spinner behavior is confirmed.

Both chatbots share the same AI pipeline under `src/lib/ai/` (config resolution, provider routing, provider calls), gated by the `isAIEnabled()` kill switch, rate limiters, DB-backed provider configs, and a circuit breaker. Fixes must not regress that shared pipeline or the other surfaces built on it (`/api/ai/manager`, `/api/chat/stream`, `/api/ai/team/*`, cron AI jobs).

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — Clinic-site chatbot envelope mismatch**

1.1 WHEN the clinic chatbot is configured for the BASIC tier and the server returns `{ ok: true, data: { message: { role, content } } }` via `apiSuccess`, THEN the client reads `data.message?.content` (which is `undefined`) and displays the hardcoded fallback "Sorry, I could not process your request."

1.2 WHEN the clinic chatbot is configured for the SMART tier and Cloudflare Workers AI returns content as a JSON `apiSuccess` envelope, THEN the client reads `data.message?.content` (which is `undefined`) and displays the hardcoded fallback "Sorry, I could not process your request."

1.3 WHEN the server returns any non-streaming JSON `apiSuccess` reply (including the basic-fallback paths used when auth, budget, or AI calls fail), THEN the client displays the hardcoded fallback instead of the real `data.data.message.content` value.

1.4 WHEN a streaming (SSE) chatbot response delivers a `data:` line split across two network reads, THEN the client `split("\n")` parsing without cross-read buffering can drop or corrupt the partial token.

**Bug 2 — Super-admin agent stuck on "Réflexion…"**

1.5 WHEN a super_admin sends a message to the "Assistant Oltigo" agent and the multi-step tool loop completes without emitting any `text-delta` chunk, THEN `fullContent` remains empty, the assistant message content stays `""`, and the UI shows the "Réflexion…" spinner indefinitely.

1.6 WHEN the agent stream finishes with empty `fullContent`, THEN the stream emits a `done` event with no `text` event and no `error` event, so the client never replaces the empty placeholder and never surfaces a failure to the user.

### Expected Behavior (Correct)

**Bug 1 — Clinic-site chatbot envelope mismatch**

2.1 WHEN the clinic chatbot is configured for the BASIC tier and the server returns `{ ok: true, data: { message: { role, content } } }`, THEN the client SHALL read the content from the standardized envelope path (`data.data.message.content`) and display the real reply.

2.2 WHEN the clinic chatbot is configured for the SMART tier and Cloudflare Workers AI returns content as a JSON `apiSuccess` envelope, THEN the client SHALL read the content from the standardized envelope path and display the real AI reply.

2.3 WHEN the server returns any non-streaming JSON `apiSuccess` reply (including basic-fallback paths), THEN the client SHALL extract the message content from the standardized envelope and display it; only when content is genuinely absent SHALL it show a fallback message.

2.4 WHEN a streaming (SSE) chatbot response delivers a `data:` line split across two network reads, THEN the client SHALL buffer partial lines across reads and only parse complete lines, so no tokens are dropped or corrupted.

**Bug 2 — Super-admin agent stuck on "Réflexion…"**

2.5 WHEN a super_admin sends a message to the "Assistant Oltigo" agent and the multi-step tool loop completes without producing text, THEN the system SHALL ensure a final text answer is produced (or a clear error/fallback message is delivered) so the assistant message content is never left empty.

2.6 WHEN the agent stream finishes with no assistant text, THEN the system SHALL emit either a `text` event with a user-visible message or an `error` event, so the UI exits the "Réflexion…" state and informs the user instead of spinning indefinitely.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the clinic chatbot is configured for the ADVANCED tier and streams SSE `{content}` chunks, THEN the system SHALL CONTINUE TO render the streamed reply correctly.

3.2 WHEN the clinic chatbot SSE stream delivers complete `data:` lines, THEN the system SHALL CONTINUE TO parse `data: [DONE]` termination and accumulate `json.content` deltas as before.

3.3 WHEN the chatbot request genuinely fails (network error, thrown exception), THEN the client SHALL CONTINUE TO display the localized error message via `t(locale, "chatbot.error")`.

3.4 WHEN a non-super_admin agent (doctor, clinic_admin, secretary, receptionist, patient) uses the AgentWidget and the provider streams normal `text-delta` chunks, THEN the system SHALL CONTINUE TO render the streamed answer and persist the conversation as before.

3.5 WHEN the agent produces valid text output, THEN the system SHALL CONTINUE TO run output validation, depseudonymisation, usage tracking, conversation persistence, and audit logging exactly as before.

3.6 WHEN any surface on the shared AI pipeline is used (`/api/ai/manager`, `/api/chat/stream`, `/api/ai/team/*`, cron AI jobs), THEN the system SHALL CONTINUE TO resolve config, route providers, enforce the `isAIEnabled()` kill switch, apply rate limiters, and honor the circuit breaker unchanged.

3.7 WHEN the agent emits `tool_call` and `tool-result` SSE events during a multi-step run, THEN the system SHALL CONTINUE TO forward those events and per-step audit logs as before.

## Bug Condition Derivation

### Bug 1 — Clinic-site chatbot envelope mismatch

```pascal
FUNCTION isBugCondition_1(X)
  INPUT: X = non-streaming chatbot HTTP response (content-type: application/json)
  OUTPUT: boolean

  // The reply is the standardized success envelope, but the client
  // reads one level too shallow (data.message instead of data.data.message)
  RETURN X.contentType = "application/json"
     AND X.body MATCHES { ok: true, data: { message: { content } } }
END FUNCTION
```

```pascal
// Property: Fix Checking — envelope content is surfaced
FOR ALL X WHERE isBugCondition_1(X) DO
  rendered ← chatbotClient'(X)
  ASSERT rendered = X.body.data.message.content
     AND rendered ≠ "Sorry, I could not process your request."
END FOR
```

Secondary condition (SSE line buffering):

```pascal
FUNCTION isBugCondition_1b(stream)
  INPUT: stream = sequence of network reads of an SSE response
  OUTPUT: boolean

  // A single logical `data:` line is split across two reads
  RETURN EXISTS a "data:" line L such that L spans a read boundary
END FUNCTION
```

```pascal
// Property: Fix Checking — no token loss across read boundaries
FOR ALL stream WHERE isBugCondition_1b(stream) DO
  ASSERT accumulated(chatbotClient'(stream)) = concatOfAllContentDeltas(stream)
END FOR
```

### Bug 2 — Super-admin agent stuck on "Réflexion…"

```pascal
FUNCTION isBugCondition_2(X)
  INPUT: X = super_admin agent request that triggers a multi-step tool loop
  OUTPUT: boolean

  // The tool loop completes producing zero text-delta chunks,
  // leaving the accumulated assistant content empty
  RETURN X.agentType = "super_admin"
     AND X.enableDataTools = true
     AND emittedTextDeltaCount(agentRun(X)) = 0
END FUNCTION
```

```pascal
// Property: Fix Checking — never strand the user on the spinner
FOR ALL X WHERE isBugCondition_2(X) DO
  result ← agentRoute'(X)
  ASSERT (result emits a "text" event with non-empty content)
      OR (result emits an "error" event)
  ASSERT NOT uiRemainsInReflexionState(result)
END FOR
```

### Preservation (both bugs)

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_1(X)
                AND NOT isBugCondition_1b(X)
                AND NOT isBugCondition_2(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

Where `F` is the current (unfixed) code and `F'` is the fixed code. For all inputs that do not trigger either bug — working ADVANCED-tier streaming, genuine error paths, non-super_admin agents, and every other surface on the shared AI pipeline — behavior must be identical before and after the fix.
