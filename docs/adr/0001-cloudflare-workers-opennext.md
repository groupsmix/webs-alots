# ADR-0001: Cloudflare Workers + OpenNext for Deployment

## Status

Accepted

## Date

2026-04-30

## Context

Oltigo Health needs a deployment platform that supports:

- Edge-first latency for Moroccan clinics (Africa/Casablanca timezone)
- Cost-effective scaling for a multi-tenant SaaS with variable traffic
- Cloudflare R2 integration for encrypted PHI file storage
- KV namespace for feature flags and subdomain caching

Next.js is the chosen framework, but Cloudflare Workers do not natively
support the Next.js server runtime. OpenNext provides an adapter layer
that compiles Next.js output into a Workers-compatible bundle.

## Decision

Deploy via **Cloudflare Workers** using the **OpenNext** adapter
(`open-next.config.ts`). Static assets are served from Workers Sites /
R2, and the server-side rendering runs in the Workers V8 isolate.

## Alternatives Considered

1. **Vercel** - Native Next.js support but higher cost at scale, no
   Cloudflare R2 integration, data residency concerns for Morocco.
2. **AWS Lambda + CloudFront** - Proven but more complex to manage,
   cold start latency, no built-in KV equivalent without DynamoDB.
3. **Self-hosted Node.js** - Full control but operational burden for a
   small team, no edge distribution.

## Consequences

- **Positive**: Sub-50ms TTFB for Moroccan users via Cloudflare's
  Casablanca PoP; seamless R2/KV integration; cost scales with usage.
- **Negative**: OpenNext is a community project with occasional
  compatibility gaps on new Next.js releases; debugging Workers
  requires `wrangler tail` rather than standard Node.js tooling.
- **Risk**: Breaking changes in Next.js major versions may require
  waiting for OpenNext updates before upgrading.
