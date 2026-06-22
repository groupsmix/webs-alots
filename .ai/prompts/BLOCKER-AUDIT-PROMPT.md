# Prompt: Blocker & Blocker-Bug Audit (Oltigo Health)

> Copy everything inside the `=== PROMPT START / END ===` fences into a fresh AI session
> that has read/run access to this repository. The prompt is self-contained and
> repo-grounded — it tells the AI exactly what counts as a blocker here, where to
> look, what commands to run, and what the report must contain.

---

=== PROMPT START ===

You are a **principal engineer performing a launch-blocker audit** of the Oltigo Health
codebase. Oltigo is a **multi-tenant SaaS for Moroccan healthcare clinics**: Next.js 16
(App Router) + React 19 + Supabase (PostgreSQL + RLS) + Cloudflare Workers (OpenNext) +
Cloudflare R2. It handles **PHI (patient health information)** under Moroccan Law 09-08.

Your single deliverable is an **audit report listing ONLY blockers and blocker-class
bugs** — nothing else. Do not pad the report with nice-to-haves, style nits, or backlog
ideas. If it is not a blocker, it does not belong in this report.

## Step 0 — Read the ground truth first

Before judging anything, read these so your findings match existing conventions and you
do not re-report already-fixed issues:

- `AGENTS.md` and `.ai/TASK-ROUTER.md` — architecture, SEALED vs EDIT layers, security rules
- `MVP_SCOPE.md` — what is in-scope (core clinic flow) vs feature-flagged/experimental
- `docs/audit/baseline.md` and `docs/audit/cve-baseline.md` — the accepted quality baseline
- `docs/AUDIT-ROADMAP.md` and `docs/audit/open-actions.md` — what is already tracked/shipped
- `CHANGELOG.md` — recently fixed issues (do NOT re-flag these as new blockers)

If a problem is already shipped/tracked as resolved in the roadmap or changelog, exclude it
unless you can prove with current code that it regressed (cite the file + line).

## Definition of a BLOCKER (this repo)

Classify a finding as a blocker **only** if it meets at least one of these. Map each to a
severity using the project's existing scale (`P0` = launch blocker, `P1` = must-fix before
GA). Anything `P2`/`P3` is NOT a blocker — leave it out.

**P0 — hard launch blockers**

1. **Cross-tenant data leak**: any DB query (`.from(...).select/insert/update/delete`) that
   is not scoped by `clinic_id`, trusts a client-supplied `clinic_id`/`x-clinic-id` header,
   or bypasses `requireTenant()` / `requireTenantWithConfig()`. (See AGENTS.md "Tenant Isolation".)
2. **PHI exposure**: PHI logged, returned unencrypted, stored without AES-256-GCM via
   `@/lib/encryption`, or sent to Sentry/analytics. Secrets committed or logged.
3. **AuthN/AuthZ bypass**: routes missing `withAuth`/role checks, RBAC that fails open,
   middleware CSRF/origin checks bypassable, seed-user/seed-guard protections defeated.
4. **Broken webhook trust**: WhatsApp (`X-Hub-Signature-256`) or Stripe (`stripe-signature`)
   signature not verified before processing; webhook handler querying across tenants.
5. **Build/deploy breakers**: code that fails `npm run build`, `npm run build:cf`, or boots
   the Worker into a half-wired state (e.g., required env var unguarded).
6. **Data-loss / destructive migration**: migrations dropping columns/tables without guards,
   or destructive crons runnable in staging/prod without the documented guard.
7. **Payment integrity**: CMI/Stripe flows that can double-charge, skip verification, or
   mis-attribute payments across tenants.

**P1 — must-fix-before-GA blockers**

8. **Mass-assignment**: `.insert({...body})` / `.insert(body)` instead of explicit fields.
9. **Missing input validation** on mutation routes (no Zod schema via `@/lib/validations`).
10. **Failing/flaky required CI gates**: `lint`, `typecheck`, `test`, bundle-budget, E2E.
11. **Missing audit logging** (`logAuditEvent()`) on state-changing PHI operations.

Anything outside this list (cosmetic, perf micro-opts, doc gaps, test-coverage wishes,
experimental feature-flagged verticals that are off by default) is **out of scope**.

## Step 1 — Run the objective gates

Run these and record exact output (pass/fail + key errors). Do not claim "passes" without
running them; if you cannot run a command, say so explicitly.

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run test          # vitest run
npm run build         # next build (note: may need env vars)
npm run knip          # dead-code / unused deps (only flag if it breaks a gate)
```

Any non-baseline failure in typecheck / lint / test / build is a blocker (P0 build, P1 tests).

## Step 2 — Targeted code investigation

Search and read code in these high-risk areas. Cite `file:line` for every finding.

- **Tenant scoping**: `src/lib/tenant.ts`, `src/lib/tenant-context.ts`, `src/lib/assert-tenant.ts`,
  `src/middleware.ts`, and every `src/app/api/**/route.ts`. Grep for `.from(` calls missing
  `.eq("clinic_id"`, for `...body` spreads, and for `x-clinic-id` trust.
- **Auth/RBAC**: `src/lib/with-auth.ts`, `src/lib/auth*`, route handlers' `allowedRoles`.
- **PHI/secrets**: `src/lib/encryption.ts`, `src/lib/logger`, `src/lib/audit-log`, Sentry configs
  (`sentry.*.config.ts`), `.env.example`. Grep for `console.log`, PHI fields in logs.
- **Webhooks**: `src/app/api/**/webhook*`, WhatsApp + Stripe signature verification.
- **Payments**: `src/app/api/payments/**`.
- **Migrations**: `supabase/migrations/` — destructive ops, missing RLS on new `clinic_id` tables.
- **Env/boot guards**: `src/lib/env.ts`, `wrangler.toml`, cron guards.

Prefer reading the actual handler chain (request → auth → validation → tenant scope →
mutation → response) over assuming. A passing semgrep rule is not proof; verify by reading.

## Step 3 — Write the report

Create the report at: `docs/audit/BLOCKER-AUDIT-<YYYY-MM-DD>.md`

Use this exact structure:

```markdown
# Oltigo Health — Blocker Audit (<YYYY-MM-DD>)

- **Commit:** <git rev-parse --short HEAD>
- **Auditor:** <model/agent name>
- **Verdict:** READY ✅ | NOT READY — CONDITIONAL ⚠️ | NOT READY ❌
- **Blocker count:** P0: <n> | P1: <n>

## Gate results

| Gate       | Command             | Result    | Notes |
| ---------- | ------------------- | --------- | ----- |
| Typecheck  | `npm run typecheck` | pass/fail | ...   |
| Lint       | `npm run lint`      | pass/fail | ...   |
| Unit tests | `npm run test`      | pass/fail | ...   |
| Build      | `npm run build`     | pass/fail | ...   |

## Blockers

> One entry per finding, ordered P0 first. No non-blockers.

### [BLK-01] <short title> — P0

- **Category:** Tenant leak | PHI | AuthZ | Webhook | Build | Migration | Payment | Mass-assignment | Validation | CI | Audit-log
- **Location:** `path/to/file.ts:LINE` (+ related files)
- **Evidence:** exact code snippet or command output proving the issue
- **Impact:** what breaks / what data is exposed, and which user role/tenant is affected
- **Why it's a blocker:** map to the definition above
- **Fix:** concrete, minimal change (respect SEALED layers in TASK-ROUTER.md — if the fix
  touches a SEALED file, flag it for human sign-off instead of editing silently)
- **Already-tracked?:** link to roadmap/changelog entry if related, else "new"

### [BLK-02] ...

## Explicitly checked & NOT blocking

> Short list of high-risk areas you verified are fine, so reviewers know coverage.

## Out of scope / deferred

> Anything you noticed that is real but NOT a blocker (P2/P3, experimental flagged
> features). One line each. Do not expand these into fixes.
```

## Rules of engagement

- **Evidence or it doesn't exist.** Every blocker needs a `file:line` citation or real command
  output. No speculation, no "might be", no hallucinated file paths. If unsure, mark
  `UNVERIFIED` and say what you'd need to confirm.
- **Do not fix code in this pass** unless explicitly asked — this is an audit. Propose fixes.
- **Respect SEALED layers** (`src/middleware.ts`, `src/lib/auth/`, `src/lib/tenant*.ts`,
  `src/lib/encryption.ts`, RLS migrations): report issues, but route fixes through human review.
- **Don't re-report resolved items** from the roadmap/changelog without proof of regression.
- **Be honest about the verdict.** If there are zero P0s and zero P1s, say READY. If you could
  not run the gates, the verdict is at most NOT READY — CONDITIONAL.
- Keep the report tight. A blocker report with 6 real blockers beats one with 40 padded items.

=== PROMPT END ===

---

## How to use this

1. Start a fresh AI session pointed at this repo.
2. Paste the block between the `PROMPT START/END` fences.
3. The AI will read the ground-truth docs, run the gates, investigate the high-risk code,
   and write `docs/audit/BLOCKER-AUDIT-<date>.md`.
4. Review the report, then ask the AI to fix specific blockers one PR at a time (small,
   reviewable PRs — never `git add .`, never touch SEALED files without sign-off).

### Optional tweaks

- **Faster scope:** add a line restricting it to a path, e.g. _"Only audit `src/app/api/booking/**`."_
- **Pre-PR gate:** ask the AI to also run the audit against the current branch diff only.
- **CI integration:** the same prompt works as a manual checklist before tagging a release.
