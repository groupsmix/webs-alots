# ADR-0005: Cloudflare Workers (OpenNext) over Vercel

**Date:** 2026-05-27
**Status:** Accepted
**Deciders:** Core team

## Context

Oltigo Health requires edge deployment for low-latency responses across Morocco and Europe. The two primary options were Vercel (native Next.js host) and Cloudflare Workers via OpenNext.

## Decision

Deploy on Cloudflare Workers using OpenNext as the Next.js adapter.

## Rationale

1. **R2 co-location**: PHI files are stored in Cloudflare R2 with AES-256-GCM encryption. Deploying Workers on the same network eliminates cross-provider latency for file operations.
2. **KV for rate limiting**: Cloudflare KV provides a globally distributed key-value store used by the 3-backend rate limiter. No equivalent exists on Vercel without external services.
3. **Pricing predictability**: Workers pricing (requests + CPU time) is more predictable than Vercel's function invocations for a multi-tenant SaaS with bursty traffic patterns.
4. **Wrangler.toml control**: Full control over CPU limits, KV bindings, and compatibility dates via `wrangler.toml`.

## Trade-offs

- OpenNext is a community project; Vercel's native runtime has tighter integration with Next.js features.
- Some Next.js features (e.g., `proxy.ts`, ISR) are not fully supported on Workers.
- Build tooling requires the `@opennextjs/cloudflare` adapter, which adds a build step.

## Consequences

- All deployment is via `wrangler deploy` in CI.
- Edge runtime constraints apply (no Node.js APIs like `fs`, `child_process`).
- Middleware CPU budget is capped at 50ms (Paid plan) — monitored via `server-timing` header.
