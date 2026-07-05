# `workers/` — Full Audit Report

> Generated: 2026-07-02 | Scope: `workers/ai/**` (all 7 source files + config)

---

## Scope

| File                                                                                      | Size      |
| ----------------------------------------------------------------------------------------- | --------- |
| [src/index.ts](file:///c:/webs-alots/workers/ai/src/index.ts)                             | 56 lines  |
| [src/handlers/copilotkit.ts](file:///c:/webs-alots/workers/ai/src/handlers/copilotkit.ts) | 116 lines |
| [src/lib/cors.ts](file:///c:/webs-alots/workers/ai/src/lib/cors.ts)                       | 73 lines  |
| [src/lib/rate-limit.ts](file:///c:/webs-alots/workers/ai/src/lib/rate-limit.ts)           | 54 lines  |
| [src/lib/supabase.ts](file:///c:/webs-alots/workers/ai/src/lib/supabase.ts)               | 172 lines |
| [wrangler.toml](file:///c:/webs-alots/workers/ai/wrangler.toml)                           | 119 lines |
| [package.json](file:///c:/webs-alots/workers/ai/package.json)                             | 31 lines  |
| [tsconfig.json](file:///c:/webs-alots/workers/ai/tsconfig.json)                           | 22 lines  |

---

## 🔴 Critical

### C-1 — AnthropicAdapter instantiated without API key → runtime crash on Anthropic path

**File:** [src/handlers/copilotkit.ts:61](file:///c:/webs-alots/workers/ai/src/handlers/copilotkit.ts#L61)

**What's wrong:**

```ts
serviceAdapter = new runtimeModule.AnthropicAdapter();
```

`ANTHROPIC_API_KEY` is validated at the top of `handleCopilotKit` (line 70) to confirm _at least one_ key exists, but it is **never passed to `AnthropicAdapter()`**. The @copilotkit/runtime `AnthropicAdapter` reads the key from the environment via `process.env.ANTHROPIC_API_KEY` — which **does not exist** in Cloudflare Workers. Cloudflare env vars arrive through the `env` binding object, not `process.env`. Result: every Anthropic-path request will silently send `undefined` as the API key and fail with an HTTP 401 from Anthropic's API.

**Why it's a problem:** The OpenAI path works fine; the Anthropic fallback is completely broken at runtime. No TypeScript error because `AnthropicAdapter()` accepts zero arguments.

**Suggested fix:**

```ts
serviceAdapter = new runtimeModule.AnthropicAdapter({
  anthropic: new (await import("@anthropic-ai/sdk")).default({
    apiKey: env.ANTHROPIC_API_KEY!,
  }),
});
```

Or, if `AnthropicAdapter` does not accept a client instance, set `process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY` before constructing the adapter (a shim widely used in Worker runtimes when porting Node libs). Verify the exact constructor signature against @copilotkit/runtime@1.59.5 docs/source.

---

### C-2 — Module-level cache (`cachedServiceAdapter`) ignores env changes between deployments

**File:** [src/handlers/copilotkit.ts:32-65](file:///c:/webs-alots/workers/ai/src/handlers/copilotkit.ts#L32-L65)

**What's wrong:**

```ts
let cachedRuntimeModule: RuntimeModule | null = null;
let cachedServiceAdapter: CopilotServiceAdapter | null = null;
```

Both module-level cache vars are populated on first request and reused for the isolate's lifetime. If `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is rotated (new secret put via wrangler) but the Worker isolate is NOT restarted, the stale key is served until Cloudflare recycles the isolate. More critically: if `OPENAI_API_KEY` is added after an Anthropic-only deploy, the isolate will keep using the Anthropic adapter (with the wrong-key bug above) until recycled.

**Why it's a problem:** Key rotation doesn't take effect immediately — a security/operational risk for a secret-bearing service.

**Suggested fix:** Either accept the limitation and document it explicitly (Cloudflare isolate restarts on new deploys, so this only matters for in-place secret rotation without redeploy), OR include a lightweight env-fingerprint in the cache check:

```ts
const envKey = `${env.OPENAI_API_KEY ?? ""}|${env.ANTHROPIC_API_KEY ?? ""}`;
// Store cachedEnvKey alongside cachedServiceAdapter, invalidate on mismatch.
```

---

## 🟠 High

### H-1 — `userEmail` destructured but never used — noUnusedLocals would flag this

**File:** [src/handlers/copilotkit.ts:82](file:///c:/webs-alots/workers/ai/src/handlers/copilotkit.ts#L82)

**What's wrong:**

```ts
const { userId } = authResult;
```

`requireSuperAdmin` also returns `userEmail` (declared in the return type at supabase.ts:105). It is destructured nowhere in the handler. While this doesn't break anything, `tsconfig.json` has `"noUnusedLocals": true` — if someone later destructures `userEmail` and forgets to use it, TS will error. More importantly the field exists in the type but serves no purpose downstream, indicating either planned-but-not-implemented audit logging or dead API surface.

**Suggested fix:** Either remove `userEmail` from the return type and the `return` statement in `requireSuperAdmin` if it's truly unneeded, or wire it into an audit log call:

```ts
// If you want audit logging:
const { userId, userEmail } = authResult;
console.log(`[webs-alots-ai] copilotkit request by ${userEmail} (${userId})`);
```

---

### H-2 — `OPTIONS` preflight bypasses CORS origin check — any origin gets a 204

**File:** [src/index.ts:33-35](file:///c:/webs-alots/workers/ai/src/index.ts#L33-L35)

**What's wrong:**

```ts
if (request.method === "OPTIONS") {
  return new Response(null, { status: 204 });
}
```

The bare `204` response has **no CORS headers**. `withCors()` is called on the return value (line 49 wraps all responses), so CORS headers ARE added — but only if the origin passes `resolveAllowedOrigin()`. However the comment in index.ts says "CORS is applied centrally by the fetch() wrapper below, so route handlers never have to think about it." This part is fine.

The real issue is subtler: the 204 body returns immediately from `route()`, then is wrapped by `withCors()`. For allowed origins this works. But for **disallowed origins**, the preflight returns `204` with _no_ CORS headers. Browsers will correctly block the follow-up POST. However some non-browser clients (curl, Postman, server-side fetch) don't honor CORS and will successfully reach the POST handler regardless — meaning this CORS check is purely browser-side enforcement and provides no server-side protection.

For the actual POST, `requireSuperAdmin` provides real auth, so the CORS bypass from non-browsers is mitigated. But worth being explicit: this endpoint has no CSRF token check beyond the CORS allowlist + Supabase cookie auth.

**Suggested fix:** Document explicitly that CORS is browser-enforcement only and that Supabase JWT validation is the actual security boundary. Consider adding an explicit `Origin` check on POST requests too if SSRF or confused-deputy attacks are a concern.

---

### H-3 — `copilotRuntimeNextJSAppRouterEndpoint` is a Next.js-specific adapter used in a plain CF Worker

**File:** [src/handlers/copilotkit.ts:94,105](file:///c:/webs-alots/workers/ai/src/handlers/copilotkit.ts#L94-L109)

**What's wrong:**

```ts
const { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } = runtimeModule;
const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({ ... });
return handleRequest(request as unknown as Parameters<typeof handleRequest>[0]);
```

The code uses the **NextJS App Router**-specific endpoint adapter and casts a plain `Request` to `NextRequest` via `as unknown as`. The comment on line 111-113 acknowledges this. The risk: if `@copilotkit/runtime` updates its `handleRequest` signature to rely on `NextRequest`-specific properties (e.g. `nextUrl`, `cookies()` from `next/headers`), the cast will silently fail at runtime with no TypeScript warning because of the `as unknown as` escape hatch.

**Why it's a problem:** This is a fragile cross-version coupling. `@copilotkit/runtime` should expose a framework-agnostic `handleRequest` or a dedicated CF Workers adapter.

**Suggested fix:** Pin the dependency tightly (already at `^1.59.5` but `^` allows minor bumps). On each `@copilotkit/runtime` upgrade, verify the handler still works with a plain `Request`. Longer term, switch to the framework-agnostic endpoint if/when CopilotKit ships one.

---

## 🟡 Medium

### M-1 — Rate limiter bucket prune condition is off-by-one / may not prune active users

**File:** [src/lib/rate-limit.ts:46-49](file:///c:/webs-alots/workers/ai/src/lib/rate-limit.ts#L46-L49)

**What's wrong:**

```ts
if (buckets.size > 1024) {
  for (const [k, v] of buckets) {
    if (v.length === 0 || v[v.length - 1] <= cutoff) buckets.delete(k);
  }
}
```

The prune checks `v[v.length - 1] <= cutoff` — i.e., the _most recent_ hit for the key is older than the cutoff. This correctly identifies keys with no recent activity. However the prune only runs when `buckets.size > 1024`. If there are exactly 1024 active users, the map is never pruned. In a super_admin-only endpoint with presumably <10 users this is theoretical, but the prune threshold could be lowered (e.g., 256) for safety.

**Suggested fix:** Minor — lower threshold or prune on every N-th request regardless:

```ts
if (buckets.size > 256) { ... }
```

---

### M-2 — `wrangler.toml` default environment routes duplicate `[env.production]` routes exactly

**File:** [wrangler.toml:69-72 and 108-111](file:///c:/webs-alots/workers/ai/wrangler.toml#L69-L72)

**What's wrong:**

```toml
# Top-level (default env):
routes = [
  { pattern = "oltigo.com/api/copilotkit", zone_name = "oltigo.com" },
  { pattern = "oltigo.com/api/copilotkit/*", zone_name = "oltigo.com" },
]
# [env.production]:
routes = [
  { pattern = "oltigo.com/api/copilotkit", zone_name = "oltigo.com" },
  { pattern = "oltigo.com/api/copilotkit/*", zone_name = "oltigo.com" },
]
```

Running `wrangler deploy` (no `--env`) deploys the default environment with the same production routes as `--env production`. If a developer accidentally runs the bare `npm run deploy` script (which maps to `wrangler deploy` with no env), it will register the same production routes under a potentially different Worker name, creating a routing conflict.

**Suggested fix:** Remove the production routes from the default (top-level) environment, or guard the `deploy` script to always require an explicit `--env` flag:

```json
"deploy": "echo 'Use deploy:staging or deploy:production' && exit 1"
```

---

### M-3 — `tsconfig.json` has `noUnusedParameters: false` while `noUnusedLocals: true`

**File:** [tsconfig.json:9-10](file:///c:/webs-alots/workers/ai/tsconfig.json#L9-L10)

**What's wrong:**

```json
"noUnusedLocals": true,
"noUnusedParameters": false,
```

Unused parameters are silently allowed. The `_ctx` parameter in `index.ts:46` is prefixed with `_` (correct convention), but this asymmetry means any accidentally unused function argument won't be caught. The `_` prefix convention only works as a lint signal if humans remember to use it; the TS compiler won't enforce it.

**Suggested fix:** Enable `noUnusedParameters: true` and ensure all intentionally-unused params use the `_` prefix (they already do in this codebase: `_ctx`). This closes the gap.

---

### M-4 — `wrangler.toml` `head_sampling_rate = 1.0` for observability in all environments

**File:** [wrangler.toml:84,103,118](file:///c:/webs-alots/workers/ai/wrangler.toml#L84)

**What's wrong:**

```toml
[observability]
enabled = true
head_sampling_rate = 1.0
```

`head_sampling_rate = 1.0` means 100% of requests are traced. For a low-traffic super_admin-only endpoint this is fine operationally, but every AI generation request (which can run for several seconds with large payloads) will be fully traced and billed against Cloudflare's observability quotas.

**Suggested fix:** Lower to `0.1` (10%) for staging, keep `1.0` for production only if debugging is active. Or document this is intentional.

---

### M-5 — `console.error` used directly instead of structured logger

**File:** [src/lib/supabase.ts:149](file:///c:/webs-alots/workers/ai/src/lib/supabase.ts#L149), [src/index.ts:51](file:///c:/webs-alots/workers/ai/src/index.ts#L51)

**What's wrong:**

```ts
console.error("[webs-alots-ai] role lookup failed", profileError);
console.error("[webs-alots-ai] unhandled error", err);
```

The main app uses `@/lib/logger` for structured logging (enforced in AGENTS.md). The AI Worker uses raw `console.error`. Cloudflare Workers does capture `console.*` output in its observability dashboard, but structured JSON logging with consistent fields (level, message, requestId, userId) makes log querying and alerting far more reliable.

**Suggested fix:** Add a minimal structured logger to `src/lib/logger.ts`:

```ts
export const logger = {
  error: (msg: string, data?: unknown) =>
    console.error(
      JSON.stringify({
        level: "error",
        msg,
        ...(data && typeof data === "object" ? data : { data }),
      }),
    ),
};
```

---

## 🔵 Low

### L-1 — `@supabase/ssr ^0.10.2` is very old — potential breaking changes / security patches missed

**File:** [package.json:17](file:///c:/webs-alots/workers/ai/package.json#L17)

**What's wrong:**
`@supabase/ssr` is currently at v0.10.2. The package has had several security-related patches in the v0.5–v0.6 range and API changes in v0.7+. The latest stable as of mid-2026 is v0.6.x. The `^0.10.2` range is forward-compatible with patches but the minor version may already be ahead of what's available — verify this is the correct version used in the main app and that the `getAll/setAll` cookie API is still the correct interface for this version.

**Suggested fix:** Run `npm outdated` inside `workers/ai/` and align `@supabase/ssr` with the root project's pinned version.

---

### L-2 — `scripts/setup-ai-worker-secrets.sh` is referenced in README but the docs reference `GROQ_API_KEY` which is not in the Worker's `Env` interface

**File:** [docs/ENVIRONMENTS.md:88](file:///c:/webs-alots/docs/ENVIRONMENTS.md#L88)

**What's wrong:**

```
bash scripts/setup-ai-worker-secrets.sh staging      # GROQ_API_KEY + Supabase + optional providers
```

The comment mentions `GROQ_API_KEY` but neither the `Env` interface nor the setup script itself handles a `GROQ_API_KEY`. This is a stale comment from when the AI Builder (removed) was still part of the Worker.

**Suggested fix:** Update the docs/ENVIRONMENTS.md comment to remove the GROQ reference:

```
bash scripts/setup-ai-worker-secrets.sh staging      # Supabase + OPENAI_API_KEY or ANTHROPIC_API_KEY
```

---

### L-3 — README references a dormant endpoint without a clear re-activation checklist

**File:** [README.md:47-51](file:///c:/webs-alots/workers/ai/README.md#L47-L51)

**What's wrong:**

```
This endpoint is currently **dormant**: the in-app CopilotKit sidebar was retired...
```

The Worker still deploys and registers its Cloudflare routes. A dormant Worker that still answers requests (returning 500 if no AI key is set, or working if keys are set) is an unmaintained surface that can be accidentally re-activated or exploited.

**Suggested fix:** Either:

1. Add an explicit `COPILOTKIT_ENABLED` env flag checked before auth, returning `404` when unset (so the endpoint is truly dark), or
2. Remove the Worker entirely from the deploy pipeline until the feature is re-activated.

---

### L-4 — `legacy-peer-deps=true` in `.npmrc` suppresses peer dependency conflict visibility

**File:** [.npmrc:5](file:///c:/webs-alots/workers/ai/.npmrc#L5)

**What's wrong:**
`legacy-peer-deps=true` silently ignores peer dependency conflicts. The stated reason is `@copilotkit/runtime` declares `@anthropic-ai/sdk@^0.57` as peerOptional while the Worker pins `^0.101`. This is fine for now, but if a future `@copilotkit/runtime` release introduces a genuine incompatibility it won't surface during `npm install`.

**Suggested fix:** Document which specific conflict this resolves and add a comment to review on each `@copilotkit/runtime` upgrade. Consider switching to `overrides` (already present in package.json) to be more explicit rather than blanket-suppressing.

---

## Summary Table

| ID  | Severity    | File                         | Issue                                                                                     |
| --- | ----------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| C-1 | 🔴 Critical | copilotkit.ts:61             | AnthropicAdapter ignores `ANTHROPIC_API_KEY` env binding → 401 on every Anthropic request |
| C-2 | 🔴 Critical | copilotkit.ts:32-65          | Module cache survives secret rotation without redeploy                                    |
| H-1 | 🟠 High     | copilotkit.ts:82             | `userEmail` returned but never used — missing audit log                                   |
| H-2 | 🟠 High     | index.ts:33-35               | CORS is browser-only; no server-side Origin enforcement on POST                           |
| H-3 | 🟠 High     | copilotkit.ts:94,105         | `as unknown as` escape cast for NextJS adapter in plain Worker                            |
| M-1 | 🟡 Medium   | rate-limit.ts:46             | Bucket prune threshold too high (1024) for tiny user base                                 |
| M-2 | 🟡 Medium   | wrangler.toml:69-72          | Default env has production routes — accidental `wrangler deploy` clobbers production      |
| M-3 | 🟡 Medium   | tsconfig.json:10             | `noUnusedParameters: false` allows silent unused-parameter bugs                           |
| M-4 | 🟡 Medium   | wrangler.toml:84,103,118     | 100% trace sampling in all environments incurs full observability cost                    |
| M-5 | 🟡 Medium   | supabase.ts:149, index.ts:51 | Raw `console.error` instead of structured logger                                          |
| L-1 | 🔵 Low      | package.json:17              | `@supabase/ssr` version may be out of sync with root project                              |
| L-2 | 🔵 Low      | ENVIRONMENTS.md:88           | Stale `GROQ_API_KEY` reference in docs                                                    |
| L-3 | 🔵 Low      | README.md:47                 | Dormant Worker still registers live routes — no kill-switch                               |
| L-4 | 🔵 Low      | .npmrc:5                     | `legacy-peer-deps` blanket-suppresses dependency conflict visibility                      |

---

> **No hardcoded secrets found.** All API keys are correctly injected via Wrangler secrets / `env` binding — not committed to source.
>
> **No SQL injection risk.** The only DB interaction is Supabase's parameterized query builder (`.eq("auth_id", user.id)`) — no raw SQL.
>
> **No broken imports.** All `import` statements resolve to declared dependencies or relative paths that exist.
