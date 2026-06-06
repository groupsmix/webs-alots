# webs-alots-ai

Second Cloudflare Worker for the Oltigo Health platform. Handles the two
AI routes that pull in heavy server-side dependencies.

## Why a separate Worker?

The main `webs-alots` Worker (built with OpenNext from the Next.js app at
the repo root) sits at ~9 MiB of irreducible Next.js + Supabase + app code.
Adding the AI runtime to it pushed the bundle to **11.08 MiB compressed**,
breaching Cloudflare's **10 MiB Workers Paid script size limit**.

The AI runtime is:

- `@copilotkit/runtime` — server-side CopilotKit chat orchestration
- `@anthropic-ai/sdk` — Claude API client
- `@ai-sdk/anthropic` + `ai` — streaming text generation
- `@e2b/code-interpreter` — secure code sandbox

These cannot be lazy-loaded from inside a route handler because the route
handler **is** the server entry. They have to live on the server.

Splitting them into a separate Worker:

- Keeps the main Worker comfortably under 10 MiB
- Keeps the AI Worker small (~2.5 MiB compressed) since it has no Next.js
  runtime overhead — it is a plain `fetch` handler
- Is transparent to the browser: Cloudflare zone routing sends
  `oltigo.com/api/copilotkit/*` and `oltigo.com/api/builder/sandbox/*`
  to `webs-alots-ai` before they ever reach the main Worker.

## Routing

| URL pattern                        | Worker          |
| ---------------------------------- | --------------- |
| `oltigo.com/api/copilotkit/*`      | `webs-alots-ai` |
| `oltigo.com/api/builder/sandbox/*` | `webs-alots-ai` |
| `oltigo.com/*` (everything else)   | `webs-alots`    |
| `*.oltigo.com/*` (subdomains)      | `webs-alots`    |

Cloudflare picks the most specific Worker Route. The AI Worker's two
patterns are strictly more specific than the main Worker's catch-all.

## Auth

Identical to the main app: the browser sends Supabase `sb-<project>-auth-token`
cookies on every request. The AI Worker parses the `Cookie` header,
hands the cookies to `@supabase/ssr`'s `createServerClient`, and calls
`supabase.auth.getUser()` to validate. Then it checks `role = super_admin`
in the `users` table before proceeding.

Source: `src/lib/supabase.ts`.

## Secrets

Set these before first deploy:

```sh
cd workers/ai
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put E2B_API_KEY
wrangler secret put NEXT_PUBLIC_SUPABASE_URL
wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
```

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

The main Next.js app's `next dev` will still mount `/api/copilotkit` and
`/api/builder/sandbox` as Next routes for browser-local development — see
the stubs in `src/app/api/copilotkit/route.ts` and
`src/app/api/builder/sandbox/route.ts` (they redirect to this Worker in prod
but the stubs return 501 locally, so for full local AI dev you need to run
`wrangler dev` here in parallel and proxy through it).
