# Architecture Overview

> **Audience:** Engineers, auditors, new team members
> **Last updated:** July 2026

```mermaid
flowchart TD
    subgraph Client["Client (Browser / Mobile)"]
        B[Next.js App Router<br/>React 19 RSC + Client Components]
    end

    subgraph CF["Cloudflare Edge"]
        WAF[Cloudflare WAF<br/>Managed Rules + Bot Fight]
        W[Cloudflare Workers<br/>via OpenNext]
        KV[(KV Store<br/>Rate Limits + Feature Flags)]
        R2[(R2 Encrypted Storage<br/>PHI Files AES-256-GCM)]
    end

    subgraph SB["Supabase (EU Region)"]
        PG[(PostgreSQL<br/>RLS-Enforced + 202 Migrations)]
        Auth[GoTrue Auth<br/>MFA / OTP / Password]
        RT[Realtime<br/>Presence + Subscriptions]
    end

    subgraph Ext["External Services"]
        Stripe[Stripe<br/>Payments + Webhooks]
        CMI[CMI<br/>Moroccan Interbank]
        Meta[Meta WhatsApp<br/>Business API]
        OAI[OpenAI<br/>Pseudonymised AI]
        Sentry[Sentry<br/>Error + Performance]
        Plausible[Plausible<br/>Cookie-less Analytics]
    end

    B -- HTTPS --> WAF
    WAF --> W
    W -- "PostgREST HTTP" --> PG
    W -- "GoTrue API" --> Auth
    W -- "Subscriptions" --> RT
    W -- "KV Get/Put" --> KV
    W -- "R2 Presigned" --> R2
    W -- "Webhook verify" --> Stripe
    W -- "HMAC callback" --> CMI
    W -- "HMAC verify" --> Meta
    W -- "Pseudonymised" --> OAI
    W -- "captureException" --> Sentry
    B -- "Script tag" --> Plausible
```

## Tenant Isolation (4 Layers)

```
1. Middleware   →  Subdomain → clinic_id header (strips client headers)
2. withAuth()  →  User session + RBAC + clinic_id from profile
3. Supabase    →  createTenantClient(clinicId) sets app.clinic_id
4. PostgreSQL  →  RLS policies enforce clinic_id = current_setting('app.clinic_id')
```

## Key Directories

| Path                   | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `src/middleware.ts`    | Request pipeline: security headers, CSRF, rate limit, tenant resolution |
| `src/app/api/`         | API route handlers (withAuth + withValidation wrappers)                 |
| `src/lib/ai/`          | AI modules: config, sanitize, pseudonymise, validate-output             |
| `src/lib/middleware/`  | Composable middleware modules                                           |
| `supabase/migrations/` | 202 sequential SQL migrations (numbered through 00203) with RLS         |
| `docs/`                | Runbooks, SOPs, compliance, ADRs                                        |
| `.github/workflows/`   | CI (lint, typecheck, test, security, e2e, deploy)                       |
| `wrangler.toml`        | Cloudflare Workers config (routes, KV, R2, crons)                       |

## Canonical Architecture Documents

> Historical one-off analysis snapshots live under `docs/architecture-analysis/`.
> Treat this file and `docs/architecture/` as the living source of truth.

Use this page as the entry point, then follow the focused documents below:

| Document                                         | Purpose                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `docs/architecture/trust-boundary-matrix.md`     | Maps trusted vs distrusted signals across edge, auth, app, DB, and service-role paths   |
| `docs/architecture/global-vs-tenant-map.md`      | Separates tenant-scoped surfaces from platform-global islands                           |
| `docs/architecture/constitutional-guardrails.md` | Documents the CI/test/ADR guardrails that act as architectural law                      |
| `docs/architecture/failure-semantics.md`         | Explains which subsystems fail closed, degrade gracefully, or fail open                 |
| `docs/architecture/runtime-phase-model.md`       | Captures build-time, deploy-time, request-time, and isolate/runtime constraints         |
| `docs/architecture/distributed-truth-map.md`     | Explains where architecture is intentionally split across multiple synchronized sources |
| `docs/architecture/rls-policy-map.md`            | Documents tenant RLS policy classes, global-table exceptions, and pgTAP enforcement     |
| `docs/adr/0013-operations-first-scope.md`        | Records the operations-first scope decision                                             |
| `docs/adr/0014-ai-fail-open-toggle-posture.md`   | Records the deliberate AI kill-switch / toggle failure posture                          |
