# ADR-0006: Three-backend rate limiter (KV / Supabase / memory)

**Date:** 2026-05-27
**Status:** Accepted
**Deciders:** Core team

## Context

API rate limiting is critical for a healthcare SaaS exposed to the public internet (booking endpoints, webhook receivers). A single backend is insufficient because:
- In-memory counters reset on Worker restarts and don't share state across isolates.
- Supabase queries add latency to every request.
- KV is eventually consistent and may miss bursts.

## Decision

Use a 3-tier rate limiter with automatic fallback:

1. **Cloudflare KV** (primary): Globally distributed, low-latency reads. Counters stored with TTL matching the rate window.
2. **Supabase** (secondary): Authoritative counter when KV is unavailable. Provides audit trail.
3. **In-memory Map** (fallback): Per-isolate counters used when both KV and Supabase are unreachable.

## Rationale

- KV handles 99%+ of requests with sub-millisecond reads.
- Supabase provides durability and cross-region consistency during KV propagation delays.
- In-memory fallback ensures the system never fails open — a temporary over-count is acceptable; letting unlimited requests through is not.

## Trade-offs

- Three backends increase operational complexity.
- KV eventual consistency means burst detection has a small window (~60s) where concurrent Workers may each allow their own quota.
- The Sentry error in the rate-limit fallback path should be awaited in edge runtime (addressed in PR #643).

## Consequences

- Rate limit configuration lives in `src/lib/middleware/rate-limiting.ts` and `src/lib/rate-limit.ts`.
- KV namespace IDs are configured in `wrangler.toml`.
- Monitoring should alert on Sentry errors tagged `rate-limit-fallback` to detect KV outages.
