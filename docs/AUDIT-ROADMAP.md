# Oltigo Health — Audit Remediation Roadmap

**Owner of this file:** whoever last touched it. Update this whenever an audit finding moves between states.
**Source audits tracked:**
- `webs-alots-audit(3).md` — original audit (FR-NN refs, addressed in PR #863 + follow-ups)
- `webs-alots-etap1-audit.md` — End-to-End Production Audit (etap_1, 2026-05-30), 30 findings, `NOT READY — CONDITIONAL` launch verdict

This file replaces the previously promised "Audit Remediation Roadmap & Wave Tracker" that lived only in a chat surface. The chat surface was a hallucination; this file is the real, in-repo source of truth.

---

## Status legend

| State | Meaning |
|-------|---------|
| ✅ Shipped | Code/config change merged into `main` |
| 🟢 In PR | Open pull request, awaiting review |
| 🟡 Partial | Some pieces shipped, more pieces tracked separately |
| ⏳ Deferred | Acknowledged but out of scope for current sprint |
| 🛠️ Operator action | Code-side done; remaining steps require Cloudflare/Supabase login |
| ❌ Not started | Visible gap, no PR yet |
| 🔍 Verify only | Audit asks for inspection rather than code change |

---

## Open PRs at the time of this writing

| PR | Branch | Title (short) | Touches |
|----|--------|---------------|---------|
| #863 | `cleanup/audit-wave-0-to-2-safe-fixes` | Wave 0–2 safe fixes (FR-03/07/14/18) + triage tool | shadcn devdep, secrets-template hardening, SEED_PASSWORDS_ROTATED docs, duplicate Plausible removed |
| #865 | `fix/register-clinic-disabled-ux` | Contact-us panel when self-service registration is disabled | `NEXT_PUBLIC_SELF_SERVICE_REGISTRATION_ENABLED` flag, French 403 fallback |
| #870 | `fix/color-contrast-light-only` | Pin light color-scheme, disable broken auto-dark | `tokens.css`, `globals.css` |
| #871 | `fix/error-boundary-nav-recovery` | Real recovery paths in `ClinicErrorBoundary` | Retry / Go back / Go to dashboard + dev error details + i18n keys |
| #872 | `fix/perf-missing-loading-skeletons` | `loading.tsx` for 14 admin segments | admin/expenses, audit-logs, lab-results, insurance-claims, …  |
| #873 | `fix/audit-critical-blockers` | etap1 critical: rate-limit KV mode, PHI masking, secrets-template removed, Sentry/cron docs | `wrangler.toml`, `.env.example`, `secrets-template.env` (deleted), `.gitignore` |
| #874 | `fix/audit-remaining-blockers` | etap1: Supabase pooler, Sentry Replay PHI guard, drop client-cookie tenant tag | `src/lib/supabase-server.ts`, `sentry.client.config.ts`, `.env.example` |
| #G  | `infra/staging-kv-separation` | etap1 #5: document staging-vs-prod KV bleed + action checklist | `wrangler.toml` |

Recommended merge order: #872 → #870 → #871 → #863 → #874 → #865 → #873 → #G (after running the wrangler command).

---

## etap1 finding tracker

### CRITICAL (launch blockers)

| # | Finding | Status | PR | Notes |
|---|---------|--------|----|-------|
| 1 | Rate limiter falls back to in-memory in production | ✅ Shipped via #873 | #873 | `RATE_LIMIT_BACKEND` flipped to `kv` in all three vars blocks. Confirmed `src/lib/cf-bindings.ts` already resolves bindings via `getCloudflareContext().env`, and `src/lib/rate-limit.ts` calls `getWorkerBinding<CloudflareKV>("RATE_LIMIT_KV")` — the HOTFIX was over-cautious. Verify after deploy with `wrangler tail --env production` showing KV ops. |
| 2 | Seed users with known password active | 🟡 Partial — guidance in #863, secret still needs setting | #863 | 3-layer guard exists in code. Operator must `wrangler secret put SEED_PASSWORDS_ROTATED --env production` with value `true` and rotate the seed user passwords (or delete the seed accounts). |
| 3 | `secrets-template.env` tracked in public repo | ✅ Shipped via #873 | #873 | File deleted from working tree and added to `.gitignore`. Confirmed contents were placeholder-only (same shapes as `.env.example`) — no real credentials were leaked, so a git-history rewrite is **not** required. |
| 5 | Staging KV namespace shared with production | 🛠️ Operator action — PR #G adds the checklist | #G | The actual ID swap needs `wrangler kv:namespace create RATE_LIMIT_KV_STAGING`. PR #G is intentionally a docs-only diff so it can sit open until the new KV namespace exists. |
| 6 | Rate-limiter KV binding resolution bug | ✅ Shipped via #873 (companion to #1) | #873 | Companion finding. The code already resolves bindings correctly via `cf-bindings.getWorkerBinding`. #873 removes the now-unneeded `RATE_LIMIT_BACKEND="memory"` override. |
| 7 | `NEXT_PUBLIC_DATA_MASKING` missing from `wrangler.toml` | ✅ Shipped via #873 | #873 | Added to top-level `[vars]`, `[env.production.vars]`, `[env.staging.vars]`. Default in `.env.example` flipped from `none` to `partial`. |
| 13 | `NEXT_PUBLIC_DATA_MASKING` not baked into build at build time | 🟡 Partial — code/config in #873; CI workflow needs verification | #873 | Companion to #7. The runtime value is now correct, but `NEXT_PUBLIC_*` vars are inlined at build time by Next.js. CI workflows must export `NEXT_PUBLIC_DATA_MASKING=partial` to the build step. **Action:** open `.github/workflows/deploy.yml` and confirm the build step sees `NEXT_PUBLIC_DATA_MASKING=partial` either from `wrangler.toml` (via `wrangler deploy`) or from a workflow `env:` block. |
| 17 | `CRON_SELF_BASE_URL` undocumented; cron silently drops | ✅ Shipped via #873 | #873 | Documented in `.env.example` with deploy instructions. Operator must `wrangler secret put CRON_SELF_BASE_URL --env production` with value `https://oltigo.com` (or set `ROOT_DOMAIN`). |
| 27 | Sentry DSN optional → errors silently swallowed | ✅ Shipped (already in `src/lib/env.ts`) | — | `src/lib/env.ts:223-227` already declares `NEXT_PUBLIC_SENTRY_DSN` as `required: process.env.NODE_ENV === "production"`, and `enforceEnvValidation()` is invoked at startup. #873 also strengthens the inline docs. **Operator must still set the secret** via `wrangler secret put NEXT_PUBLIC_SENTRY_DSN --env production`. |

### HIGH

| # | Finding | Status | PR | Notes |
|---|---------|--------|----|-------|
| 4  | CPU 50ms limit incompatible with AI/PDF/cron work | 🔍 Verify only | — | Requires checking the Cloudflare account plan. If on Workers Paid + Unbound, the `cpu_ms = 50` lines in `[env.production.limits]` and `[env.staging.limits]` should be removed. If on Bundled, keep the limit and offload heavy work. |
| 8  | Supabase connection pooling not implemented for Workers | ✅ Shipped via #874 | #874 | `src/lib/supabase-server.ts` now prefers `SUPABASE_POOLER_URL` over `NEXT_PUBLIC_SUPABASE_URL` in all five client factories. Operator must set the secret: `wrangler secret put SUPABASE_POOLER_URL --env production` with the transaction-mode pooler URL (`port 6543`). |
| 9  | ESLint warning baseline 4,045 | 🟡 Partial — triage script in #863 | #863 | `scripts/triage-eslint-warnings.sh` from #863 produces the rule-level breakdown. The actual reduction is its own multi-week workstream. Recommended next batch: top `i18next/no-literal-string` offenders in auth + booking paths. |
| 10 | `open-next.config.ts` empty; custom worker entry untracked | 🟡 Partial documented here | — | `defineCloudflareConfig({})` is a real public API; the `customWorkerEntry` option referenced in the audit doesn't exist yet in `@opennextjs/cloudflare@1.17`. `worker-cron-handler.ts` is the real custom entry and is wired via the wrangler config — `scripts/patch-opennext.mjs` and `scripts/post-build-patch.mjs` only patch manifest loading, not the cron entry. **Action:** add an automated check that `.open-next/server-functions/default/handler.mjs` contains a `scheduled` export after each build. |
| 11 | Three overlapping env files | ✅ Shipped via #873 | #873 | `secrets-template.env` deleted. `.env.example` and `.env.production.example` remain; the former is the canonical dev onboarding file, the latter is production overrides only. |
| 12 | Sentry Replay PHI route guard incomplete | ✅ Shipped via #874 | #874 | Allowlist expanded to include `/receptionist/`, `/super-admin/`, `/dashboard/`, `/appointment/`, `/medical/`. |
| 13 | (See #7) | ✅ Shipped via #873 | #873 | — |
| 16 | `SENTRY_ORG` / `SENTRY_PROJECT` undocumented | ✅ Shipped via #873 | #873 | Added to `.env.example` with auth-token guidance. CI must export these to the Sentry source-map upload step. |
| 17 | (See CRITICAL #17) | ✅ Shipped via #873 | #873 | — |
| 18 | CPU limit duplicate (see #4) | 🔍 Verify only | — | — |
| 19 | 4,045 hardcoded strings (companion to #9) | 🟡 Partial — triage in #863 | #863 | Same workstream as #9. |
| 25 | No cookie consent / GDPR banner | ⏳ Deferred — design decision | — | Plausible is cookie-free; Sentry Replay is the only consent-trigger and it is already disabled on every PHI route via #874. Public marketing pages still need a minimal banner before EU promotion. Outside current sprint. |
| 27 | (See CRITICAL #27) | ✅ Shipped | — | — |

### MEDIUM

| # | Finding | Status | PR | Notes |
|---|---------|--------|----|-------|
| 14 | Duplicate `NEXT_PUBLIC_PLAUSIBLE_HOST` | ✅ Shipped via #863 (FR-18) and #873 | #863 / #873 | Both PRs delete the duplicate. On merge, only one of them will actually carry the change (the other becomes a no-op). |
| 15 | `shadcn` in `dependencies` | ✅ Shipped via #863 (FR-03) | #863 | Moved to `devDependencies`. |
| 20 | WhatsApp 15-minute polling cron still active alongside Queues | 🔍 Verify only | — | Confirm via `grep -r enqueueNotification src/` and Cloudflare dashboard Queues metrics whether queue is primary or cron is. If queue is live, lower the cron frequency from `*/15 * * * *` to `0 */6 * * *` as a recovery sweep. |
| 21 | Sentry client config reads tenant from cookies | ✅ Shipped via #874 | #874 | Cookie-reading clinic_id tagging removed from `beforeSend`. |
| 22 | R2 magic-byte upload validation not verified | 🔍 Verify only | — | Open `src/app/api/upload/route.ts` PUT handler and confirm: (a) HeadObject on the uploaded file, (b) first 16 bytes match the declared Content-Type, (c) DELETE on mismatch. |
| 23 | RTL layout correctness across all 6 dashboards | 🔍 Verify only | — | Visual review task. Worth a Playwright snapshot suite with `dir="rtl"`. |
| 24 | `supabase/functions/` excluded from TypeScript | ⏳ Deferred — needs Deno toolchain | — | The audit's proposed `tsconfig.json` won't work for the Deno-based Edge Function (URL imports + `Deno.env`). Real fix is `deno check` in CI plus a `supabase/functions/deno.json`. Outside current sprint. |
| 26 | Bundle budget undocumented in README | ⏳ Deferred — docs only | — | One-paragraph README addition. Low value vs. cost during stress. |
| 28 | `@storybook/addon-mcp` dep | 🔍 Verify only | — | Confirm Storybook is never deployed publicly. |
| 29 | `trailingSlash: true` consistency | 🔍 Verify only | — | Run `grep` from the audit to verify. |

### LOW

| # | Finding | Status | PR | Notes |
|---|---------|--------|----|-------|
| 30 | API versioning Sunset header active without v1 handlers | ⏳ Deferred — design decision | — | Either remove the `Sunset` headers in `next.config.ts:99-138` or build real `/api/v1/*` handlers before Dec 31 2026. |

---

## Original audit (`webs-alots-audit(3).md`) — recap

| Finding | Status | PR | Notes |
|---------|--------|----|-------|
| FR-03 (shadcn → devDep) | ✅ Shipped | #863 | Also captured by etap1 #15. |
| FR-07 (secrets-template.env hardened) | ✅ Shipped | #863 + #873 | #863 hardened; #873 deleted entirely. |
| FR-14 (`SEED_PASSWORDS_ROTATED` guidance) | ✅ Shipped | #863 | Also captured by etap1 #2. |
| FR-18 (duplicate `NEXT_PUBLIC_PLAUSIBLE_HOST`) | ✅ Shipped | #863 + #873 | Both remove it. |
| R-12 (self-service registration gate) | ✅ Shipped | #865 | Frontend now shows a translated "contact us" panel instead of crashing into a raw 403. |
| ESLint baseline triage tool | ✅ Shipped | #863 | `scripts/triage-eslint-warnings.sh`. |

UX hotfixes done in the same session (not from a numbered audit finding but tracked here for completeness):
- Color contrast — #870
- Error boundary recovery — #871
- Loading skeletons — #872

---

## Production readiness checklist (etap1 §5)

Items that **only** need an operator on a workstation with `wrangler login` + Supabase access:

- [ ] Set Cloudflare secrets in production:
  - [ ] `wrangler secret put NEXT_PUBLIC_SENTRY_DSN --env production`
  - [ ] `wrangler secret put SENTRY_AUTH_TOKEN --env production`
  - [ ] `wrangler secret put CRON_SELF_BASE_URL --env production` (or set `ROOT_DOMAIN`)
  - [ ] `wrangler secret put SUPABASE_POOLER_URL --env production`
  - [ ] `wrangler secret put SEED_PASSWORDS_ROTATED --env production` with value `true`
- [ ] Rotate or delete the seed users from migration `00019`
- [ ] Create the staging KV namespace and replace the IDs in PR #G:
  - [ ] `wrangler kv:namespace create RATE_LIMIT_KV_STAGING`
  - [ ] `wrangler kv:namespace create RATE_LIMIT_KV_STAGING --preview`
- [ ] Verify Cloudflare Workers plan (Paid + Unbound vs Bundled — etap1 #4/#18)
- [ ] Confirm `.github/workflows/deploy.yml` exports `NEXT_PUBLIC_DATA_MASKING=partial` to the build step
- [ ] Confirm `wrangler tail --env production` shows KV ops on rate-limited endpoints after first deploy
- [ ] Verify Cloudflare cron triggers fire (dashboard → Workers → Cron Triggers)
- [ ] Check `supabase secret list` includes WhatsApp + Twilio + PHI keys

Items that need a real review/verification pass (no code can do this):

- [ ] RTL visual review on all 6 role dashboards (etap1 #23)
- [ ] R2 upload magic-byte validation walkthrough (etap1 #22)
- [ ] WhatsApp Queues vs cron polling decision (etap1 #20)
- [ ] Trailing-slash consistency check (etap1 #29)
- [ ] Storybook not deployed publicly (etap1 #28)

---

## Notes for future audits

- The "audit-wave" branch naming convention (`cleanup/audit-wave-0-to-2-safe-fixes`, `fix/audit-critical-blockers`, `fix/audit-remaining-blockers`, `infra/staging-kv-separation`) is intentional. Keep it.
- Every PR body should reference the finding number(s) it closes here in this file. Update the table on merge.
- This file is the single source of truth — do not maintain a parallel tracker in chat, in a Library document, or in any other surface.
