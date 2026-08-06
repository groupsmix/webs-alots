---
inclusion: always
---

# Oltigo Health — Kiro operating rules

This repo is already documented. Before any task, READ in order: **`AGENTS.md`** (the binding contract — tenant isolation, security, API conventions, domain, CI) and **`.ai/TASK-ROUTER.md`** (which files to edit vs. never touch). This file adds only Kiro-specific *operating behavior* plus a few rules not yet in those docs. **If anything here conflicts with `AGENTS.md`, `AGENTS.md` wins.**

Oltigo is a multi-tenant healthcare SaaS for Moroccan clinics. A cross-tenant leak or a PHI leak is catastrophic — it outranks shipping speed.

## SEALED — never modify without an explicit instruction

From `.ai/TASK-ROUTER.md`: `src/middleware.ts`, `src/lib/auth/`, `src/lib/tenant.ts`, `src/lib/tenant-context.ts`, RLS policies in `supabase/migrations/`, and the existing booking/payments routes. If a task would touch any of these — or anything involving tenant boundaries, PHI, payments, auth/roles, or webhook trust — **STOP and ask me first.** A wrong guess there is expensive and sometimes unrecoverable.

## How to operate in Kiro

- **Mirror existing code.** Open the nearest existing route/migration/test and follow its patterns, imports, and error handling. Don't invent a new pattern or add a dependency when one already exists.
- **Create, don't modify.** Add new API routes under `src/app/api/[feature]/route.ts`; don't edit existing handlers (per TASK-ROUTER).
- **Never `git add .`** — stage only the specific files you changed.
- **Proceed vs. ask.** Proceed on low-risk, pattern-obvious work; STOP and ask on the SEALED/sensitive surfaces above.
- **Definition of Done = report each as pass/fail**, matching the CI pipeline in `AGENTS.md`: `npm run lint` → `npm run typecheck` → `npm run test` (coverage ≥ `.vitest-coverage-floor.json`) → bundle ≤ 800 kB (`node scripts/check-bundle-budget.mjs`) → `npm run test:e2e`. No "this should work."

## Rules to apply that aren't yet in AGENTS.md

- **Sentry scrubbing.** PHI and secrets must never reach Sentry or Plausible. Scrub request bodies, query params, and headers in the `sentry.*.config.ts` `beforeSend` paths. `@/lib/logger` is still the only place app logs go.
- **Idempotency.** Webhooks and payments must process idempotently, keyed on the provider event id (WhatsApp message id, Stripe `event.id`). A retried event must never double-charge, double-book, or double-notify. (Signature verification is already required by `AGENTS.md`.)
- **PHI is soft-deleted** (`deleted_at`), never hard-deleted; normal reads filter `deleted_at is null`. Retention follows Law 09-08 — confirm the window per record type with the team rather than assuming.

## Deeper rules load by area

`oltigo-api.md` (editing routes) · `oltigo-database.md` (migrations) · `oltigo-testing.md` (tests). Localization: follow `AGENTS.md` (FR default, AR-RTL, Darija for WhatsApp) and read `.ai/skills/ui-ux/SKILL.md` for design tokens / RTL / WCAG before UI work; don't regress `.i18n-coverage-baseline.json`.
