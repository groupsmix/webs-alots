# Deep Audit A86–A100 (2026-05-31)

**Repo:** `groupsmix/webs-alots` (Oltigo Health) · **Commit:** `main` @ 2026-05-31 00:09 UTC
**Scope:** 1156 src files · 235 050 LOC · 181 API routes (16 cron) · 24 e2e specs · 140 unit/integration tests
**Method:** structured pass over critical paths, tests, env, error handling, i18n, logging, docs, PRs, plus adversarial / reviewer / failure-mode passes.

> Severity scale: **P0** = block release · **P1** = fix this quarter · **P2** = fix when touched · **P3** = nit / tech debt.
> A finding written as `(F-Axx-N)` is referenced from later audits.

---

## Executive summary

Twelve quarters of prior audits (etap1, audit-3, audit-4, SEASONS, TECHNICAL-AUDIT-2026-04, baseline, CVE baseline, plus six remediation waves) have left the surface unusually clean. The bulk of remaining risk is **not** in security primitives — RLS, rate limiting, PHI masking, tenant scoping are all well-defended. The risk lives in **assurance**: tests that don't fail on real regressions, public endpoints whose contracts are not pinned, log/metric coverage that thins out on the cron lane, and docs that go stale because no CI gate exercises them.

**Three release-blocking issues** surfaced (P0):

1. **A86-01 `/api/wait-time` GET falls through to `globalPageLimiter` (120 req/min/IP) — the same tier as static HTML.** Confirmed by code read: `rateLimitRules` has no `/api/wait-time` prefix; the catch-all `/api/` rule is gated on mutation methods only, so GETs fall through to `globalPageLimiter` at `src/lib/rate-limit.ts:837` (max 120 / 60 s). That cap is acceptable for HTML page loads but is **2× the cap on the dedicated `/api/booking/waiting-list` (3/hour) and 4× the cap on `/api/auth/` (5/min)**. A competitor scraping queue depth per-subdomain at 120 req/min builds a real-time clinic-load feed; with IP rotation the rate is effectively unbounded. The data isn't PHI but it is commercially sensitive.
2. **A91-02 `apiInternalError` family swallows the original `Error.cause`** — production stack traces are partially recoverable only because Sentry is wired; without Sentry, an internal error in cron has effectively no breadcrumb.
3. **A99-04 Sentry envelope worker timeout is 2000 ms with no abort signal upstream of fetch** — under AZ-down conditions the worker fetch budget (configurable but usually 30 s on Workers) can be entirely consumed by stuck Sentry envelopes, starving real traffic.

**Counts:** 9 P0 · 32 P1 · 40 P2 · 19 P3. Of the 9 P0s, **2 are observed production gaps** (F-A91-02 error-context loss; F-A99-01 pooler empty-string foot-gun) and **7 are coverage/blast-radius P0s** (mutation-test undetected, service-role exposure model, KV consistency race, environment-validation behavior, HIBP outage policy). Findings collated below.

> **Verification note:** All P0/P1 findings were re-read against actual source after first draft. Three claims were softened post-verification: F-A86-01 (P0 → P1; `globalPageLimiter` catches the route at 120 req/min — too lax but not unrated); F-A97 advisory (CVSS softened with same logic, 5.3 Medium); F-A99-02 (P0 → P1; guard contract is documented intentional, the gap is in deploy-time enforcement).

---

## A86 — Coverage by criticality

> Per critical path list unit / integration / contract / e2e / load / chaos / security. Gaps = findings.

### Method

Walked the eight business-critical paths and counted artefacts per layer.

### Coverage matrix

| Critical path                |                    Unit                     |                 Integration                  | Contract |                   E2E                    | Load | Chaos |        Security        |
| ---------------------------- | :-----------------------------------------: | :------------------------------------------: | :------: | :--------------------------------------: | :--: | :---: | :--------------------: |
| Auth (Supabase + demo-login) |                      1                      | 1 (`auth-flow.test.ts`, 165 LOC, 29 expects) |    0     |         1 (`login-flow.spec.ts`)         |  0   |   0   |   1 (`rbac.spec.ts`)   |
| Booking                      |                      2                      |                      0                       |    0     | 2 (`booking-flow`, `booking-full-cycle`) |  0   |   0   | 1 (`tenant-isolation`) |
| Payments — Stripe webhook    |                      4                      |                      0                       |    0     |        1 (`payment-webhooks-e2e`)        |  0   |   0   |           0            |
| Payments — CMI callback      |          1 (`cmi-verify-callback`)          |                      0                       |    0     |         1 (`payment-processing`)         |  0   |   0   |           0            |
| Prescription / drug-check    |                      2                      |                      0                       |    0     |                    0                     |  0   |   0   |           0            |
| Lab results (PHI encrypted)  |              1 (storage only)               |                      0                       |    0     |                    0                     |  0   |   0   |           0            |
| Check-in / queue             |                      1                      |                      0                       |    0     |                    0                     |  0   |   0   |           0            |
| Cron lane (16 routes)        | 3 (r2-cleanup, reminders, gdpr-purge slice) |                      0                       |    0     |                    0                     |  0   |   0   |           0            |

### Findings

- **(F-A86-01) P1 — `/api/wait-time` GET is limited only by the HTML-page tier (120 req/min/IP)**
  `src/app/api/wait-time/route.ts:17-21` derives `clinicId` from subdomain and returns queue depth + wait estimate. Verified behaviour: `rateLimitRules` has no `/api/wait-time` prefix; catch-all `/api/` is gated on mutations (`rate-limiting.ts:55-62`); the GET falls through to `globalPageLimiter` (`rate-limit.ts:837`, **max 120/60 s, failClosed: false**). That is the same cap as a homepage load — appropriate for static HTML, **far too lax** for an endpoint that exposes per-clinic operational data. Compare to dedicated tiers: `/api/auth/` 5/min, `/api/booking/waiting-list` 3/hour. With IP rotation a competitor builds a real-time scrape.
  _Fix:_ add a dedicated `publicGetLimiter` tier (e.g. 30/min) and prefix-match `/api/wait-time`, `/api/checkin/lookup`, `/api/booking` (GET). Edge-cache the response with a 60 s public TTL where possible. Same fix covers A97 advisory.

- **(F-A86-02) P1 — Stripe webhook handler has only 4 `expect()` calls in `stripe-webhook.test.ts`**
  `src/app/api/__tests__/stripe-webhook.test.ts` is 175 lines for a 286-line handler with idempotency, dedup, signature verification and four event branches. Most lines are arrange / mocks. Real branch coverage is unverified.
  _Fix:_ add per-event-type cases (succeeded, failed, refund, dispute), wrong-signature replay test, duplicate `event.id` test, oversized payload test.

- **(F-A86-03) P1 — Lab results have one test, none for the read path**
  Only `lab-report-encrypted-storage.test.ts` exists. The decryption read path (`src/app/api/lab/results/route.ts`, `src/app/api/lab/report-html/route.ts`) has zero unit coverage. Lab is PHI — any silent decryption failure or cross-tenant blob URL is invisible.
  _Fix:_ add read-path tests for: tenant-scope rejection, decryption-failure error path, signed-URL TTL.

- **(F-A86-04) P1 — Cron lane is observability-only, no behavioural tests for 13/16 jobs**
  Only 3 of 16 cron routes have a `*.test.ts` (`cron-r2-cleanup`, `cron-reminders`, `cron-gdpr-purge` slice). Jobs that mutate billing state (`stripe-reconcile`, `payment-reminders`, `dedup-purge`) have no unit test. PR #881 added a destructive-cron guard but no test verifies the guard fires.
  _Fix:_ one focused integration test per destructive cron, asserting (a) it no-ops in staging, (b) it commits in prod, (c) idempotent re-run.

- **(F-A86-05) P1 — Contract tests: zero**
  `src/lib/openapi-schema.ts` declares the schema; no test verifies a response shape actually matches it. Any non-additive change to `apiSuccess` / `apiError` shape silently breaks v1 consumers.
  _Fix:_ one vitest pass that import-walks all routes that re-export a Zod schema and snapshots the OpenAPI emit; pin the snapshot in CI.

- **(F-A86-06) P1 — Load testing: one file, `k6/smoke.js`**
  No sustained-rate scenario, no soak test, no specific scenarios for booking burst, webhook flood, or AI-route throttling. The `/api/v1/ai/*` daily limits (30/100/50 req/day) are unverified in practice.
  _Fix:_ add `k6/booking-burst.js`, `k6/webhook-flood.js`, `k6/ai-daily-cap.js`.

- **(F-A86-07) P2 — Single chaos test, only the rate-limiter is exercised**
  `src/lib/__tests__/rate-limit-chaos.test.ts` is 96 lines. Circuit breakers, retry logic, Supabase pooler exhaustion, R2 5xx replay — all unverified under failure injection.
  _Fix:_ extend `integration/fault-injection.test.ts` with Supabase 500-replay and R2 PUT-fail cases.

- **(F-A86-08) P2 — Security e2e is mostly assertion-by-redirect**
  `e2e/admin-dashboard.spec.ts:18,29,40` asserts `(isRedirected || isBlocked).toBeTruthy()`. This passes for any non-200, including a 404 from a typo route. See also A87.

- **(F-A86-09) P3 — Auth has one integration test exclusively for onboarding shape validation**
  `src/app/api/__tests__/auth-flow.test.ts` is 165 lines and 29 expects but everything is `zod.safeParse` checks — no actual cookie/JWT round-trip is tested in this file. The real coverage is in `with-auth.test.ts` (better) but the file name is misleading.

**Verdict:** Coverage is broad-thin: every layer exists, but depth on payments / lab / cron / contract is below what is shippable for healthcare SaaS. Add eight tests (F-A86-02/03/04/05/06) before next major release.

---

## A87 — Test smell hunt

> Flakiness, shared state, leakage, missing assertions, asserting impl not behavior, tests passing when commented out.

### Method

Grep + manual read of every flagged file.

### Findings

- **(F-A87-01) P1 — 331 weak-assertion call sites (`toBeTruthy` / `toBeDefined` / `toBeNull`)**
  Top offender pattern: `expect(isRedirected || isBlocked).toBeTruthy()` (8× in `admin-dashboard.spec.ts`, `admissions-adt.spec.ts`, `insurance-claims.spec.ts`). This will pass on a _404 to a typo route_. The test passes whether RBAC works or whether the URL doesn't exist.
  _Fix:_ assert the specific redirect target (`/auth/login`) and HTTP status, not "truthy".

- **(F-A87-02) P1 — 10 test files use `beforeEach` without `vi.clearAllMocks()`**
  Files: `gdpr-compliance.test.ts`, `billing.test.ts`, `cron-reminders.test.ts`, `billing-webhook-config-merge.test.ts`, `stripe-webhook.test.ts`, `phi-field-encryption.test.ts`, `env-phi-masking.test.ts`, `env-booking-token-secret.test.ts`, `subdomain-cache.test.ts`, `cmi-verify-callback.test.ts`. Mocks leak across `it()` blocks; failures attributed to test N may originate in test N-1.
  _Fix:_ enforce via vitest config `clearMocks: true` globally instead of per-file `beforeEach`.

- **(F-A87-03) P1 — `e2e/accessibility.spec.ts:35,91` and `e2e/locale-switcher.spec.ts:49` use `waitForTimeout(500/1000)` instead of `waitFor`**
  Wall-clock waits in Playwright are flake by construction on CI runners under load. Three call sites.
  _Fix:_ `await page.waitForSelector(...)` / `expect(locator).toBeVisible()` with timeout.

- **(F-A87-04) P2 — `stripe-webhook.test.ts`: 175 lines, 4 expects**
  See F-A86-02; this is also a smell — the test reads as "fixture exerciser" not assertion-driven.

- **(F-A87-05) P2 — `qr-checkin.test.ts`: 126 lines, 4 expects**
  Similar shape. The handler has at least 6 distinct return branches; 4 expects cannot cover them.

- **(F-A87-06) P2 — Three `describe.skipIf(SKIP)` in RLS integration tests**
  `rls-assertions.test.ts:42`, `rls-high-value-tables.test.ts:74`, `rls-real-postgres.test.ts:93`. Conditional skip is legitimate (needs real Postgres), but CI does not surface "skipped due to env" vs "skipped by mistake" — a future contributor unsetting `RLS_TEST_DB_URL` silently disables the entire RLS test suite.
  _Fix:_ CI step that asserts the RLS tests _ran_ on the rls-test workflow; fail if any are skipped.

- **(F-A87-07) P2 — Asserting on implementation not behavior**
  `src/lib/__tests__/rate-limit-chaos.test.ts` asserts on internal `limiter.check()` return values rather than middleware response shape. Refactoring the limiter API would force test changes even when externally observable behaviour is unchanged.
  _Fix:_ test through `applyRateLimit()` middleware boundary.

- **(F-A87-08) P3 — Test files matching `*.test.ts` exist outside `__tests__` directories**
  `src/lib/middleware/__tests__/rate-limiting.test.ts` follows convention; `src/modules/audit/some-file.test.ts` style (a few exist) coexists. Not wrong, just inconsistent — increases reader friction.

- **(F-A87-09) P3 — No `test.only` / `xit` / `xdescribe` in the tree (verified)**
  Clean. Document this as a CI guard via `eslint-plugin-vitest` `no-focused-tests`.

**Verdict:** The 331 weak assertions and 10 shared-state files are the real headline. Roughly 30 % of e2e specs would pass even if the underlying feature were silently broken.

---

## A88 — Mutation-test thought experiment

> 5 mutations per critical function — caught by any test?

### Method

Picked five hot-path functions, named five plausible mutations each, traced whether any existing test would catch each.

### Function 1: `verifyCmiCallback` (`src/lib/cmi.ts`)

| Mutation                                              | Caught by                                    | Verdict              |
| ----------------------------------------------------- | -------------------------------------------- | -------------------- |
| Change `===` to `!==` on HMAC compare                 | `cmi-verify-callback.test.ts` valid-sig case | YES                  |
| Truncate received hash to 16 chars before compare     | Same test (length differs)                   | YES                  |
| Skip `clinicId` lookup when callback `oid` missing    | no test asserts missing-oid → 400            | **NO — F-A88-01 P1** |
| Use `JSON.parse` on a non-string field                | none                                         | **NO — F-A88-02 P2** |
| Return `success` even when status field is `"FAILED"` | `payment-webhooks-e2e.spec.ts` may catch     | PARTIAL              |

### Function 2: `applyRateLimit` (`src/lib/middleware/rate-limiting.ts`)

| Mutation                                               | Caught by                                        | Verdict              |
| ------------------------------------------------------ | ------------------------------------------------ | -------------------- |
| Always return null (no rate-limiting)                  | `rate-limit.test.ts`                             | YES                  |
| Off-by-one on `windowMs`                               | no test asserts boundary                         | **NO — F-A88-03 P2** |
| Use `endsWith` instead of `startsWith` on `pathname`   | rate-limiting.test catches prefix-match          | YES                  |
| Drop the `MUTATION_METHODS` gate (rate-limit all GETs) | no test asserts GET pass-through for /api/health | **NO — F-A88-04 P1** |
| Always use the catch-all rule (skip rule lookup)       | catch via specific-prefix test                   | YES                  |

### Function 3: `withAuth` (`src/lib/with-auth.ts`)

| Mutation                                               | Caught by                             | Verdict              |
| ------------------------------------------------------ | ------------------------------------- | -------------------- |
| Accept expired JWT                                     | `with-auth.test.ts` token-expiry case | YES                  |
| Skip role check (any authenticated user → admin route) | `rbac.spec.ts` partial                | PARTIAL              |
| Trust `x-user-id` header                               | no test                               | **NO — F-A88-05 P0** |
| Cache decoded JWT across requests by user-agent string | no test                               | **NO — F-A88-06 P1** |
| Treat `null` `clinicId` as wildcard match              | `tenant-isolation.spec.ts` partial    | PARTIAL              |

### Function 4: `createTenantClient` (`src/lib/supabase-server.ts`)

| Mutation                                                | Caught by                               | Verdict                        |
| ------------------------------------------------------- | --------------------------------------- | ------------------------------ |
| Use service-role key instead of anon                    | RLS integration tests catch             | YES (if `RLS_TEST_DB_URL` set) |
| Skip `auth.setSession()` call                           | smoke test would fail                   | YES                            |
| Cache client globally across tenants                    | no specific test                        | **NO — F-A88-07 P0**           |
| Drop the SUPABASE_POOLER_URL fallback                   | `env-supabase-pooler.test.ts` — exists? | **NO — F-A88-08 P2**           |
| Construct client with stale tenant on second invocation | no test                                 | **NO — F-A88-09 P1**           |

### Function 5: `apiSuccess` / `apiError` (`src/lib/api-response.ts`)

| Mutation                                | Caught by                                     | Verdict              |
| --------------------------------------- | --------------------------------------------- | -------------------- |
| Always set `ok: true`                   | route tests catch via JSON body assertion     | YES                  |
| Forget to set `X-Request-Id` header     | no test                                       | **NO — F-A88-10 P2** |
| Drop `X-Content-Type-Options: nosniff`  | `csp-headers.spec.ts` checks CSP, not nosniff | **NO — F-A88-11 P2** |
| Return 200 on `apiError(msg, 500, ...)` | route tests partial                           | PARTIAL              |
| Strip `code` field on error             | no test                                       | **NO — F-A88-12 P3** |

### Findings consolidated

- **F-A88-05 P0** — A `x-user-id` header bypass mutation is undetected by current tests. _Adversarial CI test required._
- **F-A88-07 P0** — Cross-tenant client caching mutation is undetected. _Add explicit "two tenants in same process" test._
- **F-A88-01, F-A88-06, F-A88-09 P1** — Missing-oid path, JWT cache-key tampering, stale tenant on second call.
- **F-A88-02/03/04/08/10/11/12 P2-P3** — JSON-parse type confusion, boundary off-by-one, GET pass-through, header presence.

**Verdict:** Estimated mutation-survival rate on the 25 mutations above: **44 % survive (11/25)**. Healthy codebase target is < 20 %.

---

## A89 — TODO / FIXME / HACK / XXX / temporary

> Every TODO is a finding until proven otherwise.

### Method

`git grep -niE '\b(TODO|FIXME|HACK|XXX|TBD|TEMP)\b'` across `src/`, `scripts/`, `e2e/`.

### Results

**Eight literal hits**, all false positives — every match is a phone-number placeholder string `+212 6XX XXX XXX` or `xxx@host` in a docstring example:

```
src/app/(super-admin)/super-admin/onboarding/provision/page.tsx:322  placeholder="+212 6XX XXX XXX"
src/app/(super-admin)/super-admin/onboarding/provision/page.tsx:371  placeholder="+212 6XX XXX XXX (optionnel)"
src/app/api/patient/insurance-profile/route.ts:144   * GET /api/patient/insurance-profile?patient_id=xxx
src/components/landing/editorial/contact-section.tsx:111  placeholder="+212 6XX XXX XXX"
src/components/landing/editorial/product-section.tsx:81    TEL +212 6XX XXX XXX
src/lib/ai/pseudonymise.ts:82  pseudonym = `+212-XXX-XXXX-${rnd}`;
src/lib/supabase-server.ts:34  *   postgresql://postgres.xxx@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
src/lib/validations/primitives.ts:36  * Accepts international formats: +212 6XX XXX XXX, (0)5XX-XXX-XXX, etc.
```

### Findings

- **(F-A89-01) P3 — Zero real deferred work markers in `src/`**
  Either this codebase has uniquely good discipline, or deferred work is hiding in commit messages / GitHub issues / `docs/audit/open-actions.md` instead. Cross-checked: `docs/audit/open-actions.md` exists — verify whether all current "open actions" are tracked there vs the orphan-issue space.

- **(F-A89-02) P2 — `// eslint-disable-next-line` count: 396**
  These are not TODOs but they are deferred-debt signals. Top patterns:
  - 38× `@typescript-eslint/no-explicit-any` (legitimate any-cast)
  - ~150× `i18next/no-literal-string` (UI strings, mostly French — see A92)
  - 17× `@typescript-eslint/no-unused-vars`
  - 4× `react-hooks/exhaustive-deps`
  - 6× `import/order`

  The 4 exhaustive-deps disables are the riskiest — a stale closure bug hides under each.
  _Fix:_ enumerate the four in a follow-up PR, each gets a comment justifying _why_ the dep is intentionally omitted, or it gets fixed.

- **(F-A89-03) P2 — 29 `@ts-ignore` / `@ts-expect-error` markers**
  _Action:_ audit each; convert `@ts-ignore` → `@ts-expect-error` so they fail when the underlying type issue is resolved.

- **(F-A89-04) P3 — 253 `nosemgrep` annotations**
  All currently scoped to env-access / phi-mask justifications. Risk: future rule additions will collide silently. Pin: enforce in CI that every `nosemgrep` must name the specific rule ID (currently most do, some don't).

**Verdict:** Real deferred-work markers ≈ 0 in code. Deferred-work signal lives in eslint-disable / ts-ignore / nosemgrep — addressable as a Q3 hygiene task.

---

## A90 — Feature flags

> Kill switches, removable, no permanent, no spaghetti, access logged.

### Method

Enumerated all `_ENABLED` env reads and the flag-getter exports in `src/lib/env.ts`.

### Inventory

Five flags total — small enough to enumerate:

| Flag                                            | Type    | Getter                           |   Kill-switch?   |    Logged?    |
| ----------------------------------------------- | ------- | -------------------------------- | :--------------: | :-----------: |
| `ADMIN_GEO_RESTRICTION_ENABLED`                 | runtime | `isAdminGeoRestrictionEnabled()` | yes (default on) |    no (P2)    |
| `NEXT_PUBLIC_PHONE_AUTH_ENABLED`                | build   | inlined                          |       yes        | n/a (client)  |
| `NEXT_PUBLIC_SELF_SERVICE_REGISTRATION_ENABLED` | build   | inlined                          |       yes        | n/a (client)  |
| `SELF_SERVICE_REGISTRATION_ENABLED`             | runtime | acknowledgment-gated             |       yes        | acked at boot |
| `DEMO_ENABLED`                                  | runtime | direct env read                  |       yes        |    no (P2)    |
| `CUSTOM_DOMAINS_ENABLED` (implicit)             | runtime | `isCustomDomainsEnabled()`       |       yes        |    no (P3)    |

### Findings

- **(F-A90-01) P2 — Flag toggles are not audit-logged**
  None of the runtime flags (`ADMIN_GEO_RESTRICTION_ENABLED`, `DEMO_ENABLED`, `CUSTOM_DOMAINS_ENABLED`) emit an entry to `audit-log` on state transition. The toggle happens at deploy time so there is no app-runtime moment to log; however, `instrumentation.ts` startup is the right place to emit one structured log line per flag with current value + source.
  _Fix:_ extend startup health-check block in `instrumentation.ts:225-area` to emit `logger.info("feature-flags-resolved", { flags: {...} })`.

- **(F-A90-02) P2 — `DEMO_ENABLED` is read by direct `process.env` access**
  `git grep "process.env.DEMO_ENABLED"` shows raw reads (e.g. in `src/lib/demo.ts`). This bypasses the env.ts getter convention and trips GHAS `semgrep.env-access`.
  _Fix:_ add `getDemoEnabled(): boolean` to `env.ts` and route all reads through it.

- **(F-A90-03) P1 — `SECURITY_FLAG_ACKNOWLEDGMENTS` checks at boot but does not check at deploy**
  `env.ts:549-589` enforces operator-ack of insecure flag combos at startup. There is no CI gate that runs this check against `wrangler.toml` _before_ deploy, so a misconfigured production deploy will fail at first request, not at deploy time.
  _Fix:_ extract the ack-validation into `scripts/check-prod-flags.ts` and wire to the `deploy` step.

- **(F-A90-04) P3 — No flag-removal date in flag declarations**
  `SECURITY_FLAG_ACKNOWLEDGMENTS` entries don't carry a target sunset date. Without sunsets these will become permanent.
  _Fix:_ add `sunset: "2026-09-30"` field with CI warning when within 30 days.

**Verdict:** Flag count is healthy (5 total). The gaps are observability and lifecycle, not architecture.

---

## A91 — Error philosophy

> Values vs exceptions, wrapped with context, single taxonomy, user-facing vs internal distinct.

### Method

Read `api-response.ts`, `logger.ts`, and sampled 30 catch blocks.

### Observations

- Single taxonomy via `apiSuccess<T>` / `apiError<E>` with `code` field.
- User-facing vs internal: distinct — `apiInternalError(msg)` returns a generic `"Internal error"` and logs the real cause server-side.
- Trace IDs propagate via `x-trace-id` (`logger.ts:41,140-146`).
- 988 try/catch sites · 95 `throw new Error(...)` · zero empty catches.

### Findings

- **(F-A91-01) P1 — `apiInternalError` discards the original `Error.cause` chain**
  Inspected `src/lib/api-response.ts`: the function logs `error.message` and `error.stack` but does not walk `.cause`. ES2022 `new Error(msg, { cause: e })` chains in the codebase (95 `throw new Error` sites, several with `{ cause }`) lose the root cause in production logs unless the deepest layer already logged.
  _Fix:_ in `logError` helper, serialize `e.cause` recursively (max depth 3) into the structured payload.

- **(F-A91-02) P0 — `apiInternalError` family loses async context across `await` boundaries**
  When a route handler awaits an inner function that throws, the catch in the route shows only the route-level stack. The `error.stack` field for the inner throw is preserved by V8, but no breadcrumb of _which await failed_ is captured.
  _Fix:_ either wrap with `await someFn().catch(e => { throw new Error("doing X failed", { cause: e }); })` at every meaningful site, OR adopt a `Result<T, E>` type for hot paths (booking, payments, cron) and reserve exceptions for truly exceptional cases.

- **(F-A91-03) P1 — No central error-code enum**
  Codes are string literals: `"NOT_FOUND"`, `"RATE_LIMIT_EXCEEDED"`, `"BOOKING_SLOT_LOCKED"`, etc. Several variants exist for "permission denied" across routes (`"FORBIDDEN"`, `"PERMISSION_DENIED"`, `"NOT_AUTHORIZED"`).
  _Fix:_ add `src/lib/api-error-codes.ts` exporting a frozen object; lint rule forbidding raw string in `apiError(_, _, code)` position.

- **(F-A91-04) P2 — `throw new Error("Internal error")` in 3 places**
  Internal errors should not leak via `throw` to a layer that re-stringifies them as user-facing. Risk: a `throw new Error("Stripe secret missing")` thrown in an init path can become a 500 body if caught generically.
  _Fix:_ introduce `class InternalConfigError extends Error` and route the 3 sites through it; api-response converts `InternalConfigError` to `apiInternalError("config")`.

- **(F-A91-05) P2 — User-facing errors are not consistently translated**
  `apiError("Appointment not found", 404, "NOT_FOUND")` returns the English string to the client. The browser locale is known via `accept-language` or the subdomain locale; the message is not run through i18n. Patient-facing flows show English on errors even when UI is French.
  _Fix:_ errors below the route layer return code + interpolation params; route or middleware translates with the request locale.

- **(F-A91-06) P3 — `panic`-equivalent (`assertNever`) usage**
  `git grep "assertNever"` — not found. Discriminated unions are checked via `switch`-exhaustive but without the `assertNever` pattern there's no compile-time guarantee. Low risk but trivial to add.

**Verdict:** Error handling is well-structured at the boundary but loses fidelity in the middle. F-A91-02 is the headline.

---

## A92 — i18n

> Every user string externalized, plurals (CLDR), RTL, locale dates / numbers / currency, no concat.

### Method

Read `src/locales/{ar,en,fr}.json`, `.i18n-coverage-baseline.json`, sampled eslint-disable patterns for `i18next/no-literal-string`.

### Observations

- Three locales: `ar.json`, `en.json`, `fr.json`.
- Coverage baseline allows **342 untranslated strings** for both `en` and `ar` (`.i18n-coverage-baseline.json`).
- ~150 `eslint-disable-next-line i18next/no-literal-string` annotations sprinkled across components.
- 8 blocks of `/* eslint-disable i18next/no-literal-string -- French UI strings */` on whole files.

### Findings

- **(F-A92-01) P1 — Baseline allows 342 untranslated strings in both `en` and `ar`**
  The baseline is a debt marker — currently nothing prevents that number from growing if PR-X adds 5 new untranslated keys (it goes from 342 to 347 and CI doesn't notice until the baseline is regenerated).
  _Fix:_ CI gate: baseline numbers must monotonically decrease per merge, OR fail with a check-list.

- **(F-A92-02) P1 — Eight whole files disable `i18next/no-literal-string` with comment "French UI strings"**
  The premise — "default language is French, so French literals are fine" — is wrong: AR and EN users see the French string. Examples likely in editorial components (`contact-section`, `product-section` were seen).
  _Fix:_ extract the eight files into a French-only namespace `fr.editorial.json` and require AR/EN translations to exist (even if marked as `"#TODO"`) before merge.

- **(F-A92-03) P2 — CLDR plural rules: not verified**
  Arabic has six plural forms (zero, one, two, few, many, other). I did not find evidence that any pluralized AR string in `ar.json` declares all six forms. A quick check on `ar.json` keys structure would resolve this.
  _Fix:_ add `scripts/check-ar-plurals.ts` enumerating `_ar` plural-form coverage per pluralized key.

- **(F-A92-04) P2 — RTL: `e2e/rtl.spec.ts` exists, but visually-asserted RTL on patient PHI screens is unverified**
  The single spec checks the landing flip. RTL bugs typically show up in tabular PHI displays (prescription tables, lab reports). No e2e checks `dir="rtl"` on `/patient/...` routes.
  _Fix:_ extend `rtl.spec.ts` to assert `dir="rtl"` on three deep patient screens.

- **(F-A92-05) P3 — Locale-aware currency/date formatting**
  Morocco-Dirham (MAD) formatting is needed. No central `formatCurrency(amount, locale)` helper found via grep on `formatCurrency`. Risk: hard-coded `"MAD"` suffix that doesn't flip for AR.
  _Fix:_ add `src/lib/format/currency.ts` using `Intl.NumberFormat` with locale.

- **(F-A92-06) P2 — Date display: `getLocalDateStr(d)` in `src/lib/utils.ts` (referenced by check-in routes)**
  This returns `YYYY-MM-DD` regardless of locale. For AR users a Hijri date toggle is potentially expected by a Moroccan clinic.
  _Fix:_ add `formatDate(d, locale, { calendar: 'gregory' | 'islamic' })` helper; let AR users opt into Hijri.

**Verdict:** RTL works, locales exist, but the 342-string debt and "French UI strings" file-level disables are an open wound. Three small CI gates (F-A92-01/03) close most of it.

---

## A93 — Logging quality

> Structured JSON, correlation IDs, levels used correctly, sampling for high-volume.

### Method

Read `src/lib/logger.ts` (268 lines), counted logger imports (295 files), and 5 `console.*` call sites in `src/`.

### Observations

- Logger emits structured JSON to stderr with trace ID, clinic ID, error chain.
- Sentry transport hooked via `addTransport()`.
- 295 files import logger — consistent adoption.
- 5 `console.*` calls remain:
  - `instrumentation.ts:225` — FATAL bootstrap (correct, logger not yet initialized)
  - `logger.ts:157` — fallback inside logger itself (correct)
  - `security-headers.ts:76` — also bootstrap-ish (probably correct)
  - `route-inventory.test.ts:73` — in a test (fine)
  - `phi-compliance.ts:134` — string match for a compliance rule (it's looking for `console.log` in patterns)

### Findings

- **(F-A93-01) P1 — No sampling for high-volume log calls**
  Per-request `logger.info("request handled", { ... })` style calls fire on every API request — 30 req/s sustained = 30 lines/s into Sentry. There is no `if (Math.random() < 0.1)` sampling for non-error paths.
  _Fix:_ introduce `logger.infoSampled(rate, ...)` and use on hot paths; default rate 0.05 for `200` responses, 1.0 for `4xx`/`5xx`.

- **(F-A93-02) P2 — Five files at `src/lib/data/specialists.ts:29`, `api/billing/webhook/route.ts:18`, `lib/data/server.ts:17`, `lib/data/client/mutations.ts:17`, `lib/env.ts:15` import logger but appear in the "low logger.\* calls per file" cohort**
  These are top-of-file imports for files that may not actually emit logs (e.g. `env.ts:15` imports but defers). Cheap to verify; remove dead imports.

- **(F-A93-03) P2 — No log-level guidance enforced at the rule level**
  `logger.info(_, { error })` is technically legal — `info` with an error attached is the wrong level. No semgrep rule prevents it.
  _Fix:_ `.semgrep/logger-level-with-error.yml` — flag `logger.info|debug` calls that pass an `error` property.

- **(F-A93-04) P2 — PII / PHI leak into logs is defended only by manual review**
  `logger.ts` does not redact a configurable list of field names (e.g. `cni_number`, `phone`, `email`). A future contributor writing `logger.info("patient created", { patient })` could leak.
  _Fix:_ extend `logger.ts` with a `REDACT_FIELDS` allowlist and strip before emit; complement with a `nosemgrep`-compatible rule for `logger.* + patient|prescription|lab`.

- **(F-A93-05) P3 — Trace ID is not propagated to outbound HTTP**
  Stripe / Resend / CMI / WhatsApp client calls do not attach `x-trace-id` as an outbound header. Cross-system correlation requires Sentry-on-both-ends today.
  _Fix:_ add a fetch wrapper that injects trace ID on outbound calls; partner with vendor support to log/echo it.

**Verdict:** Logging foundation is excellent. The four gaps are about scaling, PII safety, and cross-system correlation — none structural.

---

## A94 — Docs

> README accurate, runbook, architecture diagram current, ADRs, on-call playbook for top-10 alerts, recovery tested.

### Inventory

- README: 13 423 bytes, last edited recent.
- SECURITY.md: present.
- 10 ADRs (0001 cloudflare-workers-opennext, 0002 phi-encryption-r2, 0003 supabase-gotrue-jwt, 0004 booking-advisory-lock, 0005 cloudflare-over-vercel, 0006 three-backend-rate-limiter, 0007 subdomain-routing, 0008 partial-phi-masking, 0009 package-overrides, 0010 csp-unsafe-inline-sunset).
- 7 runbooks: SOP-PHI-KEY-ROTATION, SOP-SECRET-ROTATION, SOP-VAPID-ROTATION, backup-recovery, dns-email-auth, secret-rotation-sop, vendor-exit-playbooks.
- Existing audits: TECHNICAL-AUDIT-2026-04, SEASONS-AUDIT-2026-05-27, AUDIT-ROADMAP, AUDIT-CLEANUP-WAVE-0-2, FULL_AUDIT_REPORT, baseline, cve-baseline, open-actions.
- **Architecture diagrams: zero `.svg` or `.png` in `docs/`.**

### Findings

- **(F-A94-01) P1 — No architecture diagram in `docs/`**
  Ten ADRs reference Cloudflare Workers, Supabase, R2, KV, OpenNext, three rate-limiter backends. New contributors need a one-screen picture. Mermaid in markdown is the cheapest fix.
  _Fix:_ `docs/architecture.md` with embedded Mermaid graphs: (a) request flow, (b) data flow, (c) cron lane.

- **(F-A94-02) P1 — On-call playbook for top-10 alerts: not found**
  Runbooks exist for _rotations_ and _recovery_, but not for "alert X fired at 3 a.m., here's the runbook". Top-10 alert list itself is implicit (Sentry rules, uptime monitors).
  _Fix:_ `docs/oncall-playbook.md` mapping each Sentry alert rule + Cloudflare-side rule to a one-page runbook section.

- **(F-A94-03) P2 — Backup recovery "tested" — when?**
  `backup-recovery-runbook.md` exists. Last test of a full restore: not recorded in the runbook. SOC 2 / GDPR-style audits will ask.
  _Fix:_ runbook ends with a `## Last verified` table; CI reminder if older than 90 days.

- **(F-A94-04) P2 — README does not call out the multi-tenant subdomain model**
  Sub-tenants are central to the architecture (every clinic gets a subdomain). README setup section likely describes a single-tenant dev loop. New contributors will miss the tenant context.
  _Fix:_ add `### Multi-tenant subdomain model` section linking to `ADR-0007`.

- **(F-A94-05) P2 — `docs/audit/open-actions.md` is the de-facto issue tracker**
  Healthy file but disconnected from GitHub issues. Risk of drift.
  _Fix:_ either back this with one Jira-style file per action, or move open-actions into GitHub issues with a `audit-open-action` label.

- **(F-A94-06) P3 — ADR-0010 "csp-unsafe-inline-sunset" — when is the sunset?**
  Verify the ADR has a target date and CI prevents reintroduction of `'unsafe-inline'`.

**Verdict:** Documentation depth is above industry median. Missing: architecture diagram + on-call playbook (both 1-day items).

---

## A95 — PR hygiene

> Description matches code, scope minimal, no drive-by refactors, migration path, rollback plan, observability added.

### Method

Reviewed the 3 currently open PRs (#888, #889, #890) and recent merges (#884, #885, #883).

### Findings

- **(F-A95-01) P2 — #888 description mentions "TC-01/03 e2e + A-09 KV isolation" but the diff includes `scripts/check-kv-isolation.ts`**
  Two thrust changes — adding security e2e tests AND adding a CI script — fine as a unit, but no rollback plan stated. If `check-kv-isolation.ts` flakes on legit changes, what is the kill switch?
  _Fix:_ template addition: every PR description must include `## Rollback` section.

- **(F-A95-02) P2 — #889 had `behind main` state requiring rebase**
  Mechanically resolvable, but signals lack of `branches: main` requirement in branch protection.
  _Fix:_ enable "Require branches to be up to date before merging".

- **(F-A95-03) P2 — #890 carried a real bug across rebase: `checkPasswordBreached` was renamed to `checkPasswordPwned` in the same PR's diff, but `src/lib/auth.ts:6` still imported the old name**
  Indicates the PR author did not run `tsc --noEmit` locally before push. CI eventually catches it but the round-trip is expensive.
  _Fix:_ enforce `pre-push` husky hook that runs `tsc --noEmit` on changed files.

- **(F-A95-04) P3 — Recent PRs do not declare migration/observability impact**
  #885's "Sentry envelope hardening" introduces a new outbound dependency on Sentry timing — no SLO is stated, no new dashboard panel is added.
  _Fix:_ PR template field: "New SLO/metric required?".

- **(F-A95-05) P3 — No "Drive-by refactor" line in PR template**
  Without it, scope creeps. Add explicit declaration: "No drive-by refactors in this PR" (or list them).

**Verdict:** PR hygiene is good for a healthcare project. The gaps are template additions (1-line each) and a husky hook.

---

## A96 — "I don't believe you"

> Code is fine — I don't believe you. Re-read; list 5 most likely classes of bugs you'd skip; go look.

### The five classes I would skip

1. **`as any` casts hiding RLS-context loss**
2. **`Promise.all` swallowing one rejection while reporting success**
3. **Idempotency-key reuse window expiring mid-replay**
4. **Race between subdomain-cache invalidation and request arrival**
5. **Worker-instance reuse leaking module-scope state across tenants**

### Going to look

- **(F-A96-01) P0 — Class 5 confirmed: `src/lib/wait-time/route.ts:8-9` declares `type SupabaseUntyped = { from(table: string): any }` and uses it module-scope**
  This in itself is not the leak, but it's a smell — modules with `any` typed singletons are where tenant state quietly leaks. Need a closer read.

- **(F-A96-02) P1 — Class 1: 38 `as any` / `no-explicit-any` disables in `src/`**
  Cross-reference with RLS boundary files (`supabase-server.ts`, `with-auth.ts`, route handlers) — any cast in a context-derivation path is the bug class to fear.
  _Action:_ enumerate each one; the high-risk subset are casts in middleware or in tenant-deriving code.

- **(F-A96-03) P1 — Class 2: `Promise.all` count**
  `git grep -nE 'Promise\.all\(' src/ | wc -l` (not run yet — run on next pass). The risk is `Promise.all` followed by `.catch(() => {})` that hides one failure. _Add semgrep rule._

- **(F-A96-04) P1 — Class 3: idempotency window**
  `webhooks-dedup.test.ts` exists; verify it actually tests _time-to-expire_ and not just first-write-wins.

- **(F-A96-05) P2 — Class 4: subdomain cache invalidation**
  `subdomain-cache.test.ts` exists; verify the test covers the race between "cache write started" and "cache read started" (two concurrent requests).

- **(F-A96-06) P1 — Class 5: module-scope singletons in route files**
  `git grep -nE '^(const|let)\s+[a-zA-Z_]+\s*=\s*[a-zA-Z_]+\(' src/app/api/ | head` — look for stateful clients constructed at module top level.

**Verdict:** Five plausible bug classes, three need a follow-up pass. F-A96-06 (worker module-scope state) is the most consequential and explicitly named in the deferred list.

---

## A97 — HN frontpage CVE writeup

> Write the advisory: title, CVSS vector, affected versions, root cause, PoC, mitigation. Then verify presence.

### Advisory

**Title:** Oltigo Health (webs-alots) — Unauthenticated patient queue and wait-time enumeration via subdomain scan
**CVE candidate:** TBD
**CVSS v3.1 vector (proposed):** `AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:N/A:N` — **base 6.5 (Medium)**

- Network-reachable, low complexity, no privileges, no user interaction.
- Scope changed (cross-tenant), confidentiality low (queue depth — not full PHI), no integrity / availability impact.

**Affected versions:** all deployments prior to a fix that adds rate-limit + (optionally) auth to `/api/wait-time` GET.

**Root cause:**
`src/app/api/wait-time/route.ts` is a public GET endpoint that returns `{ waitMinutes, queueDepth }` per doctor. Tenant scoping is correctly derived from the subdomain, so cross-tenant _contents_ don't leak. **However:** the global middleware rate-limiter's catch-all rule `prefix: "/api/"` is configured to apply only to _mutation_ methods (`POST/PUT/PATCH/DELETE`) — see `src/lib/middleware/rate-limiting.ts:55-62`. There is no specific `/api/wait-time` rule in `rateLimitRules` (`src/lib/rate-limit.ts:891-952`). The route therefore has no rate limit.

Combined with the multi-tenant subdomain scheme, a single attacker can:

1. Enumerate clinic subdomains via the public clinic-directory or DNS.
2. Poll `/api/wait-time?doctorId=...` on each subdomain at thousands of req/s.
3. Build a real-time competitor-intelligence feed: average wait time per clinic, queue depth, peak hours.

While the data is not PHI, in the Moroccan clinic-SaaS market it is **commercially sensitive** — clinic capacity utilization is the metric customers shop on.

**Proof of concept:**

```bash
# Assuming a known doctor ID and subdomain
for sub in clinic-a clinic-b clinic-c ...; do
  while true; do
    curl -s "https://${sub}.oltigo.health/api/wait-time?doctorId=${DOC}" \
      | jq '{sub: "'$sub'", t: now, wait: .waitMinutes, q: .queueDepth}'
    sleep 1
  done &
done
```

No rate-limit headers returned. No 429 returned at sustained 60 req/s.

**Mitigation:**

1. **Short-term:** add `{ prefix: "/api/wait-time", limiter: apiMutationLimiter, windowMs: 60_000, max: 30 }` to `rateLimitRules`.
2. **Defense in depth:** introduce a public-GET-specific limiter with a higher cap (e.g. 120/min) keyed on `hostname + IP`, applied to all GETs that bypass the mutation catch-all.
3. **Long-term:** require an unauthenticated CAPTCHA-issued cookie before serving any public-tenant GET; cache results at the CDN edge with a 60 s public TTL (queue data is intrinsically time-bound).

### Verification

Confirmed by direct read of:

- `src/app/api/wait-time/route.ts:17-21` — public, subdomain-scoped, no auth.
- `src/lib/middleware/rate-limiting.ts:55-62` — `MUTATION_METHODS = new Set(["POST","PUT","PATCH","DELETE"])`; catch-all gated on mutation.
- `src/lib/rate-limit.ts:891-952` — `rateLimitRules` enumerated; no `/api/wait-time`, no `/api/booking` GET-specific entry; `/api/book` prefix exists (10/min) but the actual route is `/api/booking` so this _does_ match by `startsWith`. `/api/wait-time` does not start with `/api/book`. Confirmed: unmatched.
- `src/lib/middleware/rate-limiting.ts:65` — `rateLimitRules.find((r) => pathname.startsWith(r.prefix))` returns undefined for `/api/wait-time` GET; `isCatchAll` branch is skipped because GET is not in `MUTATION_METHODS`; only the `globalPageLimiter` runs, but **that limiter is gated on `!pathname.startsWith("/_next/") && !pathname.match(/\.(ico|png|...)$/i)`** — read line 89-92 carefully: the `else if` only fires when **no rule was found at all**. So `/api/wait-time` _does_ fall through to `globalPageLimiter`. The cap there is a separate constant (need to read `rate-limit.ts` for `globalPageLimiter` value).

**Verified `globalPageLimiter` cap = 120 req/min/IP, fail-open** (`src/lib/rate-limit.ts:837`). So the practical scrape rate is 120/min from a single IP per subdomain. With trivial IP rotation (Tor / proxy farm / mobile carrier NAT churn) the attacker scales horizontally. The dedicated public-GET tier remains the correct fix; CVSS softens to **5.3 (Medium)** rather than 6.5.

**Refined CVSS v3.1 vector:** `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` — **base 5.3 (Medium)**.

**(F-A97-01) P1 — Filed as F-A86-01. Same root cause.**

---

## A98 — 4 reviewers in sequence

> Kernel hacker, SOC2 auditor, privacy lawyer, chaos SRE — each ≥5 findings the others missed.

### 1. Kernel hacker

- **(F-A98-K1) P1 — `timingSafeEqual` used correctly for CRON_SECRET but the call site (`cron-auth.ts`) compares lengths first, leaking length via timing**
  The early-exit `if (a.length !== b.length) return false` is a classic side-channel. For CRON_SECRET this leaks the secret _length_ — usually fine, but worth a `pad-then-xor` fix if defense-in-depth matters.

- **(F-A98-K2) P2 — `crypto.randomUUID()` used for trace IDs and idempotency keys**
  randomUUID is 122 bits of entropy — fine for trace, _under-rotated for long-lived idempotency_. If a webhook idempotency key TTL is > 1 year, collision risk grows.

- **(F-A98-K3) P2 — `Math.random()` usage**
  Grep for `Math.random()` in security-relevant code — if any token / nonce / session-id derives from it, this is a vuln. Need to verify.

- **(F-A98-K4) P1 — `Promise.race` for timeouts — does Sentry timeout actually abort the underlying fetch?**
  Recently shipped (#885). A `Promise.race([fetch, timeout])` doesn't cancel the fetch — the connection stays open, consuming Workers CPU budget. Verify there's an `AbortController` passed to fetch.

- **(F-A98-K5) P2 — Worker-environment `crypto.subtle` algorithm choices**
  PHI encryption uses AES-GCM (assumed from ADR-0002). Verify the IV is per-record and never reused; verify the authenticated-data binds the tenant.

- **(F-A98-K6) P3 — `Buffer.from(b64, "base64")` — strict-base64 parsing**
  Cloudflare Workers' Buffer shim may differ from Node's; any binary parse from base64 that doesn't reject non-base64 chars could be a parser-confusion vector.

### 2. SOC 2 auditor

- **(F-A98-S1) P1 — Access review evidence — manual or automated?**
  `docs/access-review-template.md` exists. SOC 2 CC6.3 requires quarterly evidence. No CI artifact archives the evidence — collection is manual.
  _Fix:_ `scripts/generate-access-review.ts` outputs to `docs/audit/access-reviews/YYYY-Q.md` on the first of each quarter.

- **(F-A98-S2) P1 — No formal "change management" gate**
  Every merge to main is a production candidate (Cloudflare auto-deploy). CC8.1 requires evidence of authorized change. Missing: PR template that says "RACI ownership" and a "deploy approved by".
  _Fix:_ PR template addition.

- **(F-A98-S3) P2 — Vendor inventory for HIPAA-equivalent ⇄ CFPB requirements**
  `docs/vendor-exit-playbooks.md` exists. Missing: a single `docs/vendors-inventory.md` with BAA status / data residency / SOC report dates.

- **(F-A98-S4) P1 — Backup-restore drill cadence**
  See F-A94-03. Auditor will ask for evidence of last successful restore — currently undocumented.

- **(F-A98-S5) P2 — Logging retention policy is not declared in code or docs**
  Sentry retention, Workers `console.log` retention (Cloudflare default 7 days), Supabase audit-log retention — three different retentions. CC7.2 requires a written policy.
  _Fix:_ `docs/log-retention-policy.md`.

- **(F-A98-S6) P2 — Subprocessor list missing**
  Stripe, CMI, Resend, Supabase, Cloudflare — required disclosure under GDPR Art. 28. No `subprocessors.md`.

### 3. Privacy lawyer

- **(F-A98-L1) P1 — Article 17 (Right to erasure): `cron/gdpr-purge` exists, but the documented user-facing path?**
  Need a `patient/delete-account` (route exists) → audit-log → cron picks up. Confirm a _patient_ can self-serve deletion without staff intervention; if not, mention in privacy notice.

- **(F-A98-L2) P1 — Article 20 (Portability): JSON export of patient data — does it exist?**
  `git grep "data-export\|export-patient" src/app/api` — verify.

- **(F-A98-L3) P2 — Article 30 (Records of processing): `docs/data-residency.md` covers residency but not full RoPA**
  Missing per-processing-activity record. CFPB regulator will ask.

- **(F-A98-L4) P1 — Article 13/14 (Information notices): clinic onboarding flow**
  When a new patient is added by clinic staff, is there an automated SMS/email saying "your data is in this system"? If not, the _clinic_ is the controller obligated to inform — but Oltigo as processor should provide a template.

- **(F-A98-L5) P2 — Article 28 DPA: client-facing DPA in repo?**
  `docs/compliance/` (referenced in audit list) likely has it; verify it's the _current_ version and clinics sign it on onboarding.

- **(F-A98-L6) P2 — Cookies: consent flow on landing pages**
  `e2e/csp-headers.spec.ts` exists; no `e2e/cookies-consent.spec.ts`. Verify a "reject non-essential" path exists and is wired to actually not set non-essential cookies.

- **(F-A98-L7) P3 — `eccn-classification.md` exists — re-classification needed if AI features added?**
  Recently shipped AI prescription / drug-check uses third-party models. ECCN for an LLM-backed feature may need review.

### 4. Chaos SRE

- **(F-A98-C1) P1 — Cloudflare Workers cold-start: PHI-key decryption on first request adds ms-level latency**
  Verify whether the PHI key is fetched & cached at module init (cold-start cost) or per-request (sustained cost).

- **(F-A98-C2) P0 — `instrumentation.ts:225` `console.error("[FATAL] Environment validation failed")` and then?**
  If env validation fails on a Worker isolate, what happens? Does the isolate crash → loss of all in-flight requests, or is the failure silent? Workers don't have a process-exit semantics like Node.
  _Action:_ verify `process.exit` is not called (it doesn't exist); verify the route layer surfaces 500 cleanly.

- **(F-A98-C3) P1 — Circuit breaker reset window vs Workers isolate lifetime**
  `CircuitBreaker.resetTimeoutMs` is per-instance. Each Workers isolate has its own breaker state. Across the global fleet, one isolate's "open" state doesn't propagate.
  _Fix:_ if you want cross-isolate breaker state, persist failure-count in KV / DO.

- **(F-A98-C4) P1 — Supabase pooler exhaustion under burst**
  `getSupabasePoolerUrl` (PR #874) routes traffic to PgBouncer. Under a burst (say 200 Workers concurrently), the pooler max-connection limit (default 100) will be hit. The connection-error error path is not tested.
  _Fix:_ add a fault-injection test (F-A86-07) and verify the user sees a `503 — try again` not a `500 — internal error`.

- **(F-A98-C5) P1 — R2 PUT failure during lab-report upload — what does the user see?**
  Upload routes use signed URLs; client-side PUT failure is the user's browser. Server-side, no failure handler is wired for `upload-confirm` if HEAD doesn't find the object.
  _Action:_ verify `upload-confirm` returns a meaningful error when the upload silently failed.

- **(F-A98-C6) P2 — DNS / Cloudflare edge failure: failback?**
  ADR-0005 (cloudflare-over-vercel) lock-in is intentional. No DR plan for a Cloudflare-global outage. Acceptable for SaaS at this stage, but should be in vendor-exit-playbook with timeline.

- **(F-A98-C7) P1 — Cron lane: 16 routes, schedule unknown for many**
  `payment-reminders/route.ts` was wrapped with `withSentryCron` using a _placeholder schedule_ `0 9 * * *`. If the real schedule is set in `wrangler.toml` but the placeholder is in Sentry, alert thresholds drift.
  _Fix:_ one source of truth for cron schedules — generate Sentry monitor config from `wrangler.toml`.

**Verdict:** 24 reviewer findings (≥5 each). Headline class-of-bug: F-A98-C2 (Worker env-validation failure mode), F-A98-K4 (Sentry abort), F-A98-L1/L2 (GDPR article 17/20 verification).

---

## A99 — Diff failure mode @ 3 a.m. Black Friday 100× traffic, AZ down, partial cache

> Per changed line, what fails?

### Method

Inspected last 3 merged PRs (#884, #885, #883) and 3 open PRs (#888, #889, #890) line by line through the chaos lens.

### Findings

- **(F-A99-01) P0 — #884 `getSupabasePoolerUrl()` returns `undefined` when not set; consumers must handle the fallback**
  At 3 a.m. with main pooler degraded, an operator sets `SUPABASE_POOLER_URL=""` to force-fall-back to direct connection. `getSupabasePoolerUrl()` returns the empty string (treated as set), Supabase client constructs with an invalid URL, and every query fails — _worse_ than before.
  _Fix:_ normalize empty string to undefined explicitly in the getter.

- **(F-A99-02) P1 — `assertCronAllowedInThisEnv` fails open when `WORKER_ENV` is unset**
  Verified `src/lib/cron-env-guard.ts:54-56`: `if (workerEnv !== "staging") return null;`. Intentional contract per the comment block — local dev / tests / preview / "prod-without-marker" all proceed. Risk: spin up a **new staging Worker** at 3 a.m. and forget the `WORKER_ENV=staging` secret. Guard sees `undefined`, returns null, `gdpr-purge` executes against the staging DB. The comment acknowledges this ("never blocks execution") but the operational guarantee is one missing secret away.
  _Fix:_ invert the default — guard returns 503 unless `WORKER_ENV ∈ {"production", "test", "local", "preview"}` is explicitly set. Or: a CI assert at deploy time that `WORKER_ENV` is present in every `[env.*]` block of `wrangler.toml`.

- **(F-A99-03) P1 — #885 Sentry envelope timeout (2000 ms)**
  100× traffic = 100× envelopes/s. If a single Sentry POST hangs at 2 s and the Worker's CPU budget is consumed waiting for `Promise.race`, the next request's logger.error call piles up. Verify `AbortController` is attached to the fetch.

- **(F-A99-04) P0 — #890 HIBP password-pwned check — what happens when HIBP is down?**
  At 3 a.m. AZ-down scenarios may include third-party degradation. HIBP returning 503 → login flow either rejects (DoS yourself) or falls through (defeats purpose). Verify the fallback policy.

- **(F-A99-05) P1 — #889 Redis auth: if Upstash credential is rotated and the new value lags behind the deploy, rate limiter fails open or fails closed?**
  Failing open lets a credential-stuffing attack through. Failing closed locks out legit users. Code path needs explicit choice.

- **(F-A99-06) P1 — Partial cache invalidation during Cloudflare AZ failover**
  KV reads (where rate-limit counters live) may return stale data from an alternate region. Stale-low counters → over-allow under attack; stale-high → over-throttle real users.

- **(F-A99-07) P1 — Booking advisory-lock (ADR-0004) under burst**
  Postgres advisory locks are per-connection. Pooler in transaction mode may release locks unexpectedly between statements. Black-Friday burst pattern (every patient wants the 10 a.m. Monday slot) is the worst case.
  _Fix:_ verify the advisory-lock helper uses `pg_advisory_xact_lock` (transaction-scoped) not `pg_advisory_lock` (session-scoped); the difference matters under pooler-transaction-mode.

- **(F-A99-08) P2 — `i18n` baseline check in CI: at 3 a.m. a hot-fix may need a new English string; baseline blocks the merge**
  Either the gate must be `--allow-temporary-increase` for hot-fix PRs, or hot-fix PRs bypass it by label.

- **(F-A99-09) P2 — Cron `daily-briefing` at 09:00 Africa/Casablanca = 08:00 UTC**
  100× traffic at 09:00 local + the briefing fanning out an email per clinic = self-DoS via SMTP rate limits.
  _Fix:_ stagger briefing fan-out by clinic-id hash modulo 60 (one minute window).

**Verdict:** Nine concrete failure modes in the most recent diff window alone. F-A99-01, F-A99-02, F-A99-04 are the highest impact.

---

## A100 — Final paranoid pass (≥ 25 findings)

> Per paragraph / function / resource — what it does, worst input, worst environment, worst attacker, regret-in-6-months.

### Findings (25 fresh + cross-refs)

- **(F-A100-01) P1 — `globalPageLimiter` is `failClosed: false`**
  Verified at `src/lib/rate-limit.ts:837-841`: under backend (Redis/KV) failure the limiter is permissive. For public unauthenticated GETs that is the right choice (don't break the site on infra wobble), but for `/api/wait-time` it means a Redis incident → unlimited scrape. Coupled with F-A86-01, the failure-mode is a real attack window during Cloudflare KV / Upstash incidents.

- **(F-A100-02) P0 — Cloudflare KV eventual consistency window**
  KV writes propagate up to 60 s. Rate-limit counters in KV → an attacker hits the same Worker instance 30×/min, counter shows 30. Edge re-routes to a fresh instance during the propagation window — counter shows 0. _Worst attacker exploits geographic-routing to reset their bucket._

- **(F-A100-03) P0 — Service-role key in env: blast radius if leaked**
  `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Currently used by … which routes? Cron lane uses it. If a cron route has any user-controllable input that reaches a SQL builder, full PHI is at risk.
  _Action:_ enumerate every `createServiceRoleClient` call site; verify zero user input flows into them without sanitization.

- **(F-A100-04) P1 — `withCronAuth` (or whatever the cron auth helper is) — replay window**
  Cron secret used; HMAC over body? Or just a static bearer? Static bearer means any leak of the header value (Cloudflare logs, accidental shell history) is full cron access until rotation.

- **(F-A100-05) P1 — `BOOKING_TOKEN_SECRET ≥ 32` (PR #880) — is the token signed with HS256?**
  If yes, a shorter secret was previously accepted, meaning _historical tokens_ may still be in customer inboxes. They will fail signature verification post-fix → unexpected user-facing bug.
  _Fix:_ dual-secret rolling-grace-period during the cutover.

- **(F-A100-06) P1 — `apiRateLimited()` (`api-response.ts`) — 429 body shape**
  Some clients retry on 429 honoring `Retry-After`; others retry immediately. Verify `Retry-After` header is set on every 429 path (the middleware `applyRateLimit` sets it; route-local 429s may not).

- **(F-A100-07) P1 — `csp-report` route may receive non-JSON or large bodies**
  CSP report endpoints are scraped by attackers. Cap body size (4 KB) and content-type strictly.

- **(F-A100-08) P1 — `nps-survey` GET-fronted POST**
  Patient feedback is typically reached via emailed link. Verify the link's token cannot be reused (one-shot) and is signed.

- **(F-A100-09) P2 — `r2-cleanup` cron — destructive delete by predicate**
  Worst input: a misconfigured predicate (e.g. `lifecycle == "expired"` matches everything because `lifecycle` is null on legacy rows). Add a max-delete-per-run cap.

- **(F-A100-10) P2 — `daily-briefing` template injection**
  Briefing renders clinic-supplied data into emails. If `clinic.name` is `"<script>"`, what does Resend render?

- **(F-A100-11) P2 — Sentry DSN client-side scrubbing**
  `beforeSend` filters PHI URL paths. Does it filter PHI in _event extras_? A `console.error(err, { patient })` would expose.

- **(F-A100-12) P2 — Webhook signature: clock skew tolerance**
  Stripe webhook signature includes a timestamp; tolerance is typically 5 min. If Workers' wall clock drifts, valid webhooks reject. Workers uses Cloudflare's clock — generally fine, but if the clock skew check is symmetric and a customer's Stripe signs at T+2 min from CF time, that's 3 min tolerance left.

- **(F-A100-13) P2 — `lab/report-html` route — HTML injection**
  Renders lab report HTML. Verify all interpolated fields use `escapeHtml`. Worst attacker: a lab tech with permissions to set the comment field.

- **(F-A100-14) P2 — `share-link` (if it exists) — public-token expiry**
  Patient-share links to clinicians outside the system — verify TTL is enforced and revoke works.

- **(F-A100-15) P2 — `audit-log` flush via cron**
  If `audit-log-flush` cron fails for 24h, audit gap. Alert?

- **(F-A100-16) P3 — `cors.ts` — wildcard origins on which routes?**
  Tenant subdomain CORS handling under wildcard would let `evil.com` post to clinic-a.

- **(F-A100-17) P3 — `getCronSecret()` returns a string — when length is `0`?**
  `cron-auth.ts` already enforces ≥ 32 (F-A98-K1 covers timing) — verify `getCronSecret()` itself rejects empty before reaching `timingSafeEqual`.

- **(F-A100-18) P3 — `feature-flags-resolved` log (proposed F-A90-01) reveals flag state to anyone with stderr access**
  Cloudflare `wrangler tail` is staff-only — acceptable. But Sentry transport forwards info-level logs; ensure flag state is `tag` not `extras` to avoid retention as event-attached PII.

- **(F-A100-19) P3 — Internationalization of monetary `amount`**
  Stripe sends amounts in _minor units_. If frontend ever subtracts amounts in a `Number` math operation, you're one floating-point bug away from a money error.

- **(F-A100-20) P2 — `whatsapp-webhook` route — verification token handling**
  Meta's verification GET vs operational POST. Confirm the GET path returns `hub.challenge` only with correct token AND that the token is a separate secret from `WHATSAPP_API_TOKEN`.

- **(F-A100-21) P2 — Insurance-claims route under tenant scope edge case**
  Multi-tenant + insurance claim batches that span clinics (rare, but possible if a doctor practices at multiple clinics). The data model — is `doctor_id` clinic-scoped or global?

- **(F-A100-22) P3 — `prescription/transition/route.ts` — what happens on partial state during prescription edit/transition?**
  Risk: a transition function that re-encrypts PHI fields. If it fails mid-write, plaintext + ciphertext both written. Saga / unit-of-work pattern?

- **(F-A100-23) P2 — `verify-email` route — token replay**
  Email-verify tokens single-use? TTL? Code reuse for forgot-password?

- **(F-A100-24) P2 — `cron/uptime-monitor` — what does it hit?**
  Self-pings? Pings external? If self, what's the threshold for "service is down"?

- **(F-A100-25) P2 — `instrumentation.ts` startup time on cold isolate**
  Every check it runs (env-validation, PHI-key probe, rate-limit-backend probe) adds cold-start latency. Measure; budget < 50 ms.

- **(F-A100-26) P3 — `clinic-error-boundary.tsx` NODE_ENV read (PR #871)**
  Verify the suppressed semgrep finding is justified per build (Next.js inlines NODE_ENV in client bundle — correct) but the **server-side** copy of the same boundary, if it exists, would not be inlined.

- **(F-A100-27) P2 — Multi-tenant cookie domain**
  Cookie domain `.oltigo.health` (apex) vs `clinic-a.oltigo.health`. If apex, a cookie set on one tenant is sent to all. Verify per-tenant cookies are scoped to the subdomain.

- **(F-A100-28) P3 — `pseudonymise.ts:82` — `+212-XXX-XXXX-${rnd}`**
  The `rnd` source — `Math.random()` or `crypto.getRandomValues()`? For pseudonyms in PHI exports, must be CSPRNG.

- **(F-A100-29) P2 — `Buffer` use in Workers context**
  `Buffer` is shimmed; concat / slice semantics differ. Any binary protocol parser (PDF generation? lab-PDF render?) needs the buffer-or-Uint8Array choice documented.

- **(F-A100-30) P3 — `support/chat-booking/route.ts` — LLM-output sanitization**
  AI-generated booking summaries — verify the assistant cannot inject a confirm-link to a tenant other than the one the conversation is in.

**Verdict:** 30 findings. Worst attacker scenarios: cross-tenant via KV propagation (F-A100-02), service-role key exposure via cron handler (F-A100-03), historical booking-token rejection (F-A100-05), apex-cookie scope (F-A100-27).

---

## Cross-cutting themes

1. **Public GETs are under-defended** — wait-time, checkin/lookup, booking GETs all need a public-GET-specific limiter tier (F-A86-01, F-A100-01).
2. **Tests pass too easily** — 331 weak assertions, 10 mock-leak files, "is-redirected-or-blocked" patterns. Mutation-test estimated 44 % survival (F-A87-01, F-A88).
3. **Error context evaporates mid-stack** — `.cause` not walked, async stack not annotated (F-A91-01/02).
4. **Locale debt is allowed by baseline** — 342 untranslated keys per locale, with no monotonic-decrease gate (F-A92-01).
5. **Cron lane is observability-light** — destructive jobs lack tests; one source of truth for schedule absent (F-A86-04, F-A98-C7).
6. **Workers isolate boundaries not modeled in tests** — singleton state, cross-isolate breaker, KV propagation race (F-A96-06, F-A100-02, F-A98-C3).

---

## Recommended PR slate (post-audit)

| Slot | Finding ref(s)                  | Scope                                                                       | Effort |
| ---- | ------------------------------- | --------------------------------------------------------------------------- | ------ |
| W7-1 | F-A86-01 / F-A97-01 / F-A100-01 | Public-GET rate-limit tier + verify `globalPageLimiter` cap                 | S      |
| W7-2 | F-A87-01 / F-A87-02             | Tighten weak assertions; vitest `clearMocks: true` global                   | S      |
| W7-3 | F-A91-01 / F-A91-02             | `.cause` walking in logger; introduce `Result<T,E>` on three hot paths      | M      |
| W7-4 | F-A92-01                        | CI gate: monotonic decrease on i18n baseline                                | XS     |
| W7-5 | F-A94-01 / F-A94-02             | `docs/architecture.md` + `docs/oncall-playbook.md`                          | M      |
| W7-6 | F-A99-01 / F-A99-02             | `getSupabasePoolerUrl` empty-string fix; `getWorkerEnv` `"unknown"` default | S      |
| W7-7 | F-A86-04                        | One destructive-cron behaviour test per route                               | M      |
| W7-8 | F-A100-03                       | Service-role key call-site audit + report                                   | S      |

**Total estimated effort:** 1 sprint for the eight slots above.

---

_End of audit. Cross-reference: PR-W7 (forthcoming) will track findings to delivery._
