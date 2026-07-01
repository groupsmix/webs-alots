# webs-alots-ai

Second Cloudflare Worker for the Oltigo Health platform. Handles the
CopilotKit AI route, which pulls in heavy server-side dependencies.

## Why a separate Worker?

The main `webs-alots` Worker (built with OpenNext from the Next.js app at
the repo root) sits at ~9 MiB of irreducible Next.js + Supabase + app code.
Adding the AI runtime to it pushed the bundle to **11.08 MiB compressed**,
breaching Cloudflare's **10 MiB Workers Paid script size limit**.

The AI runtime is:

- `@copilotkit/runtime` — server-side CopilotKit chat orchestration
- `openai` — OpenAI-compatible client (used by the OpenAI adapter)
- `@anthropic-ai/sdk` — Claude client (used by the Anthropic adapter)

These cannot be lazy-loaded from inside a route handler in the main app
because the route handler **is** the server entry. They have to live on the
server. (Within this Worker they ARE deferred to first-request time — see the
header comment in `src/handlers/copilotkit.ts` for why.)

Splitting them into a separate Worker:

- Keeps the main Worker comfortably under 10 MiB
- Keeps the AI Worker small (~1.5 MiB compressed) since it has no Next.js
  runtime overhead — it is a plain `fetch` handler
- Is transparent to the browser: Cloudflare zone routing sends
  `oltigo.com/api/copilotkit/*` to `webs-alots-ai` before the request ever
  reaches the main Worker.

## Routing

| URL pattern                      | Worker          |
| -------------------------------- | --------------- |
| `oltigo.com/api/copilotkit`      | `webs-alots-ai` |
| `oltigo.com/api/copilotkit/*`    | `webs-alots-ai` |
| `oltigo.com/*` (everything else) | `webs-alots`    |
| `*.oltigo.com/*` (subdomains)    | `webs-alots`    |

Cloudflare picks the most specific Worker Route. The AI Worker's two patterns
are strictly more specific than the main Worker's catch-all.

## Status

This endpoint is currently **dormant**: the in-app CopilotKit sidebar was
retired (see `src/app/(super-admin)/layout.tsx`), so nothing in the product
calls `/api/copilotkit` today. The Worker still deploys and works; to bring it
back online you need an AI provider key set (below) and the Cloudflare Worker
Routes wired up.

## Auth

Identical to the main app: the browser sends Supabase `sb-<project>-auth-token`
cookies on every request. The AI Worker parses the `Cookie` header,
hands the cookies to `@supabase/ssr`'s `createServerClient`, and calls
`supabase.auth.getUser()` to validate. Then it checks `role = super_admin`
(keyed on `users.auth_id`) before proceeding.

Source: `src/lib/supabase.ts`.

## Secrets

The Worker needs Supabase auth values plus **at least one** AI provider
config. Set these before first deploy (per environment):

```sh
cd workers/ai
# Auth (required) — public values, set on the Worker rather than committed.
wrangler secret put NEXT_PUBLIC_SUPABASE_URL
wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY

# AI provider — set ONE of the following:
#   (a) Any OpenAI-compatible endpoint:
wrangler secret put OPENAI_API_KEY
wrangler secret put OPENAI_BASE_URL   # optional: e.g. a non-OpenAI host
wrangler secret put OPENAI_MODEL      # optional: model id
#   (b) Or Anthropic:
wrangler secret put ANTHROPIC_API_KEY
```

If `OPENAI_API_KEY` is set it takes precedence; otherwise `ANTHROPIC_API_KEY`
is used. If neither is set the endpoint returns a 500 explaining the missing
config. Helper script: `scripts/setup-ai-worker-secrets.sh`.

Staging / production are separate Workers (`webs-alots-ai-staging` and
`webs-alots-ai`) — each needs its own secret set.

## Deploy

CI deploys both Workers from the same `Deploy` workflow:

1. `npm run build:cf && wrangler deploy` (main Worker)
2. `cd workers/ai && npm ci && wrangler deploy --env <staging|production>` (AI Worker)

Manual deploy:

```sh
cd workers/ai
npm ci
npm run deploy:staging   # or :production
```

## Local dev

```sh
cd workers/ai
npm ci
npm run dev              # wrangler dev on a local port
```

The main Next.js app's `next dev` mounts `/api/copilotkit` as a Next route for
browser-local development — see the stub in `src/app/api/copilotkit/route.ts`
(it returns 501 locally, since in production Cloudflare routes the URL to this
Worker). For full local AI dev, run `wrangler dev` here in parallel and proxy
through it.
