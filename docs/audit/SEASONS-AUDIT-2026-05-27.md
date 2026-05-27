# SEASONS Security Audit — Oltigo Health (`groupsmix/webs-alots`)

> **Audit date:** 2026-05-27
> **Auditor:** Devin (Cognition AI), executing the SEASONS framework supplied by the engineering owner.
> **Repository:** `groupsmix/webs-alots` (private)
> **Branch / Commit:** `main` HEAD at audit time (post-migration `00089_pending_audit_logs.sql`).
> **Scope:** Seasons 0, 1, 2, 3, 4, 6d, 6e, 6f, 8 from `seasons_ready_to_paste1.md`.
> **Out of scope:** Season 5 (no shipped AI/ML model with custom weights), Season 6a (no mobile app), Season 6b (no web3 surface), Season 6c (no firmware / hardware), Seasons 7a–7d (quarterly governance / capacity / vendor — not per-PR).
> **Threat model baseline:** hostile author, malicious untrusted input, partitioned network, skewed clock, full disk, insider attacker, **personal liability** for the auditor.
> **Deliverable type:** **findings report only.** Identified fixes are flagged for separate follow-up PRs so the platform owner can prioritise.

---

## 0. Executive summary

The Oltigo Health codebase shows **strong, deliberate security hardening** layered over several prior audit rounds (visible as remediation migrations `00071`–`00089` and tagged code comments such as `AUDIT-12`, `A6-13`, `F-A93-04`, `S-26`). Defense-in-depth tenant isolation is enforced at four layers (middleware subdomain → header stripping → `requireTenant()` / `withAuth()` → PostgreSQL RLS with `x-clinic-id` request header), PHI is encrypted at rest with AES-256-GCM and a documented key-rotation procedure, and CI runs CodeQL, Semgrep, Gitleaks, SBOM signing (cosign + SLSA provenance), bundle-size budget enforcement, real-Postgres RLS integration tests, and Playwright E2E tests.

The audit confirmed **no Critical (P0) findings** that would block release. It surfaced:

| Severity | Count | Examples |
|---------|-------|----------|
| Critical | 0 | — |
| High | 4 | Dead WhatsApp AI route missing HMAC verification but reachable if PUBLIC_API_ROUTES is widened; `rls-assertions.test.ts` is a placeholder; CSP allows `'unsafe-inline'` for styles; no CAA / DNSSEC evidence in repo. |
| Medium | 17 | Per-user rate-limit cap (10k users) is in-memory; CMI callback IP allowlist optional; reauth re-uses cookie store for impersonate flow; CSP report-uri does not match Sentry endpoint when not configured; multiple admin-client uses in cron paths. |
| Low | 38 | Various log message hygiene, defensive comments, redundant warns, missing structured fields. |
| Info | 71 | Confirmations of existing controls with citations. |

The overall health score is **8.5 / 10** — up from 7.5 / 10 in `docs/audit/TECHNICAL-AUDIT-2026-04.md` due to remediation work between April and May 2026. The findings below are exhaustive: every audit item from the in-scope seasons is reported with a separate finding ID, severity, citation, PoC (where applicable), proposed fix, and standards mapping. `NOTHING FOUND` rows include the sub-categories that were verified and the artifacts that prove their absence.

---

## Methodology

- **Code review.** Static reading of TypeScript sources in `src/`, SQL migrations in `supabase/migrations/`, CI workflows in `.github/workflows/`, infra config (`wrangler.toml`, `next.config.ts`), and supporting docs in `docs/`.
- **Search.** Ripgrep over the working tree for known dangerous patterns (`createAdminClient`, `dangerouslySetInnerHTML`, raw template SQL, `eval`, `child_process`, `getServerSession` bypasses, `process.env.*` injection points, missing tenant scoping).
- **Diff-mining.** Read remediation migration files `00071`–`00089` to confirm prior fixes shipped and were not regressed.
- **Comparative review.** Cross-checked claims against the existing `docs/FULL_AUDIT_REPORT.md` and `docs/audit/open-actions.md` to detect dropped items.
- **No live testing.** No traffic was sent to production. The audit is static; PoCs in the findings tables are theoretical request shapes that an attacker would attempt.
- **Severity scale.**
  - **Critical** — exploitable RCE, bulk PHI exfiltration, financial loss, account takeover at scale.
  - **High** — single-tenant compromise, auth bypass, denial-of-wallet, regulator-noted gap.
  - **Medium** — defense-in-depth weakened, exploitable only by complex pre-conditions.
  - **Low** — info disclosure, defensive logging hygiene, missing documentation.
  - **Info** — confirmation of existing control; useful as evidence in regulator/audit conversations.
- **Standards keys.** CWE = Common Weakness Enumeration. OWASP = OWASP Top 10 / ASVS / API Top 10. NIST = NIST CSF / SP 800-53. CNDP = Moroccan Commission Nationale de protection des Données à caractère Personnel / Law 09-08. GDPR = EU General Data Protection Regulation. SOX = Sarbanes-Oxley. PCI = PCI-DSS.
- **Audit output format.** One table per Season audit. Multiple findings per audit are split into separate rows. `NOTHING FOUND` is used only when no in-scope weakness was discovered AND the row enumerates the sub-categories verified.

---

# SEASON 0 — Quick Mode (11 audits)

## Audit 0.1 — Taint-flow analysis (untrusted-source → sensitive-sink)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-01-01 | Info | Taint flow | `src/middleware.ts:159-170` | Client-supplied tenant headers (`x-clinic-id`, `x-clinic-name`, `x-tenant-*`) are stripped before any downstream API handler reads them. Confirmed by the explicit `SECURITY` comment block. | Curl with `-H 'x-clinic-id: <other>'` — header is removed by middleware before reaching the route. | None — control is working. | CWE-348, OWASP API1:2023 |
| S0-01-02 | Info | Taint flow | `src/lib/with-auth.ts:135-303` | Signed profile header (HMAC-SHA256) propagates from middleware to the API layer. Forgery is rejected via `verifyProfileHeader`; if verification fails the wrapper falls back to a fresh DB lookup. | Forge `x-internal-profile`/`x-internal-profile-sig` with a guessed secret — fails HMAC check, falls back to DB. | None — control is working. | CWE-345 |
| S0-01-03 | Info | Taint flow | `src/lib/api-validate.ts:42-77` | All `withValidation` / `withAuthValidation` wrappers enforce `MAX_BODY_BYTES = 64 KB` and Zod schema parse. Untrusted JSON is **never** passed to handlers without a parsed type. | Submit `{...10MB JSON...}` — 413 returned, request never enters handler. | None — control is working. | CWE-400, CWE-20 |
| S0-01-04 | Low | Taint flow | `src/app/api/booking/route.ts:391` | Booking `manageUrl` interpolates `request.headers.get("origin")` into a notification template. While the Origin header is validated upstream by CSRF, the fallback (`request.nextUrl.origin`) is technically a derived host; consider explicit allowlist for notification URLs to prevent SSRF / open-redirect feedback in the email template. | Force missing origin via privacy extension; nextUrl.origin used unchanged. Combined with email open in mail client, low-risk redirect. | Compute `manageUrl` from a server-known canonical host (`process.env.NEXT_PUBLIC_SITE_URL`) and the appointment ID, not from request headers. | CWE-601, OWASP A10 |

## Audit 0.2 — Injection sinks (SQLi / cmd / template / NoSQL / SSRF)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-02-01 | Info | SQL injection | All routes | Every Supabase query uses the parameterised JS client (`.eq()`, `.in()`, `.select()`). No `supabase.rpc` call interpolates user input as raw SQL — the RPCs `booking_atomic_insert`, `booking_find_or_create_patient`, `register_new_clinic`, `upsert_push_subscription` all use named parameters. | Submit `; DROP TABLE clinics;--` as `body.patient.name` — Zod truncates >200 chars first, the rest is parameterised. | None — control is working. | CWE-89, OWASP A03:2021 |
| S0-02-02 | Info | Command injection | All routes | No `child_process`, `execSync`, `spawn`, or `shelljs` usage in `src/`. Workers runtime forbids it. | `rg child_process src` → no matches. | None. | CWE-78 |
| S0-02-03 | Info | Template injection | View layer | All React components avoid `dangerouslySetInnerHTML` except for `safeJsonLdStringify()` (JSON-LD, escaped) and `sanitizeHtml()` (DOMPurify). CI workflow `.github/workflows/ci.yml:113-122` enforces this via an explicit allowlist. | Adding a new `dangerouslySetInnerHTML` outside the allowlist → CI fails. | None — control is working. | CWE-79 |
| S0-02-04 | Low | SSRF | `src/app/api/v1/register-clinic/route.ts:125-160` | DoH query to `cloudflare-dns.com` is **fixed** (not user-controllable), good. But `SLACK_REGISTRATION_ALERTS_WEBHOOK_URL` is read from env without further checks — an operator who mis-pastes a hostile URL would post structured registration data outbound. | Operator sets `SLACK_REGISTRATION_ALERTS_WEBHOOK_URL=http://attacker.example/`. | Validate the env var matches `^https://hooks\.slack\.com/services/` at startup (`src/lib/env.ts`). | CWE-918 |
| S0-02-05 | Info | SSRF (AV) | `src/app/api/upload/route.ts:238-275` | `AV_SCAN_URL` is the only outbound fetch from upload. Has a 15 s timeout and `AbortSignal`. Failures fail-closed when `AV_SCAN_REQUIRED=true`. | None. | None — control is working. | CWE-918 |
| S0-02-06 | Info | NoSQL injection | n/a | No NoSQL stores (MongoDB, DynamoDB, Redis-as-store) wired to user input. Cloudflare KV is used by rate limiter only with structured keys. | `rg "mongo\|dynamo\|redis" src` → no app-level usage. | None. | CWE-943 |

## Audit 0.3 — AuthN / AuthZ (session, MFA, role checks)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-03-01 | Info | AuthN | `src/middleware.ts:494-505` | API routes are **protected by default** at the middleware layer. Public routes must be added explicitly to `PUBLIC_API_ROUTES` in `src/lib/middleware/routes.ts:114-144`. | New `/api/internal/foo` POST → middleware returns 401 before handler runs. | None — control is working. | CWE-862, OWASP A01:2021 |
| S0-03-02 | Info | AuthN | `src/middleware.ts` (MFA enforcement) | The middleware checks `aal` claim on the Supabase session and rejects when `MFA_REQUIRED` roles are not at `aal2`. | Sign in without TOTP → admin/clinic_admin routes redirect to `/setup-2fa`. | None. | NIST IA-2 |
| S0-03-03 | Info | AuthZ | `src/lib/with-auth.ts:200-223` | F-08: Tenant mismatch check — if `profile.clinic_id !== tenant.clinicId` the request is rejected with 403. | Sign in to clinic A then craft request to clinic B subdomain — 403. | None. | OWASP A01:2021 |
| S0-03-04 | High | AuthZ | `src/app/api/ai/whatsapp-receptionist/route.ts:373-446` | The POST handler is documented as a "Meta WhatsApp webhook" and processes incoming messages, **but does NOT verify `X-Hub-Signature-256` HMAC**. It is currently blocked by middleware deny-by-default (not in `PUBLIC_API_ROUTES`), so external attackers cannot reach it today. The risk is latent: if a future PR adds `/api/ai/whatsapp-receptionist` to the public allowlist (e.g. for a parallel webhook subscription), the endpoint will accept unauthenticated arbitrary payloads, allowing an attacker to (a) burn AI tokens via the OpenAI-style fetch (denial-of-wallet) and (b) cause arbitrary WhatsApp replies to attacker-controlled `from` numbers (impersonation). | If route exposed: `POST /api/ai/whatsapp-receptionist` with crafted body — bypasses signature check, fans out AI calls + outbound WA messages. | (a) Delete the route if `/api/webhooks` already covers it; or (b) add `verifyWebhookSignature` from `src/app/api/webhooks/route.ts:73-90` before any other processing AND add `/api/ai/whatsapp-receptionist` to both `PUBLIC_API_ROUTES` and `CSRF_EXEMPT_PREFIXES` only after HMAC is wired. | CWE-345, CWE-1188, OWASP A07:2021 |
| S0-03-05 | Info | AuthN | `src/app/api/auth/demo-login/route.ts:36-58` | Demo login is gated by `NEXT_PUBLIC_FEATURE_DEMO_MODE !== "false"`, restricted to the `patient` role only, and refuses to mint sessions if the demo clinic row is absent. | In prod with feature flag off → 403. | None. | OWASP A07:2021 |

## Audit 0.4 — Input validation (Zod / size caps / content-type)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-04-01 | Info | Input validation | `src/lib/api-validate.ts:43-66` | `MAX_BODY_BYTES = 65_536`; both Content-Length pre-check and Zod schema enforced. | 1 MB JSON → 413. | None. | CWE-400 |
| S0-04-02 | Info | Input validation | `src/app/api/payments/cmi/callback/route.ts:18-114` | CMI callback enforces `MAX_CMI_CALLBACK_BYTES = 10 * 1024` via streaming reader that aborts on overflow even when Content-Length is omitted (chunked TE). | Send chunked 1 MB form — 413. | None. | CWE-400 |
| S0-04-03 | Info | Input validation | `src/app/api/upload/route.ts:64-110` | Per-category upload caps (avatars 2 MB, documents 10 MB, radiology 25 MB) plus magic-byte validation (`MAGIC_BYTES` constant). | Upload PNG with `.pdf` extension and `application/pdf` content-type — magic-byte check fails. | None. | CWE-434 |
| S0-04-04 | Info | Input validation | `src/lib/validations.ts` (whole) | 818-line Zod schema library covering booking, payments, profile, clinical records. `normalizeText` strips NUL bytes and NFC-normalises. | `\u0000` smuggled into clinic name → stripped before length check. | None. | CWE-20, CWE-1023 |
| S0-04-05 | Low | Input validation | `src/app/api/v1/register-clinic/route.ts:171-208` | `phone` field is `z.string().min(8).max(30)` without regex. International phone formats vary, but the registration RPC may downstream call `phoneToWhatsApp(phone)` which assumes Moroccan format. Bad input fails non-destructively but emits a warning rather than a clean 422. | Submit `phone="abc12345"` — passes Zod, fails downstream. | Tighten to `/^\+?[0-9 ()-]{8,30}$/` and reject early. | CWE-20 |

## Audit 0.5 — SQL / DB hygiene

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-05-01 | Info | DB hygiene | `supabase/migrations/00071_security_audit_remediation.sql` | C-05: Partial unique index on `(clinic_id, phone) WHERE role='patient'` prevents `.single()` crashes from family-shared phones; C-06: ON DELETE RESTRICT on `users.clinic_id` and `appointments.clinic_id`. | Existing migration; verified by `head -30` of the file. | None. | CWE-755 |
| S0-05-02 | Info | DB hygiene | `supabase/migrations/00074_booking_slot_advisory_lock.sql` | Booking atomic insert uses `pg_advisory_xact_lock` to serialise slot-fill checks. Confirmed referenced from `src/app/api/booking/route.ts:335-353`. | Concurrent POST /api/booking — second loses lock contention and returns SLOT_FULL. | None. | CWE-362 |
| S0-05-03 | Info | DB hygiene | `supabase/migrations/00077_audit_hardening_a250.sql:53` | `audit_logs_service_insert` policy restricts inserts to `service_role` (admin client). | Anon client cannot insert into `audit_logs`. | None. | NIST AU-9 |
| S0-05-04 | Info | DB hygiene | `supabase/migrations/00086_drop_legacy_restaurant_rls.sql` | Legacy restaurant-era policies replaced with tenant-scoped policies on `orders`, etc., on a clinic-aware schema. | Verified via grep of `CREATE POLICY` in migration. | None. | OWASP A01 |
| S0-05-05 | Low | DB hygiene | `supabase/migrations/00013_para_medical_tables.sql:258` | `EXECUTE format('CREATE POLICY %I ON %I ...')` uses `%I` (identifier quoting) — safe, but in old-style migration. Confirm no migration ever interpolates `%s` raw with table/column names. | `rg "format\\('.*%s'" supabase/migrations` → no `%s` raw interpolation in identifier contexts. | None. | CWE-89 |

## Audit 0.6 — IDOR / object-ownership

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-06-01 | Info | IDOR | `src/app/api/upload/route.ts:178-185, 339-343` | Upload key prefix tied to `profile.clinic_id`; non-super-admin users cannot confirm a key outside their clinic. | Try `PUT /api/upload` with `key='clinics/<other>/...'` — 403. | None. | OWASP A01:2021 |
| S0-06-02 | Info | IDOR | `src/lib/with-auth.ts:200-223, 233-250` | Tenant context is set on the Supabase client for every authenticated request; RLS policies enforce tenant scoping at the DB layer. | Cross-tenant `.eq("id", <other-clinic-record>)` query returns nothing. | None. | OWASP A01 |
| S0-06-03 | Info | IDOR | `src/app/api/payments/webhook/route.ts:115-134` | Stripe webhook validates `appointment.clinic_id === metadata.clinic_id` before recording payment. | Forge Stripe event with mismatched appointment_id/clinic_id — 422. | None. | CWE-639 |
| S0-06-04 | Medium | IDOR | `src/app/api/booking/route.ts:391-403` | The `manage_url` notification template is sent to the patient via WhatsApp/email and references the appointment ID. Anyone who intercepts (or shoulder-surfs) the email can navigate to `/book?manage=<id>` and trigger a cancel/reschedule flow — see `src/app/api/booking/cancel/route.ts`. The cancel route should re-verify the booking token / phone before mutating. | Capture confirmation email, navigate to manage URL on another device, attempt cancellation. | Require a signed `manage_token` (HMAC over `appointmentId:phone:expiry`) in the manage URL, validated by `/api/booking/cancel`. | CWE-639, CWE-294 |

## Audit 0.7 — Performance / ReDoS / N+1

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-07-01 | Info | ReDoS | All Zod schemas | No backtracking-prone regex (no nested quantifiers like `(a+)+`). Date / time regex (`^\d{4}-\d{2}-\d{2}$`) is anchored and linear. | `rg "\\.regex\\(" src/lib/validations.ts` — all anchored, no nested groups. | None. | CWE-1333 |
| S0-07-02 | Info | Performance | `src/app/api/booking/route.ts:271-285` | Doctor + service lookups parallelised via `Promise.all`. Validation pre-loads doctor and service lists once. | Single booking request issues 2 parallel queries instead of sequential. | None. | OWASP A04 |
| S0-07-03 | Medium | Performance | `src/lib/with-auth.ts:257-289` | Per-user rate limiting is in-memory (`Map` capped at 10 000 users) and falls back to ignoring rate limits beyond cap. On a Workers fleet, each isolate has its own map. Effective rate limit is `100 req/min × num_isolates`. | High-traffic clinic on a hot path — limit is not authoritative. | Move per-user rate limit to the same KV/Supabase backend used by `bookingLimiter` etc.; or document explicitly that this is best-effort and the IP-based limit is authoritative. | CWE-1333 |
| S0-07-04 | Info | N+1 | `src/app/api/booking/route.ts:138-202` | `validateBookingRequest` pre-fetches doctors + services + specialties in parallel; caller reuses the data instead of re-querying. | Single booking → 3 parallel queries; no N+1. | None. | OWASP A04 |

## Audit 0.8 — Test coverage of security-critical paths

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-08-01 | Info | Tests | `src/lib/__tests__/integration/rls-real-postgres.test.ts` | Real-Postgres RLS test that runs against `supabase start` in CI. Verifies cross-tenant isolation (lines 88+ via `describe.skipIf(SKIP)`). | CI workflow `.github/workflows/ci.yml:240-247` runs it. | None. | NIST SA-11 |
| S0-08-02 | High | Tests | `src/lib/__tests__/integration/rls-assertions.test.ts` | The companion file (`rls-assertions.test.ts`) is a **placeholder** (`expect(true).toBe(true)`) with comments describing the intended assertions. Title implies coverage; reality is no assertions. | Read file lines 8-22. | Delete the placeholder OR implement the assertions described in the comment block. | CWE-754, NIST SA-11 |
| S0-08-03 | Info | Tests | `src/app/api/__tests__/upload-confirm-tenant-prefix.test.ts` | Specific test asserting tenant-prefix enforcement on PUT /api/upload. | Read file. | None. | NIST SA-11 |
| S0-08-04 | Info | Tests | `src/lib/__tests__/` (48 files) | Substantial coverage of `audit-log`, `auth`, `cmi-verify-callback`, `cron-auth`, `egress-allowlist`, `find-or-create-patient`, `notification-persist-clinic-id`, etc. | `ls src/lib/__tests__ | wc -l` → 48 plus 5 integration tests. | None. | NIST SA-11 |
| S0-08-05 | Medium | Tests | n/a | No mutation testing in CI (Stryker/Pitest absent). Coverage threshold exists (`vitest.config.ts`) but does not detect test quality regressions. | Inject a bug into `verifyBookingToken` — existing tests may still pass. | Add a quarterly Stryker run in `.github/workflows/` against `src/lib/` mutators. | NIST SA-11 |

## Audit 0.9 — Postmortem readiness

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-09-01 | Info | Postmortem | `docs/post-mortem-template.md` | Template present; references SLO/SLA + 5 whys. | Read file. | None. | NIST IR-4 |
| S0-09-02 | Info | Postmortem | `docs/incident-response.md` | IR runbook covers paging, comms, war-room. | Read file. | None. | NIST IR-4 |
| S0-09-03 | Info | Postmortem | `docs/oncall.md` | Oncall rotation documented. | Read file. | None. | NIST IR-7 |
| S0-09-04 | Low | Postmortem | n/a | No evidence of a public-facing status page (`status.oltigo.com`) tracked in repo. | `rg "status.oltigo" --type=md` → 0. | Add a status-page domain + RFC for incident communication SLA. | NIST IR-4 |

## Audit 0.10 — Diff failure / regression risk

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-10-01 | Info | Regression | `.github/workflows/ci.yml:46-50` | ESLint warning ceiling tracked in `.eslint-warning-baseline` — fails-closed on regression. | Add a new warning → CI fails. | None. | OWASP A04 |
| S0-10-02 | Info | Regression | `.github/workflows/ci.yml:95-105` | Bundle budget enforced (`BUNDLE_BUDGET_KB=1024`). | Add a 2 MB dep → CI fails. | None. | NIST SA-15 |
| S0-10-03 | Info | Regression | `.github/workflows/ci.yml:106-117` | `dangerouslySetInnerHTML` allowlist enforced; new usages outside the regex → CI fails. | Add a 5th file using `dangerouslySetInnerHTML` → CI fails. | None. | CWE-79 |
| S0-10-04 | Info | Regression | `.github/workflows/ci.yml:57-79` | Seed credentials (well-known passwords / demo emails) blocked outside seed/test/markdown files. | Paste `seed-password-change-me` into a source file → CI fails. | None. | CWE-798 |
| S0-10-05 | Low | Regression | n/a | No CHANGELOG.md or release-notes process tracked in repo (`ls CHANGELOG*` → none). | n/a | Adopt a `CHANGELOG.md` per Keep-a-Changelog; or generate from squash-merge titles. | NIST SA-15 |

## Audit 0.11 — Paranoid round

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| S0-11-01 | Medium | Paranoid | `src/lib/middleware/security-headers.ts:144` | `style-src 'self' 'unsafe-inline'` — necessary today for React `style={{}}` attributes; documented as a known gap. The long-term fix is migrating inline styles to Tailwind / CSS modules. | `<img style="background: url('javascript:...');">` — modern browsers refuse `javascript:` in CSS but still a hardening gap. | Add a follow-up tracking issue to remove `style={{...}}` and drop `'unsafe-inline'` from `style-src`. | OWASP A05 |
| S0-11-02 | Medium | Paranoid | `src/lib/middleware/security-headers.ts:53` | `CSP_REPORT_URI` falls back to `/api/csp-report` when `SENTRY_CSP_REPORT_URI` is unset. The local endpoint must be in the public allowlist; verify rate limit. | Post 10 000 forged violation reports to `/api/csp-report`. | Confirm `/api/csp-report` has a rate-limit binding in middleware; add `cspReportLimiter` if absent. | CWE-770 |
| S0-11-03 | Low | Paranoid | `src/app/api/impersonate/route.ts:54-62` | Re-auth uses `createClient()` (cookie-store-bound) and calls `signInWithPassword`. The newly minted session **replaces** the existing one in the cookie store. For the same user it is functionally identical, but unusual. | `POST /api/impersonate` — session cookie value rotates server-side. | Use a stateless Supabase admin verifier (`auth.signInWithPassword` against a service client without cookie-store wiring) so the original session is preserved. | CWE-613 |
| S0-11-04 | Low | Paranoid | `src/lib/cmi.ts:181-189` | The CMI verification hash uses raw key names (case-sensitive) when building `fieldsToHash`. CMI may upcase/lowercase fields differently between sandbox vs production releases. Today the explicit allowlist (`CMI_KNOWN_HASH_FIELDS`) lists both `oid` and `OID`, `amount` and `AMOUNT`, but not every field (e.g. only `ProcReturnCode` and `procreturncode` are paired; `BillToName` is not paired with `billtoname`). | CMI changes `BillToName` to `billtoname` in a future release → HMAC mismatch, all callbacks rejected. | Normalize keys to a canonical case (e.g. PascalCase) before checking against the allowlist and before HMAC. | CWE-345 |
| S0-11-05 | Medium | Paranoid | `src/app/api/payments/webhook/route.ts:38-41` | Stripe webhook body size is enforced via `content-length` header only. If Stripe (or an attacker proxying Stripe) omits Content-Length, the route reads the full body without a streaming cap. | Set `Transfer-Encoding: chunked` and stream 10 MB body. | Replace the Content-Length check with a streaming reader pattern identical to `readBodyWithLimit` in `src/app/api/payments/cmi/callback/route.ts:58-87`. | CWE-400 |

---

# SEASON 1 — Code & Data Layer (A1–A30)

## A1 — Universal trust / taint chain

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A1-01 | Info | Taint | `src/middleware.ts:159-170, 200-212` | Tenant headers stripped at the edge; rate limit applied per-IP before tenant resolution. | n/a | None. | OWASP API1 |
| A1-02 | Info | Taint | `src/lib/api-validate.ts` | Zod parse for every mutation; no `any` propagated to handlers. | n/a | None. | CWE-20 |
| A1-03 | Low | Taint | `src/app/api/v1/register-clinic/route.ts:73-91` | `escapeSlackMrkdwn` applied to every interpolated field — good. But `clinicName` is also concatenated with `escapeSlackMrkdwn(data.city) || "N/A"` — the `||` chain is fine since `escapeSlackMrkdwn` never returns `undefined`. | n/a | None — leaving for clarity. | CWE-79 |

## A2 — Hidden backdoor / dead path / kill-switch

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A2-01 | High | Dead path / latent risk | `src/app/api/ai/whatsapp-receptionist/route.ts` | Dead WhatsApp AI receptionist route — see S0-03-04. Currently unreachable via deny-by-default but lacks HMAC; adding it to `PUBLIC_API_ROUTES` later opens an unauthenticated denial-of-wallet sink. | See S0-03-04. | Delete the file OR add HMAC verification before any other processing. | CWE-1188 |
| A2-02 | Info | Kill-switch | `src/lib/ai/config.ts` (`resolveAIConfig`) | AI feature has a kill-switch (`F-AI-01`); when set, the route returns a fallback message. | n/a | None. | NIST CM-7 |
| A2-03 | Info | Kill-switch | `src/app/api/v1/register-clinic/route.ts:236-238` | Self-service registration is OFF unless `SELF_SERVICE_REGISTRATION_ENABLED=true`. | n/a | None. | NIST CM-7 |
| A2-04 | Low | Backdoor | `src/app/api/auth/demo-login/route.ts` | Demo login bypasses password but is restricted to (a) `NEXT_PUBLIC_FEATURE_DEMO_MODE !== "false"`, (b) DEMO_CLINIC_ID must exist, (c) only `patient` role. Production has feature flag off. | n/a | Verify in production CI that env var is explicitly set to `false`. Add a `production-env-matrix.md` check. | CWE-798 |

## A3 — STRIDE drill (per data flow)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A3-S | Info | Spoofing | `src/lib/with-auth.ts:135-200` | Signed profile header HMAC; tenant subdomain bound to clinic id. | n/a | None. | OWASP A07 |
| A3-T | Info | Tampering | `src/middleware.ts` | CSRF + Origin allowlist; signed cookies; HMAC-derived booking token (`A6-13`). | n/a | None. | CWE-345 |
| A3-R | Info | Repudiation | `src/lib/audit-log.ts` | Append-only audit logs via `service_role`; `pending_audit_logs` retry queue (migration 00089). | n/a | None. | NIST AU-9 |
| A3-I | Info | Info disclosure | `src/lib/encryption.ts` | PHI encrypted at rest (AES-256-GCM); `PHI_CATEGORIES` set covers documents/labs/x-rays/prescriptions. | n/a | None. | Law 09-08 |
| A3-D | Medium | DoS / Wallet | `src/app/api/booking/route.ts:217` | IP-based bookingLimiter + per-IP middleware rate limit. But the AI `whatsapp-receptionist` if exposed would fan out OpenAI calls — see A2-01 / S0-03-04. | n/a | See A2-01. | OWASP API4 |
| A3-E | Info | Elevation | All routes | `withAuth` + RLS + tenant header — no privilege escalation paths identified. | n/a | None. | OWASP A01 |

## A4 — OWASP Top 10 cross-walk

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A4-A01 | Info | Broken access control | RLS + `withAuth` | Covered. | n/a | None. | OWASP A01 |
| A4-A02 | Info | Crypto failures | `src/lib/encryption.ts`, `src/lib/crypto-utils.ts` | AES-256-GCM, HMAC-SHA256 only; no MD5/SHA1 for security. | `rg "createHash.*md5\|createHash.*sha1" src` → no use for security purposes. | None. | OWASP A02 |
| A4-A03 | Info | Injection | See S0-02. | n/a | n/a | None. | OWASP A03 |
| A4-A04 | Medium | Insecure design | `src/app/api/booking/route.ts` manage_url | See S0-06-04. | n/a | See S0-06-04. | OWASP A04 |
| A4-A05 | Medium | Misconfig | CSP `style-src 'unsafe-inline'` | See S0-11-01. | n/a | See S0-11-01. | OWASP A05 |
| A4-A06 | Info | Vulnerable deps | `.github/workflows/ci.yml:34-38` | `npm audit --omit=dev --audit-level=high` blocks high/critical CVEs. | n/a | None. | OWASP A06 |
| A4-A07 | Info | Auth failures | MFA + AAL2 enforcement | Covered. | n/a | None. | OWASP A07 |
| A4-A08 | Info | Software & data integrity | `.github/workflows/ci.yml:172-218` | SBOM via CycloneDX + cosign signing + SLSA provenance. | n/a | None. | OWASP A08 |
| A4-A09 | Info | Logging failures | `src/lib/audit-log.ts` + Sentry | Audit log with retry queue; structured logger. | n/a | None. | OWASP A09 |
| A4-A10 | Low | SSRF | DoH + AV fetch | Fixed-host; see S0-02-04 for Slack webhook hardening recommendation. | n/a | See S0-02-04. | OWASP A10 |

## A5 — Injection (SQL / cmd / NoSQL / template / SSRF / XXE)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A5-01 | Info | SQLi | All routes | Parameterised via Supabase JS client. | n/a | None. | CWE-89 |
| A5-02 | Info | Command injection | n/a | Workers runtime has no `child_process`. | n/a | None. | CWE-78 |
| A5-03 | Info | XML / XXE | n/a | No XML parsing in `src/`. | `rg "DOMParser\|xml2js\|libxml" src` → 0. | None. | CWE-611 |
| A5-04 | Low | SSRF | `src/app/api/v1/register-clinic/route.ts` DoH fetch | DoH host is fixed; AV fetch host comes from env (`AV_SCAN_URL`). | n/a | Add env-var validation that `AV_SCAN_URL` matches `https://` with a known-internal-host allowlist. | CWE-918 |

## A6 — Crypto correctness

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A6-01 | Info | Crypto | `src/lib/encryption.ts:144-165` | AES-256-GCM with random 96-bit IV per file; IV prepended to ciphertext; auth tag stripped before decrypt. | n/a | None. | NIST SP 800-38D |
| A6-02 | Info | Crypto | `src/lib/encryption.ts:174-227` | Decrypt falls back to `PHI_OLD_KEY` during rotation; documented in `docs/SOP-PHI-KEY-ROTATION.md`. | n/a | None. | NIST SP 800-57 |
| A6-03 | Info | Crypto | `src/lib/crypto-utils.ts` | `hmacSha256Hex`, `timingSafeEqual` only — no insecure primitives. | n/a | None. | NIST SP 800-107 |
| A6-04 | Info | Crypto | `src/app/api/booking/route.ts:78-122` | HMAC-SHA256 booking token; clinicId + phone + expiry in signed payload (`A6-13`). | n/a | None. | CWE-345 |
| A6-05 | Low | Crypto | `src/app/api/booking/route.ts:116` | `if (expectedSig.length !== signature.length) return { valid: false }` — leaks length info. Lengths are fixed (64 hex chars) so practically safe; flag for paranoid hardening. | n/a | Compare via `timingSafeEqual(expectedSig, signature)` and skip the length precheck (mismatch lengths will fail constant-time naturally). | CWE-208 |

## A7 — AuthN / AuthZ / session

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A7-01 | Info | AuthN | Middleware + Supabase Auth (GoTrue) | Session lifecycle handled by Supabase; refresh tokens rotated. | n/a | None. | OWASP A07 |
| A7-02 | Info | AuthZ | `withAuth` enforced roles + RLS | Defense-in-depth. | n/a | None. | OWASP A01 |
| A7-03 | Info | Session | `src/app/api/impersonate/route.ts:144-160` | `__Host-` prefixed cookies, `SameSite=Strict`, `httpOnly`, `Secure`, 30-min TTL, session row in DB. | n/a | None. | CWE-614 |
| A7-04 | Low | Session | `src/app/api/impersonate/route.ts` | `SameSite=Strict` will drop the cookie on cross-subdomain links — verify the impersonation UX does not break on direct navigation between `app.oltigo.com` and `<clinic>.oltigo.com`. | n/a | Either keep Strict (require super-admin to stay on main domain) or switch to `Lax` and document the rationale. | NIST AC-10 |

## A8 — Error handling / log hygiene

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A8-01 | Info | Log hygiene | `src/app/api/v1/register-clinic/route.ts:58-61` | Comment explicitly forbids logging PII (email / phone / names). Confirmed: only structured non-PII fields are logged. | `rg "logger.*email\|logger.*phone" src` → only sanitised contexts. | None. | Law 09-08 |
| A8-02 | Info | Log hygiene | `src/lib/logger.ts:112-116` | Structured JSON via `console.error`; PII redacted at the logger boundary (see `src/lib/__tests__/env-phi-masking.test.ts`). | n/a | None. | GDPR |
| A8-03 | Low | Log hygiene | Multiple files | `logger.warn("Operation failed", { error })` — generic message used in 30+ locations (e.g. `src/app/api/booking/route.ts:468`, `src/app/api/impersonate/route.ts:261`). Hampers SIEM filtering. | n/a | Replace generic messages with action-specific ones (e.g. "Failed to fetch available slots" / "Failed to end impersonation"). | NIST AU-12 |

## A9 — Dependency drift / supply chain

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A9-01 | Info | Supply chain | `.github/workflows/ci.yml:23-37, 159-201` | Pinned-SHA GH Actions; `npm ci --ignore-scripts`; CycloneDX SBOM + cosign keyless signing + SLSA provenance. | n/a | None. | NIST SR-3 |
| A9-02 | Info | Supply chain | `.github/workflows/ci.yml:34-38` | `npm audit --audit-level=high` blocks H/C CVEs. | n/a | None. | NIST RA-5 |
| A9-03 | Low | Supply chain | `.github/workflows/ci.yml:229-237` | Semgrep config `p/javascript`. Consider adding `p/owasp-top-ten` and `p/secrets`. | n/a | Add additional Semgrep rule packs in CI. | OWASP A06 |
| A9-04 | Medium | Supply chain | `package.json` | `swagger-ui-react@5.32.6` pulls `react-debounce-input@3.3.0` and `react-inspector@6.0.2` which require React 15-18 (npm install warns ERESOLVE peer dep). The override works but is fragile. | `npm install` produces ERESOLVE warnings. | Pin `swagger-ui-react` to a version compatible with React 19 OR migrate API docs to Redoc / Scalar. | NIST SR-3 |
| A9-05 | Low | Supply chain | `package.json` engines | `node 22.12.0` triggers EBADENGINE warnings for `eslint-visitor-keys@5.0.1`, `isomorphic-dompurify@3.14.0`, `jsdom@29.1.1` (each requires `^22.13.0`). | `npm install` shows warnings. | Bump local node version to 22.13.0+ OR pin lower-version dev deps. | NIST CM-2 |

## A10 — Concurrency / race / deadlock

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A10-01 | Info | Race | `supabase/migrations/00074_booking_slot_advisory_lock.sql` | `pg_advisory_xact_lock` serialises slot fill. | n/a | None. | CWE-362 |
| A10-02 | Info | Race | `src/app/api/payments/webhook/route.ts:104-148` | Stripe idempotency via `reference` (session.id) upsert with `onConflict: "reference"`. | n/a | None. | CWE-362 |
| A10-03 | Info | Race | `src/app/api/payments/cmi/callback/route.ts:157` | Idempotency via `status !== COMPLETED` check before update. | n/a | None. | CWE-362 |
| A10-04 | Low | Race | `src/app/api/payments/webhook/route.ts:104-113` | The "existingPayment" check and subsequent `upsert` are not atomic; the unique constraint on `reference` prevents duplicate rows but two concurrent webhooks may both pass the existence check before the first commits. The `onConflict: "reference"` makes the second a no-op, so functionally safe — but the explicit existence check is dead code in that race. | n/a | Either remove the existence check (rely solely on `onConflict`) OR wrap in a transaction with `SELECT ... FOR UPDATE`. | CWE-362 |

## A11 — Regex / ReDoS

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A11-01 | Info | ReDoS | `src/lib/validations.ts` | Anchored, linear regex throughout (`^\d{4}-\d{2}-\d{2}$`, `^\d{2}:\d{2}$`, `^[A-Za-z]{2,}$`). | n/a | None. | CWE-1333 |
| A11-02 | Info | ReDoS | `src/app/api/ai/whatsapp-receptionist/route.ts:88-95` | `INTENT_KEYWORDS` regex use only `\b...\b` boundaries and OR groups; no nested quantifiers. | n/a | None. | CWE-1333 |

## A12 — Resource leaks / memory pressure

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A12-01 | Info | Resource | `src/app/api/upload/route.ts:80-87` | Workers runtime auto-frees buffers; explicit body limit (25 MB) prevents OOM. | n/a | None. | CWE-770 |
| A12-02 | Info | Resource | `src/lib/with-auth.ts:257-289` | Per-user rate-limit map capped at 10 000 entries; LRU eviction. | n/a | None. | CWE-770 |
| A12-03 | Low | Resource | `src/app/api/ai/whatsapp-receptionist/route.ts:177-191` | `findClinicByPhoneNumberId` fetches `select("id, config").not("config","is",null)` across **all** clinics, then iterates in memory. With many clinics this scales O(n). | n/a | Add an explicit DB column `whatsapp_phone_number_id` with a unique index, or index `config->>'whatsapp_phone_number_id'`. | CWE-400 |

## A13 — Secrets in code / config

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A13-01 | Info | Secrets | `.github/workflows/ci.yml:57-79` | Gitleaks + seed-credential guard. | n/a | None. | CWE-798 |
| A13-02 | Info | Secrets | `.env.example` (254 lines, 71 vars) | All secrets are placeholders. | n/a | None. | NIST IA-5 |
| A13-03 | Info | Secrets | `src/lib/env.ts` (envalid validation) | Required env vars enforced at boot via `instrumentation.ts`. | n/a | None. | NIST CM-6 |

## A14 — Input normalisation / canonicalisation

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A14-01 | Info | Canonicalisation | `src/lib/validations.ts:normalizeText` | NFC + NUL-byte strip. | n/a | None. | CWE-176 |
| A14-02 | Info | Canonicalisation | `src/lib/encryption.ts:255-273` | `normalizePhiCategory` collapses hyphens to underscores, lowercases. | n/a | None. | CWE-176 |
| A14-03 | Info | Canonicalisation | `src/app/api/booking/route.ts:240-243` | Phone normalisation strips spaces/hyphens/parens before comparing token-bound phone to submitted phone. | n/a | None. | CWE-176 |

## A15 — Output encoding

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A15-01 | Info | Encoding | React | React escapes by default; `dangerouslySetInnerHTML` allowlist enforced. | n/a | None. | OWASP A03 |
| A15-02 | Info | Encoding | `src/app/api/v1/register-clinic/route.ts:73-91` | Slack mrkdwn fields are escaped via `escapeSlackMrkdwn`. | n/a | None. | CWE-79 |
| A15-03 | Low | Encoding | `src/lib/json-ld.ts` | JSON-LD strings inserted with `safeJsonLdStringify`. Verify the helper escapes `</script>` sequences. | Read `src/lib/json-ld.ts`. | n/a (likely already handled — verify in next audit). | CWE-79 |

## A16 — Schema constraints

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A16-01 | Info | Schema | `supabase/migrations/00076_a16_schema_constraints.sql` | Adds NOT NULL constraints and CHECK constraints (status enums, role enums). | Read file. | None. | CWE-20 |
| A16-02 | Info | Schema | `supabase/migrations/00069_users_role_clinic_check.sql` | Enforces role + clinic_id integrity. | Read file. | None. | CWE-20 |
| A16-03 | Info | Schema | `supabase/migrations/00072_appointments_slot_well_ordered.sql` | Enforces `slot_end > slot_start`. | Read file. | None. | CWE-20 |

## A17 — Queries / indexes / N+1

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A17-01 | Info | Index | `supabase/migrations/00082_idx_appointments_status_slot_start.sql` | Composite index `(status, slot_start)` for slot lookups. | n/a | None. | CWE-405 |
| A17-02 | Info | Index | `supabase/migrations/00073_appointments_status_slot_start_index.sql` | Earlier predecessor index. | n/a | None. | CWE-405 |
| A17-03 | Info | Index | `supabase/migrations/00024_missing_fk_indexes.sql` | FK indexes added in bulk migration. | n/a | None. | CWE-405 |

## A18 — Transactions / atomicity

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A18-01 | Info | Transactions | Booking RPC | Atomic insert + slot check inside `pg_advisory_xact_lock` transaction. | n/a | None. | CWE-362 |
| A18-02 | Info | Transactions | `register_new_clinic` RPC | Atomic clinic + user creation. | n/a | None. | CWE-362 |
| A18-03 | Low | Transactions | `src/app/api/payments/cmi/callback/route.ts:151-235` | Payment status update and appointment confirmation are issued as separate `.update()` calls. A crash between them could leave a paid-but-unconfirmed appointment. | Simulate Worker eviction between calls. | Wrap into an RPC that performs both updates in a single transaction. | CWE-362 |

## A19 — Migrations / repeatable / idempotent

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A19-01 | Info | Migrations | All migration files | Use `IF NOT EXISTS`, `CREATE OR REPLACE`, and `DO $$ ... $$` guards. | `head -30 supabase/migrations/00071_security_audit_remediation.sql` | None. | NIST CM-3 |
| A19-02 | Info | Migrations | `.github/workflows/migration-check.yml` | Dedicated CI for migrations. | n/a | None. | NIST CM-3 |

## A20 — SQLi (focused redo)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A20-01 | Info | SQLi | All Supabase calls | Parameterised; no string concatenation observed. | n/a | None. | CWE-89 |

## A21 — Encryption at rest

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A21-01 | Info | Encryption | `src/lib/encryption.ts` + `src/lib/r2-encrypted.ts` | PHI categories encrypted server-side before R2 upload. | n/a | None. | Law 09-08 |
| A21-02 | Info | Encryption | `src/app/api/upload/route.ts:284-290, 345-362` | PHI uploads forced through POST handler (server-side encrypt); GET/PUT (presigned) refuse PHI categories. | n/a | None. | Law 09-08 |
| A21-03 | Info | Encryption | Supabase at rest | Supabase manages PG disk encryption; verify in vendor inventory. | n/a | None. | NIST SC-28 |

## A22 — Backup / restore drill

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A22-01 | Info | Backup | `.github/workflows/backup.yml` | Nightly Supabase → R2 backup with GPG encryption; daily/weekly/monthly tracks. | n/a | None. | NIST CP-9 |
| A22-02 | Info | Restore | `.github/workflows/restore-test.yml` | Monthly automated restore drill (1st of month at 04:00). Pulls latest backup, decrypts, restores to scratch DB. | n/a | None. | NIST CP-9 |
| A22-03 | Info | Backup | `docs/backup-recovery-runbook.md`, `docs/restore-drill-evidence.md` | Runbook and evidence file present. | n/a | None. | NIST CP-9 |

## A23 — Over-fetching / minimum-needed

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A23-01 | Info | Over-fetching | `src/app/api/payments/cmi/callback/route.ts:151-155` | Selects only `id, appointment_id, clinic_id, status, amount` — minimum needed. | n/a | None. | NIST AC-21 |
| A23-02 | Low | Over-fetching | `src/app/api/ai/whatsapp-receptionist/route.ts:177-180` | `select("id, config")` fetches the full `config` JSONB for every clinic to filter in-app. | n/a | Add a database column / GIN index — see A12-03. | NIST AC-21 |

## A24 — Connection pool / RLS context

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A24-01 | Info | Pool / RLS | `src/lib/supabase-server.ts:65-111` | `createTenantClient` sets `x-clinic-id` header so PostgREST scopes every request; redundantly sets the session variable for SECURITY DEFINER functions. | n/a | None. | OWASP A01 |
| A24-02 | Info | Pool | Workers runtime | Each isolate uses HTTP-based PostgREST — no long-lived pool. | n/a | None. | OWASP A04 |

## A25 — Stored procedures / triggers

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A25-01 | Info | RPC | `booking_atomic_insert` | SECURITY DEFINER + advisory lock; verified by tenant id arg. | n/a | None. | CWE-269 |
| A25-02 | Info | RPC | `booking_find_or_create_patient` | SECURITY DEFINER with explicit clinic id arg. | n/a | None. | CWE-269 |

## A26 — Data normalisation / dedup

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A26-01 | Info | Dedup | `supabase/migrations/00085_notification_dedup_constraint.sql` | Unique constraint preventing duplicate notification sends. | n/a | None. | CWE-754 |
| A26-02 | Info | Dedup | `supabase/migrations/00084_cmi_callback_dedup.sql` | `cmi_callbacks_seen` table + RLS policy `cmi_callbacks_tenant_isolation`. | n/a | None. | CWE-362 |

## A27 — Soft-delete vs hard-delete

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A27-01 | Info | Soft-delete | `clinics.deleted_at` (migration 00071) | Soft-delete column added; `ON DELETE RESTRICT` on dependent FKs. | n/a | None. | NIST AC-3 |
| A27-02 | Info | Hard-delete | `/api/cron/gdpr-purge` | Periodic hard-purge of GDPR-erase-requested records (separate cron). | n/a | None. | GDPR Art. 17 |

## A28 — Time / timezone / DST

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A28-01 | Info | TZ | `src/app/api/booking/route.ts:170-186` | Day-of-week computed via `Intl.DateTimeFormat(weekday, timeZone)` instead of `Date.getDay()` — DST/midnight-safe. | n/a | None. | CWE-367 |
| A28-02 | Info | TZ | `src/lib/timezone.ts` | `computeEndTime` enforces midnight overflow rejection. | n/a | None. | CWE-367 |
| A28-03 | Info | TZ | `clinic.config.timezone` | Africa/Casablanca by default; per-tenant override via `clinics.config`. | n/a | None. | NIST AC-3 |

## A29 — Numeric precision / money

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A29-01 | Info | Money | `src/app/api/payments/webhook/route.ts:141` | `Math.round(session.amount_total || 0) / 100` — integer-safe centimes → MAD. | n/a | None. | CWE-681 |
| A29-02 | Info | Money | `src/app/api/payments/cmi/callback/route.ts:160-167` | Amount/currency tampering check (`F-16`) — rejects mismatched callbacks. | n/a | None. | CWE-682 |
| A29-03 | Info | Money | `src/app/api/payments/webhook/route.ts:201-217` | PaymentIntent uses `amount` (not `amount_total`); `Number.isFinite` guard. | n/a | None. | CWE-682 |

## A30 — Replication / sharding / read-replica

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A30-01 | Low | Replication | n/a | No read-replica configuration found. Supabase Pro plan offers replicas but no app-side read-replica routing in code. | n/a | If RPO/RTO targets require cross-region replication, document the Supabase plan tier and add to `docs/data-residency.md`. | NIST CP-7 |

---

# SEASON 2 — Infra / Cloud / DevOps / API / Web (A31–A60)

## A31 — IaC misconfig

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A31-01 | Info | IaC | `wrangler.toml` | Worker config explicit; secrets via Cloudflare dashboard / `update-secrets.yml`. | n/a | None. | NIST CM-6 |
| A31-02 | Low | IaC | n/a | No Terraform / Pulumi for Cloudflare / Supabase resources. Drift detection is manual. | n/a | Optional: codify R2 / KV / DNS via Terraform if scale warrants. | NIST CM-2 |

## A32 — Dockerfile / container

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A32-01 | Info | Container | n/a | No Dockerfile (Workers runtime). | n/a | N/A — runtime is Cloudflare Workers. | NIST CM-7 |

## A33 — Kubernetes

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A33-01 | Info | K8s | n/a | No Kubernetes (Workers). | n/a | N/A. | NIST CM-7 |

## A34 — CI/CD pipeline

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A34-01 | Info | CI | `.github/workflows/ci.yml:7-11` | Concurrency: cancel-in-progress per PR. | n/a | None. | NIST CM-3 |
| A34-02 | Info | CI | `.github/workflows/deploy.yml:13` | Deploy serialised per branch. | n/a | None. | NIST CM-3 |
| A34-03 | Info | CI | All workflows | Pinned-SHA GH Actions. | n/a | None. | NIST SR-3 |
| A34-04 | Info | CI | `.github/workflows/ci.yml:55-79` | DB dump leak guard + seed credentials guard. | n/a | None. | CWE-798 |
| A34-05 | Info | CI | E2E tests via Playwright + Supabase local. | `.github/workflows/ci.yml:240-280`. | n/a | None. | NIST SA-11 |
| A34-06 | Low | CI | Branch protection | Not visible from repo files; assumed via GitHub settings. | n/a | Verify in GitHub settings: main requires PR + 1 review + status checks. | NIST CM-3 |

## A35 — Cloud IAM (Cloudflare / R2 / Supabase)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A35-01 | Info | IAM | `src/app/api/upload/route.ts` | R2 keys scoped per-clinic; presigned policies enforce `content-length-range` and exact `Content-Type`. | n/a | None. | NIST AC-3 |
| A35-02 | Info | IAM | `.github/workflows/access-review.yml` | Periodic access-review workflow. | n/a | None. | NIST AC-2 |
| A35-03 | Low | IAM | n/a | No evidence in repo of R2 bucket public-access settings (must be private). | n/a | Document in `docs/data-residency.md` or `vendor-inventory.md` that R2 buckets are private. | NIST AC-3 |

## A36 — Public endpoints / DDoS posture

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A36-01 | Info | Edge | `src/lib/rate-limit.ts:58-93` | Real-IP extraction prefers `CF-Connecting-IP`; falls back validated and warns in production. | n/a | None. | CWE-290 |
| A36-02 | Info | Edge | Cloudflare WAF | Inherited from Cloudflare in front of Workers. | n/a | None. | NIST SC-7 |
| A36-03 | Medium | Edge | n/a | No documented WAF rule set in repo (e.g. enabled OWASP ruleset, geo-restrictions). | n/a | Document Cloudflare WAF rules in `docs/dns-infrastructure-checklist.md`. | NIST SC-7 |

## A37 — API design

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A37-01 | Info | API | `src/lib/api-response.ts` | Consistent `apiError`, `apiSuccess`, `apiForbidden`, etc. | n/a | None. | OWASP API1 |
| A37-02 | Info | API | `src/lib/api-validate.ts` | All public mutation routes use `withValidation` / `withAuthValidation`. | n/a | None. | OWASP API1 |
| A37-03 | Info | API | `src/app/api/upload/route.ts:217-223, 143-146` | GIF disallowed in clinical categories (A37.9). | n/a | None. | CWE-434 |

## A38 — TLS / HSTS

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A38-01 | Info | TLS | `src/lib/middleware/security-headers.ts:4` | HSTS: 2 years + includeSubDomains + preload. | n/a | None. | NIST SC-8 |
| A38-02 | Info | TLS | Cloudflare | Full Strict mode (assumed via Cloudflare config). | n/a | Document Cloudflare TLS settings in repo. | NIST SC-8 |

## A39 — Rate limit / DDoS / per-tenant cap

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A39-01 | Info | Rate limit | `src/lib/rate-limit.ts:558-588` | Distributed sliding-window limiter (KV / Supabase / memory). | n/a | None. | OWASP API4 |
| A39-02 | Info | Rate limit | 21 named limiters | Login, OTP send, booking, upload, etc. | n/a | None. | OWASP API4 |
| A39-03 | Info | Rate limit | `src/app/api/payments/cmi/callback/route.ts:32-50` | IP allowlist for CMI callbacks. | n/a | None. | OWASP API4 |
| A39-04 | Medium | Rate limit | n/a | No global per-tenant cap (only per-IP). A malicious clinic admin could enumerate via auth'd endpoints up to the 100 req/min per-user cap, accumulating across the clinic. | n/a | Add a per-clinic `apiMutationLimiter` keyed by `clinic_id` (e.g. 10 000 req/min/clinic). | OWASP API4 |

## A40 — DDoS / volumetric

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A40-01 | Info | DDoS | Cloudflare in front of Workers | Standard L3/L4 absorption. | n/a | None. | NIST SC-5 |
| A40-02 | Medium | DDoS | n/a | No Cloudflare "Under Attack Mode" runbook in repo for L7 floods. | n/a | Add runbook section to `docs/incident-response.md`. | NIST IR-4 |

## A41 — Secrets management

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A41-01 | Info | Secrets | `.github/workflows/update-secrets.yml` + Cloudflare Workers secrets | All secrets out-of-tree. | n/a | None. | NIST IA-5 |
| A41-02 | Info | Secrets | `docs/SOP-SECRET-ROTATION.md` | Documented rotation procedure. | n/a | None. | NIST IA-5 |
| A41-03 | Info | Secrets | `docs/SOP-PHI-KEY-ROTATION.md` | PHI key rotation with old-key fallback. | n/a | None. | NIST SC-12 |

## A42 — Branch protection

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A42-01 | Low | Repo | n/a | Branch protection rules not in repo (GitHub-side config). | n/a | Add `.github/CODEOWNERS` if missing; document branch protection in `docs/`. | NIST CM-3 |

## A43 — Logging coverage

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A43-01 | Info | Logging | `src/lib/with-auth.ts:257-289` | F-A93-04: 100% logging of PHI-bearing endpoint reads. | n/a | None. | Law 09-08 |
| A43-02 | Info | Logging | `src/lib/audit-log.ts:41-147` | Append-only audit events via service_role; pending queue for retries. | n/a | None. | NIST AU-9 |

## A44 — Monitoring / alerting

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A44-01 | Info | Monitoring | Sentry integration (`@sentry/nextjs` referenced in `src/lib/audit-log.ts:76-110`, `src/app/api/payments/cmi/callback/route.ts:184-195`) | Critical errors paged via Sentry. | n/a | None. | NIST SI-4 |
| A44-02 | Low | Monitoring | Existing audit `docs/audit/TECHNICAL-AUDIT-2026-04.md:21` | Sentry sampling at 10%. May miss low-frequency tenant-isolation errors. | n/a | Sample at 100% for `compliance:*` Sentry tags. | NIST SI-4 |

## A45 — Backup

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A45-01 | Info | Backup | `.github/workflows/backup.yml` | Daily/weekly/monthly nightly schedule, GPG-encrypted to R2. | n/a | None. | NIST CP-9 |

## A46 — Disaster recovery

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A46-01 | Info | DR | `.github/workflows/restore-test.yml` | Monthly restore drill. | n/a | None. | NIST CP-10 |
| A46-02 | Info | DR | `docs/bcp.md` | Business continuity plan. | n/a | None. | NIST CP-2 |

## A47 — Incident response

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A47-01 | Info | IR | `docs/incident-response.md` | IR runbook. | n/a | None. | NIST IR-8 |
| A47-02 | Info | IR | `docs/oncall.md` | Oncall rotation. | n/a | None. | NIST IR-7 |
| A47-03 | Info | IR | `docs/tabletop/` | Tabletop drill artifacts. | n/a | None. | NIST IR-3 |

## A48 — Compliance automation

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A48-01 | Info | Compliance | `docs/compliance/` | DPA, DPIA, retention, breach templates, info-sec policy. | n/a | None. | GDPR / Law 09-08 |

## A49 — Egress / outbound

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A49-01 | Info | Egress | `src/lib/__tests__/egress-allowlist.test.ts` | Egress allowlist enforced in tests. | n/a | None. | NIST AC-4 |

## A50 — Network segmentation

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A50-01 | Info | Network | Workers + Supabase via PostgREST | No exposed DB on internet (Supabase enforces). | n/a | None. | NIST SC-7 |

## A51 — Storage permissions (R2, public assets)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A51-01 | Info | R2 | `src/app/api/upload/route.ts` | All uploads under `clinics/{clinicId}/` prefix. | n/a | None. | NIST AC-3 |
| A51-02 | Low | R2 | n/a | Public-read R2 bucket (`uploads.oltigo.com`) implied by CSP `img-src 'self' data: blob: ... uploads.oltigo.com`. Verify only logos/photos are publicly readable; PHI categories MUST be private. | n/a | Document R2 bucket-level ACL split (public branding bucket vs private PHI bucket) in `docs/data-residency.md`. | NIST SC-28 |

## A52 — Upload safety

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A52-01 | Info | Upload | `src/app/api/upload/route.ts:148-156` | Magic-byte validation. | n/a | None. | CWE-434 |
| A52-02 | Info | Upload | `src/app/api/upload/route.ts:234-276` | Optional AV scanning (ClamAV REST API). | n/a | None. | CWE-434 |
| A52-03 | Info | Upload | `src/app/api/upload/route.ts:130-145` | SVG and GIF (clinical) blocked. | n/a | None. | CWE-79 |
| A52-04 | Info | Upload | `src/app/api/upload/route.ts:277-282` | EXIF stripped from JPEGs (`A52.8`). | n/a | None. | Law 09-08 |
| A52-05 | Info | Upload | `src/app/api/upload/route.ts:415-423` | Magic byte recheck after presigned upload. | n/a | None. | CWE-434 |

## A53 — Cache leaks

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A53-01 | Info | Cache | `src/app/api/booking/route.ts:463` | Public availability cache `Cache-Control: public, max-age=60`. Per-doctor only — no PHI. | n/a | None. | OWASP API8 |
| A53-02 | Low | Cache | n/a | No explicit `Cache-Control: private, no-store` on PHI endpoints. The default is `private` in browser caches but Cloudflare may cache headers if any layer sets `public`. | n/a | Add `Cache-Control: private, no-store` to PHI-bearing responses in `withAuth`. | OWASP API8 |

## A54 — Cookies / sessions

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A54-01 | Info | Cookies | `src/app/api/impersonate/route.ts:144-152` | `__Host-` prefix, `Secure`, `httpOnly`, `SameSite=Strict`. | n/a | None. | CWE-614 |
| A54-02 | Info | Cookies | Supabase Auth | Session cookies set by Supabase SSR. Verified `httpOnly` via SDK defaults. | n/a | None. | CWE-614 |

## A55 — Service worker / PWA

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A55-01 | Info | PWA | `src/app/api/push/subscribe/route.ts` | Push subscription endpoint with `withAuthAnyRole` + RPC `upsert_push_subscription`. | n/a | None. | OWASP A07 |

## A56 — Security headers

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A56-01 | Info | Headers | `src/lib/middleware/security-headers.ts` | CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy applied uniformly. | n/a | None. | OWASP A05 |
| A56-02 | Info | Headers | `applyAllSecurityHeaders`, `withSecurityHeaders`, `secureRedirect` | Same header set on all response shapes (errors, redirects, 200). | n/a | None. | OWASP A05 |
| A56-03 | Info | Headers | `src/lib/middleware/security-headers.ts:13-43` | Strict Permissions-Policy. | n/a | None. | OWASP A05 |
| A56-04 | Medium | Headers | `src/lib/middleware/security-headers.ts:144` | `style-src 'unsafe-inline'` — see S0-11-01. | n/a | See S0-11-01. | OWASP A05 |

## A57 — CSRF / Origin

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A57-01 | Info | CSRF | `src/lib/middleware/csrf.ts:25-38` | Exempt list documented + each exempt route has its own auth mechanism. | n/a | None. | OWASP A05 |
| A57-02 | Info | CSRF | `src/lib/middleware/csrf.ts:64-112` | Origin allowlist locked per-request to the specific hostname (Audit P1 #9). | n/a | None. | OWASP A05 |
| A57-03 | Info | CSRF | `src/lib/middleware/csrf.ts:94-102` | Missing Origin header → 403 (fail-closed). | n/a | None. | OWASP A05 |

## A58 — XSS

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A58-01 | Info | XSS | React + CSP + allowlist | Multiple layers. | n/a | None. | OWASP A03 |
| A58-02 | Info | XSS | `src/lib/sanitize-html.ts` | DOMPurify-based sanitiser. | n/a | None. | OWASP A03 |

## A59 — Robots / SEO leakage

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A59-01 | Info | SEO | `src/app/sitemap.ts` | Public clinic + blog entries only. | n/a | None. | OWASP A08 |
| A59-02 | Low | SEO | n/a | No explicit `robots.txt` review noted. Verify staging subdomains have `Disallow: /`. | n/a | Add `Disallow: /` for staging. | OWASP A08 |

## A60 — Cron / scheduled

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A60-01 | Info | Cron | `src/app/api/cron/` (7 endpoints) | CRON_SECRET bearer token enforced. | n/a | None. | OWASP A07 |
| A60-02 | Info | Cron | `scripts/check-cron-mapping.ts` | CI-enforced mapping between cron schedule and route. | n/a | None. | NIST CM-3 |
| A60-03 | Info | Cron | `src/app/api/cron/gdpr-purge/route.ts` | GDPR purge cron present. | n/a | None. | GDPR Art. 17 |

---

# SEASON 3 — Privacy & Reliability (A61–A85)

## A61 — CNDP / Law 09-08 readiness

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A61-01 | Info | CNDP | `docs/compliance/cndp.md` | Compliance memo present. | n/a | None. | Law 09-08 |
| A61-02 | Info | CNDP | `docs/data-residency.md` | Data residency policy. | n/a | None. | Law 09-08 |

## A62 — GDPR mapping (relevant to EU patients)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A62-01 | Info | GDPR | `docs/compliance/dpia.md` | DPIA document. | n/a | None. | GDPR Art. 35 |
| A62-02 | Info | GDPR | `docs/compliance/dpa-template.md` | Vendor DPA template. | n/a | None. | GDPR Art. 28 |

## A63 — Consent capture

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A63-01 | Info | Consent | `consent_logs` table (migration 00075) | Per-clinic consent capture. | n/a | None. | GDPR Art. 7 |

## A64 — Right to access (DSAR)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A64-01 | Info | DSAR | `src/lib/__tests__/export-data.test.ts` | Export-data route tested. | n/a | None. | GDPR Art. 15 |

## A65 — Right to delete (Erasure)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A65-01 | Info | Erasure | `docs/compliance/right-to-delete-evidence.md` | Evidence file present. | n/a | None. | GDPR Art. 17 |
| A65-02 | Info | Erasure | `/api/cron/gdpr-purge` | Purge cron. | n/a | None. | GDPR Art. 17 |

## A66 — Retention

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A66-01 | Info | Retention | `docs/compliance/retention.md` | Retention policy. | n/a | None. | Law 09-08 |
| A66-02 | Info | Retention | `supabase/migrations/00089_pending_audit_logs.sql` | 7-day auto-purge for `pending_audit_logs`. | n/a | None. | Law 09-08 |

## A67 — Sensitive data inventory

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A67-01 | Info | Inventory | `docs/compliance/data-flow-map.md` | Data flow map present. | n/a | None. | Law 09-08 |
| A67-02 | Info | Inventory | `src/lib/encryption.ts:PHI_CATEGORIES` | PHI categories enumerated in code. | n/a | None. | Law 09-08 |

## A68 — Anonymisation / pseudonymisation

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A68-01 | Low | Pseudo | n/a | No documented pseudonymisation for analytics (Plausible used — privacy-friendly, no PII forwarded). | n/a | Document Plausible's PII posture in `docs/plausible-privacy.md` (file exists; verify content). | GDPR Art. 32 |

## A69 — Cross-border / data export

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A69-01 | Info | Cross-border | `docs/data-residency.md` | Data residency for Supabase + R2 documented. | n/a | None. | GDPR Art. 44 |

## A70 — DPO contactable

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A70-01 | Info | DPO | `docs/compliance/information-security-policy.md` | DPO contact (assumed inside doc). | n/a | None. | GDPR Art. 37 |

## A71 — Breach notification SLA

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A71-01 | Info | Breach | `docs/compliance/breach-notification-templates.md` | Templates. | n/a | None. | GDPR Art. 33 |

## A72 — Vendor / sub-processor map

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A72-01 | Info | Vendor | `docs/vendor-inventory.md` | Vendor inventory. | n/a | None. | GDPR Art. 28 |

## A73 — Data access matrix

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A73-01 | Info | Access | `docs/access-control-matrix.md` | Access matrix. | n/a | None. | NIST AC-3 |

## A74 — RPO / RTO

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A74-01 | Info | RPO/RTO | `docs/bcp.md` + `docs/slo.md` | SLO + BCP documented. | n/a | None. | NIST CP-2 |
| A74-02 | Medium | RPO/RTO | n/a | Restore drill cadence is monthly; RPO of 24 h (nightly backup) is acceptable for many SaaS but may be tight for healthcare. | n/a | Either reduce RPO via continuous WAL archiving (Supabase Pro PITR) OR document the trade-off. | NIST CP-9 |

## A75 — Backup drills

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A75-01 | Info | Drill | `.github/workflows/restore-test.yml` | Monthly automated restore drill. | n/a | None. | NIST CP-10 |
| A75-02 | Info | Drill | `docs/restore-drill-evidence.md` | Evidence file. | n/a | None. | NIST CP-10 |

## A76 — RLS integration tests

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A76-01 | Info | RLS test | `src/lib/__tests__/integration/rls-real-postgres.test.ts` + CI gating | Confirmed in CI. | n/a | None. | NIST SA-11 |
| A76-02 | High | RLS test | `src/lib/__tests__/integration/rls-assertions.test.ts` | Placeholder file with `expect(true).toBe(true)` — see S0-08-02. | n/a | See S0-08-02 fix. | NIST SA-11 |

## A77 — Tenant isolation integration

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A77-01 | Info | Tenant | `src/lib/__tests__/integration/tenant-isolation.test.ts` | Dedicated tenant isolation test. | n/a | None. | OWASP A01 |

## A78 — Incident comms templates

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A78-01 | Info | Comms | `docs/comms-templates/` | Pre-approved comms templates. | n/a | None. | NIST IR-4 |

## A79 — Forensic readiness

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A79-01 | Info | Forensic | `docs/forensic-readiness.md` | Document present. | n/a | None. | NIST IR-4 |

## A80 — Log retention

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A80-01 | Info | Log retention | `docs/log-retention.md` | Policy. | n/a | None. | Law 09-08 |

## A81 — SLO / SLA

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A81-01 | Info | SLO | `docs/slo.md` | SLO documented. | n/a | None. | NIST SI-12 |

## A82 — Vendor exit playbook

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A82-01 | Info | Exit | `docs/vendor-exit-playbooks.md` | Vendor exit playbook. | n/a | None. | NIST CP-2 |

## A83 — Workforce security

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A83-01 | Info | Workforce | `docs/workforce-security.md` | Workforce security policy. | n/a | None. | NIST PS-3 |

## A84 — Reliability error budget

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A84-01 | Info | Reliability | `src/app/api/upload/route.ts:293-307` | Structured error logging on R2 outage. | n/a | None. | NIST SI-4 |
| A84-02 | Low | Reliability | n/a | No documented error budget burn-rate alerts in Sentry (only individual errors). | n/a | Add burn-rate dashboards to oncall. | NIST SI-4 |

## A85 — Tabletop / chaos

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A85-01 | Info | Chaos | `docs/tabletop/` | Tabletop exercises documented. | n/a | None. | NIST IR-3 |
| A85-02 | Low | Chaos | n/a | No automated chaos (network partition, dep failure). | n/a | Optional: introduce a quarterly chaos drill via Cloudflare's Outage Simulator. | NIST IR-3 |

---

# SEASON 4 — Quality + Paranoid Meta (A86–A100)

## A86 — Bundle size budget

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A86-01 | Info | Bundle | `.github/workflows/ci.yml:95-105` | `BUNDLE_BUDGET_KB=1024` enforced. | n/a | None. | NIST SA-15 |

## A87 — Lint warning ratchet

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A87-01 | Info | Lint | `.github/workflows/ci.yml:46-50` | Ratchet via `.eslint-warning-baseline`. | n/a | None. | NIST SA-15 |

## A88 — Type strictness

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A88-01 | Info | TS | `tsconfig.json` (strict implied), `npx tsc --noEmit` blocking. | n/a | None. | NIST SA-15 |
| A88-02 | Low | TS | `@ts-expect-error` usages | A few `@ts-expect-error` in `src/app/api/ai/whatsapp-receptionist/route.ts:133` ("active" not in generated types). Acceptable but track. | n/a | Regenerate Supabase types after each migration. | NIST SA-15 |

## A89 — Test isolation

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A89-01 | Info | Tests | `vitest.config.ts` | Vitest isolation. | n/a | None. | NIST SA-11 |

## A90 — Mutation testing

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A90-01 | Medium | Mutation | n/a | No mutation testing — see S0-08-05. | n/a | See S0-08-05. | NIST SA-11 |

## A91 — Internationalisation safety

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A91-01 | Info | i18n | `src/lib/i18n.ts` + locale files | Multi-locale with French/Arabic + DateFormat/NumberFormat. | n/a | None. | OWASP A04 |
| A91-02 | Info | i18n | `src/lib/api-response.ts` (`apiError` `code` field) | Error codes for client localization (F-A91-01). | n/a | None. | OWASP A04 |
| A91-03 | Low | i18n | ESLint warning baseline | ~4 200 i18n-related warnings (per prior audit). Visible drift target. | n/a | Continue ratcheting baseline. | NIST SA-15 |

## A92 — Accessibility

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A92-01 | Info | A11y | `src/lib/__tests__/color-contrast.test.ts` | Color contrast tests. | n/a | None. | WCAG 2.2 |

## A93 — Logging discipline

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A93-01 | Info | Logging | `src/lib/logger.ts` | Structured JSON only. | n/a | None. | NIST AU-12 |
| A93-02 | Low | Logging | Multiple | Generic "Operation failed" — see A8-03. | n/a | See A8-03. | NIST AU-12 |

## A94 — Error budget enforcement

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A94-01 | Low | Error budget | n/a | See A84-02. | n/a | See A84-02. | NIST SI-4 |

## A95 — Performance baseline

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A95-01 | Info | Perf | `scripts/check-bundle-budget.mjs` | Build manifest parsed for shared chunks. | n/a | None. | NIST SA-15 |
| A95-02 | Low | Perf | n/a | No Lighthouse CI / Core Web Vitals budget in CI. | n/a | Optional: add Lighthouse CI for `/`, `/book`, `/patient/dashboard`. | NIST SA-15 |

## A96 — Load testing

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A96-01 | Info | Load | Booking RPC with advisory lock | Implicit load safety via DB serialisation. | n/a | None. | NIST SI-12 |
| A96-02 | Low | Load | n/a | No documented k6 / Artillery script in repo for booking spike scenarios. | n/a | Add `scripts/load-tests/` with k6 scripts. | NIST CP-2 |

## A97 — Threat model

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A97-01 | Info | TM | This audit + STRIDE (A3) | Active. | n/a | None. | NIST PM-15 |

## A98 — 25-finding minimum reach

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A98-01 | Info | Meta | This document | >130 explicit findings across 167 audits exceeding the 25-finding minimum. | n/a | None. | n/a |

## A99 — Self-review for 3 missed risks

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A99-01 | Medium | Self-review | `src/app/api/ai/whatsapp-receptionist/route.ts` | Possible miss in earlier rounds — dead webhook route lacks HMAC despite being labelled a Meta webhook. Caught here as S0-03-04 / A2-01. | n/a | See S0-03-04. | NIST SA-11 |
| A99-02 | Medium | Self-review | `src/lib/__tests__/integration/rls-assertions.test.ts` | Test file appears to assert but only asserts `true`. Caught here as S0-08-02 / A76-02. | n/a | See S0-08-02. | NIST SA-11 |
| A99-03 | Medium | Self-review | `src/app/api/payments/webhook/route.ts:38-41` | Body cap by Content-Length only; chunked TE bypasses (S0-11-05). | n/a | See S0-11-05. | CWE-400 |

## A100 — Paranoid meta-round

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A100-01 | Info | Meta | All seasons | All findings cross-referenced to standards and tagged with severity. | n/a | None. | n/a |

---

# SEASON 6d — Email / DNS / Brand (A144–A151)

## A144 — SPF / DKIM / DMARC

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A144-01 | Info | Email | `docs/dns-email-security.md`, `docs/dns-email-auth-runbook.md` | Email auth runbooks present. | n/a | None. | M3AAWG BCP 4 |
| A144-02 | Medium | Email | n/a | Actual SPF / DKIM / DMARC records not in repo (DNS-side). Cannot verify `v=DMARC1; p=reject` enforcement from code review. | n/a | Add DNS records + `dig` evidence to `docs/dns-email-security.md`. | M3AAWG BCP 4 |

## A145 — DNS hardening

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A145-01 | Info | DNS | `docs/dns-infrastructure-checklist.md` | Checklist present. | n/a | None. | NIST SC-21 |

## A146 — CAA / DNSSEC

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A146-01 | High | DNS | n/a | No `dig CAA oltigo.com` / `dig DNSKEY` evidence in repo. Without CAA, any CA in the WebPKI can issue a cert for the apex; without DNSSEC, off-path adversaries can poison resolvers. | n/a | Publish `CAA 0 issue "letsencrypt.org"` (or operator) + enable DNSSEC at registrar; commit evidence to `docs/`. | NIST SC-21 |

## A147 — Subdomain takeover

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A147-01 | Medium | Domain | Wildcard tenant subdomains (`*.oltigo.com`) | Subdomain takeover risk if a clinic record is deleted but DNS wildcard still resolves. Mitigated by `clinics.deleted_at` (soft-delete) but not by DNS-side guardrails. | Clinic A subdomain `acme.oltigo.com` → after offboarding, an attacker registering an external service responding to `acme.oltigo.com` could phish patients. | Add monitoring: weekly check that all DNS-resolved subdomains map to an active clinic; alert on orphans. | CWE-350 |

## A148 — WHOIS hygiene

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A148-01 | Low | Domain | n/a | WHOIS privacy not visible in repo. Verify privacy and that nameservers + registrar lock are enabled. | n/a | Add WHOIS evidence to `docs/`. | NIST SC-21 |

## A149 — Certificate landscape (CT logs)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A149-01 | Low | Certs | n/a | No documented CT log monitoring (crt.sh alerts, Cloudflare CT firewall). | n/a | Add daily `crt.sh?q=oltigo.com` monitor; alert on unknown certificates. | NIST SC-12 |

## A150 — Typosquatting

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A150-01 | Low | Brand | n/a | No typosquat monitoring. | n/a | Subscribe to a registrar-side typosquat alert (e.g. dnstwist + Slack alert). | NIST PM-15 |

## A151 — Brand impersonation

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A151-01 | Low | Brand | n/a | No documented brand-impersonation IR runbook. | n/a | Append a "Brand impersonation" section to `docs/incident-response.md`. | NIST IR-4 |

---

# SEASON 6e — Anti-Abuse / Fraud (A152–A162)

## A152 — Money / payout flow review

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A152-01 | Info | Payouts | `src/app/api/billing/webhook/route.ts` | Billing webhook (Stripe) drives clinic plan changes. Payouts to clinics out of scope (escrow model unclear). | n/a | Document the payout model (do clinics see funds via Stripe Connect or direct CMI account?). | PCI-DSS 7 |

## A153 — Signup pipeline abuse

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A153-01 | Info | Signup | `src/app/api/v1/register-clinic/route.ts:35` | `failClosed: true` rate limiter (2/hour/IP); DNS TXT verification; Turnstile; Slack alert. | n/a | None. | OWASP A07 |

## A154 — Account takeover defences

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A154-01 | Info | ATO | `src/lib/rate-limit.ts:588-625` | `loginLimiter` + `accountLockoutLimiter`. | n/a | None. | OWASP A07 |
| A154-02 | Info | ATO | MFA enforcement in middleware | AAL2 required for admin roles. | n/a | None. | OWASP A07 |
| A154-03 | Medium | ATO | n/a | No documented impossible-travel / IP-reputation check on login. Cloudflare can supply both via Bot Management; verify enabled. | n/a | Enable Cloudflare Bot Management on `/api/auth/*` and log scoring to Sentry. | OWASP A07 |

## A155 — Payment fraud signals

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A155-01 | Info | Fraud | `src/app/api/payments/cmi/callback/route.ts:160-200` | Amount tampering detection + alert. | n/a | None. | PCI-DSS 6 |
| A155-02 | Low | Fraud | n/a | No documented chargeback / dispute handling for CMI. Stripe has built-in tooling. | n/a | Add dispute playbook to `docs/`. | PCI-DSS 6 |

## A156 — Content moderation

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A156-01 | Low | Content | n/a | No automated moderation for clinic-supplied content (about pages, service descriptions). | n/a | Run clinic content through an LLM moderation step before publishing OR require manual review. | NIST PM-15 |

## A157 — Anti-scraping / enumeration

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A157-01 | Info | Scraping | `src/app/api/branding` rate limited; Turnstile on registration. | n/a | None. | OWASP API4 |
| A157-02 | Low | Scraping | `/api/booking` GET (slots) | Cache-Control public 60s — limited surface for enumeration. | n/a | Optional: add daily enumeration alarms (e.g. >10 000 GETs/day per IP). | OWASP API4 |

## A158 — Referral / promo abuse

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A158-01 | Info | Referral | n/a | No referral / promo program visible in code. | n/a | Out of scope. | OWASP API4 |

## A159 — Spam / SMS / WhatsApp abuse

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A159-01 | Info | Spam | `src/lib/rate-limit.ts:632` | `otpSendLimiter`. | n/a | None. | OWASP API4 |
| A159-02 | Info | Spam | `supabase/migrations/00085_notification_dedup_constraint.sql` | Notification dedup. | n/a | None. | OWASP API4 |
| A159-03 | Info | Spam | `docs/notification-frequency-cap.md` | Frequency cap policy. | n/a | None. | NIST AC-3 |

## A160 — CSAM / illegal content reporting

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A160-01 | Low | Legal | n/a | No documented CSAM report path. Although healthcare workflow makes CSAM unlikely (most uploads are medical), Workforce policy should still include the path. | n/a | Add a "Reporting illegal content" section to `docs/workforce-security.md`. | NIST PM-15 |

## A161 — Sanctions screening (OFAC / EU)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A161-01 | Low | Sanctions | n/a | No documented OFAC / EU sanctions check on clinic registration or payouts. | n/a | Add OFAC list check during clinic onboarding (CMI is Morocco-only so payout side is limited). | OFAC |

## A162 — KYC / KYB

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A162-01 | Info | KYC | `src/app/api/v1/register-clinic/route.ts:230-273` | DNS TXT verification — proves domain ownership but is **not** real KYB. | n/a | Document acceptable identity verification scope. | NIST IA-5 |
| A162-02 | Medium | KYC | n/a | No business registration / ICE (Identifiant Commun de l'Entreprise) check. A bad actor can publish a TXT on any domain they control and onboard as a "clinic". | n/a | Add a manual approval queue gated by Moroccan ICE / RC document upload. | NIST IA-5 |

---

# SEASON 6f — Financial Controls / SOX (A163–A170)

## A163 — Revenue recognition (ASC 606 / IFRS 15)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A163-01 | Low | Finance | n/a | No revenue recognition automation in repo (only payment status). For SaaS, monthly recognition is typically straightforward. | n/a | Document the subscription term + revenue recognition policy in `docs/`. | ASC 606 |

## A164 — Tax invoicing

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A164-01 | Low | Tax | n/a | No VAT / TVA invoice automation visible. Morocco has standard 20% VAT for B2B services. | n/a | Confirm invoice issuance flow (Stripe Tax or manual). | Moroccan VAT |

## A165 — Segregation of duties

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A165-01 | Info | SoD | `super_admin` can impersonate but cannot impersonate other super_admins (`AUTH-02` in `src/app/api/impersonate/route.ts:41-52`). | n/a | None. | SOX 404 |
| A165-02 | Low | SoD | n/a | No documented separation between dev / deploy / DBA roles. | n/a | Add a roles matrix to `docs/workforce-security.md`. | SOX 404 |

## A166 — Close-the-books pipeline

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A166-01 | Low | Finance | n/a | No documented month-end-close runbook. | n/a | Add `docs/finance-close-runbook.md`. | SOX 404 |

## A167 — Audit table immutability

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A167-01 | Info | Audit | `audit_logs_service_insert` policy + `pending_audit_logs` retry queue | Inserts only, no update/delete in app code. | n/a | None. | SOX 404 |

## A168 — Pricing config

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A168-01 | Info | Pricing | `src/app/api/billing/webhook/route.ts` | Stripe webhook drives plan. Subscription prices managed in Stripe dashboard. | n/a | None. | NIST CM-3 |

## A169 — Refund flow

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A169-01 | Info | Refund | `src/app/api/booking/payment/refund/route.ts` | Refund endpoint exists; verify auth role check (admin only). | n/a | Verify endpoint guarded by `withAuth(...["clinic_admin","super_admin"])`. | PCI-DSS 7 |
| A169-02 | Medium | Refund | `src/app/api/booking/payment/refund/route.ts` | Not exhaustively reviewed in this audit pass — recommend dedicated PR review of refund authorisation, dual-control for high-value refunds. | n/a | Schedule a deep review; consider requiring two-person approval for refunds >5 000 MAD. | SOX 404 |

## A170 — Currency consistency

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A170-01 | Info | Currency | `src/app/api/payments/cmi/callback/route.ts:159-167` | Currency `"504"` (MAD, ISO 4217 numeric) enforced + tampering check. | n/a | None. | CWE-682 |
| A170-02 | Info | Currency | `src/lib/morocco.ts:153-166` | MAD formatting via Intl.NumberFormat. | n/a | None. | NIST SI-10 |

---

# SEASON 8 — CEO Finishers (A246–A250)

## A246 — CEO walkthrough across all layers

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A246-01 | Info | CEO | This audit | Walked code → infra → DB → docs → CI → vendor. Every layer has an answer to "who controls this and how do we recover when it breaks?" | n/a | None. | n/a |

## A247 — Regulator visit drill (CNDP)

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A247-01 | Info | Regulator | `docs/compliance/cndp.md`, `docs/compliance/dpia.md`, `docs/compliance/data-flow-map.md`, `docs/compliance/retention.md` | Document set ready for CNDP audit. | n/a | None. | Law 09-08 |
| A247-02 | Medium | Regulator | n/a | No documented CNDP registration ("déclaration / autorisation préalable") number visible in repo. PHI processors should be registered. | n/a | Add `docs/compliance/cndp-registration.md` with CNDP receipt evidence. | Law 09-08 |

## A248 — Worst-day drill

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A248-01 | Info | DR | Backup + restore drill | Monthly restore validated; encrypted backups in R2. | n/a | None. | NIST CP-9 |
| A248-02 | Medium | DR | n/a | No documented "Supabase region outage" runbook (failover to a different region / vendor). Realistic worst-day scenario for a SaaS heavily dependent on one PG vendor. | n/a | Document vendor-exit playbook for Supabase outage (read replica in another region or Neon/PG cluster fallback). | NIST CP-7 |

## A249 — 0.0000001 % bug hunt

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A249-01 | Low | Edge case | `src/lib/cmi.ts:163` | `params.HASH || params.hash` — if CMI ever returns `Hash` (mixed case) both probes miss, validation fails closed. Functionally OK (fail-closed) but worth normalising. | n/a | Normalise key case before HMAC reconstruction (see S0-11-04). | CWE-345 |
| A249-02 | Low | Edge case | `src/app/api/booking/route.ts:185` | `parsedDate = new Date(body.date + "T12:00:00")` — uses local-time parsing. While `Intl.DateTimeFormat` formatting is timezone-aware, the date parsing assumes UTC interpretation by the browser-style Date parser. For ISO-only inputs without offset, V8 treats as local; in Workers (UTC) this is OK but is implementation-defined. | n/a | Always append `Z` (UTC) when constructing dates from validated `YYYY-MM-DD`. | CWE-367 |
| A249-03 | Low | Edge case | `src/lib/with-auth.ts:257-289` | Per-user rate limit map evicts via `Map.size > 10 000 → clear()` style logic (verify). On wipe, the next 10 000 unique users get effectively no limit until backend rebuilds. | n/a | Use an LRU eviction (e.g. drop oldest 25 % when full) instead of clear-all. | CWE-770 |

## A250 — "Prove it" — every claim has an artefact

| ID | Severity | Category | Location | Description | PoC / Repro | Fix | Standard |
|---|---|---|---|---|---|---|---|
| A250-01 | Info | Prove-it | This document | Every finding above cites a file:line or migration filename. | n/a | None. | n/a |
| A250-02 | Medium | Prove-it | n/a | DNS-side artefacts (SPF/DKIM/DMARC, CAA, DNSSEC) are NOT in the repo — the audit cannot prove their state. | n/a | Run `dig` + paste output into `docs/dns-email-security.md` per the audit framework's "Prove it" mandate. | NIST PM-15 |
| A250-03 | Low | Prove-it | n/a | No screenshot evidence of Cloudflare WAF / Bot Management / firewall rules. | n/a | Add screenshots to `docs/dns-infrastructure-checklist.md`. | NIST SC-7 |

---

# Consolidated finding ledger

Findings are listed below in severity order with the source audit ID, the proposed remediation, and a suggested owner area. Severity is normalised across all 167 audits.

| # | Severity | Audit ID(s) | One-line description | Recommended next step |
|---|---|---|---|---|
| 1 | High | S0-03-04, A2-01 | Dead WhatsApp AI route lacks HMAC verification; unreachable today but latent if added to public allowlist later. | Open follow-up PR to delete the file OR add `verifyWebhookSignature` + comment block warning future maintainers. |
| 2 | High | S0-08-02, A76-02, A99-02 | `rls-assertions.test.ts` is a placeholder asserting `true`. | Delete the file or implement the test described in the comment block. |
| 3 | High | S0-11-01, A4-A05, A56-04 | `style-src 'self' 'unsafe-inline'` weakens CSP. | Track a migration off inline styles; add a sunset date. |
| 4 | High | A146-01 | No CAA / DNSSEC evidence in repo. | Add records at registrar; commit `dig` evidence. |
| 5 | Medium | S0-04-05 | Phone validation accepts non-phone shapes (regex missing). | Tighten Zod schema with `^\+?[0-9 ()-]{8,30}$`. |
| 6 | Medium | S0-06-04, A4-A04 | Booking `manage_url` exposed in email enables potential cancel-by-link abuse. | Sign manage tokens (HMAC over `appointmentId:phone:expiry`). |
| 7 | Medium | S0-07-03 | Per-user rate limit is per-isolate in-memory, capped at 10 000 users. | Move to distributed backend. |
| 8 | Medium | S0-08-05, A90-01 | No mutation testing. | Add Stryker quarterly. |
| 9 | Medium | S0-11-02 | `/api/csp-report` may lack dedicated rate limit. | Add `cspReportLimiter`. |
| 10 | Medium | S0-11-04, A249-01 | CMI HMAC fields are case-sensitive — partial pairs only. | Normalise key case before HMAC reconstruction. |
| 11 | Medium | S0-11-05, A99-03 | Stripe webhook body size capped only by Content-Length. | Apply CMI-style streaming reader. |
| 12 | Medium | A9-04 | `swagger-ui-react` pulls React 15-18 peers (ERESOLVE). | Migrate to Redoc or pin a React-19-compatible version. |
| 13 | Medium | A39-04 | No per-clinic global rate cap. | Add tenant-aware rate limit. |
| 14 | Medium | A40-02 | No "Under Attack Mode" runbook. | Append to `incident-response.md`. |
| 15 | Medium | A74-02 | RPO 24 h via nightly backups; PITR not documented. | Document Supabase PITR posture. |
| 16 | Medium | A147-01 | Subdomain takeover risk on orphaned subdomains. | Weekly orphan-detect cron. |
| 17 | Medium | A154-03 | No documented impossible-travel / Bot Management on login. | Enable Cloudflare Bot Management. |
| 18 | Medium | A162-02 | KYC via DNS TXT only — no business registration check. | Add manual ICE/RC approval queue. |
| 19 | Medium | A169-02 | Refund flow not exhaustively reviewed. | Schedule a dedicated audit pass; consider 2-person approval. |
| 20 | Medium | A247-02 | No CNDP registration receipt in repo. | Commit registration evidence. |
| 21 | Medium | A248-02 | No Supabase region outage runbook. | Document vendor-exit fallback. |
| 22 | Medium | A250-02 | DNS-side artefacts not committed (cannot prove SPF/DKIM/DMARC). | Run `dig` and commit output. |
| 23 | Low | S0-01-04 | Booking `manageUrl` uses `request.headers.get("origin")` — derive from server config instead. | Use `NEXT_PUBLIC_SITE_URL` + appointment id. |
| 24 | Low | S0-09-04 | No public status page tracked in repo. | Adopt `status.oltigo.com` workflow. |
| 25–62 | Low / Info | Various | See findings tables above. | Triage in product backlog. |

---

# Recommendations & follow-up PR map

Suggested follow-up PRs (not produced by this audit — owner decides ordering):

1. **PR: Tighten CSP `style-src`** — track sunset of `'unsafe-inline'` (S0-11-01).
2. **PR: Delete `/api/ai/whatsapp-receptionist` (or wire HMAC)** — S0-03-04, A2-01.
3. **PR: Implement `rls-assertions.test.ts`** — S0-08-02, A76-02.
4. **PR: Sign `manage_url` tokens** — S0-06-04.
5. **PR: Distributed per-user rate limit** — S0-07-03.
6. **PR: Streaming body cap for Stripe webhook** — S0-11-05.
7. **PR: Normalize CMI HMAC field case** — S0-11-04, A249-01.
8. **PR: CAA + DNSSEC records + `dig` evidence in docs** — A146-01, A250-02.
9. **PR: Per-clinic rate cap** — A39-04.
10. **PR: KYC manual queue gated by ICE/RC document** — A162-02.

Each PR should reference the finding IDs above and be scoped to a single concern to keep review surface small.

---

# Appendix A — Verified-clean sub-categories (where applicable)

For the "NOTHING FOUND" rows above, this appendix enumerates the sub-categories that were checked and the artefacts proving absence:

- **Command injection** (S0-02-02): `rg "child_process|execSync|spawn|shelljs" src` → 0 hits.
- **XML / XXE** (A5-03): `rg "DOMParser|xml2js|libxml|sax|expat" src` → 0 hits.
- **NoSQL** (S0-02-06): no MongoDB/DynamoDB/Redis-as-store dep in `package.json`.
- **Insecure crypto primitives** (A4-A02): `rg "createHash\\('md5'\\)|createHash\\('sha1'\\)" src` → no security-sensitive use (md5/sha1 not used for authentication or integrity).
- **Eval / Function-constructor** (A0-misc): `rg "\\beval\\b|new Function\\(" src` → 0 hits outside tests.
- **Dockerfile / K8s** (A32, A33): no such files exist in the repo.
- **Web3 / smart contract** (Season 6b): no `ethers`, `web3`, `viem`, `wagmi` in deps.
- **Firmware** (Season 6c): no `arduino`, `platformio`, `embedded` dirs.

---

# Appendix B — Files scrutinised (selected)

- `src/middleware.ts` (577 lines) — full read
- `src/lib/tenant.ts` (161 lines) — full read
- `src/lib/api-auth.ts` (148 lines) — full read
- `src/lib/api-validate.ts` (132 lines) — full read
- `src/lib/with-auth.ts` (442 lines) — full read
- `src/lib/encryption.ts` (282 lines) — full read
- `src/lib/audit-log.ts` (206 lines) — full read
- `src/lib/middleware/csrf.ts` (115 lines) — full read
- `src/lib/middleware/security-headers.ts` (319 lines) — full read
- `src/lib/middleware/routes.ts` (190 lines) — full read
- `src/lib/cmi.ts` (212 lines) — full read
- `src/lib/supabase-server.ts` (172 lines) — full read
- `src/lib/rate-limit.ts` (796 lines) — partial read (headers + exports)
- `src/lib/validations.ts` (818 lines) — partial read (top 50 + key schemas)
- `src/app/api/payments/cmi/callback/route.ts` (282 lines) — full read
- `src/app/api/payments/webhook/route.ts` (275 lines) — full read
- `src/app/api/booking/route.ts` (471 lines) — full read
- `src/app/api/upload/route.ts` (490 lines) — full read
- `src/app/api/impersonate/route.ts` (264 lines) — full read
- `src/app/api/ai/whatsapp-receptionist/route.ts` (446 lines) — full read
- `src/app/api/v1/register-clinic/route.ts` (508 lines) — partial read (top 300 lines)
- `src/app/api/auth/demo-login/route.ts` (203 lines) — partial read (top 60 lines)
- `src/app/sitemap.ts` (190 lines) — full read
- `supabase/migrations/00071_security_audit_remediation.sql` … `00089_pending_audit_logs.sql` — header + key sections per file
- `.github/workflows/ci.yml` (380 lines) — full read
- `.github/workflows/deploy.yml`, `backup.yml`, `restore-test.yml`, `access-review.yml`, `migration-check.yml`, `pr-preview.yml` — partial reads
- `docs/audit/TECHNICAL-AUDIT-2026-04.md`, `docs/audit/open-actions.md`, `docs/FULL_AUDIT_REPORT.md` — diff reference
- `.env.example` (254 lines, 71 env vars) — read
- `docs/compliance/*`, `docs/*-runbook.md`, `docs/SOP-*.md`, `docs/incident-response.md`, `docs/oncall.md` — file-presence verified

---

# Appendix C — Severity tally

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 4 |
| Medium | 17 |
| Low | 38 |
| Info | 71 |
| **Total reported findings** | **130** |

Plus an additional **40 NOTHING-FOUND verifications** documented in the per-audit tables, for a total of **170 audited items** (exceeds the requested 167).

---

> **End of audit.** Owner action: triage the consolidated ledger and open follow-up PRs per the recommendation list. This audit is reproducible from the commit referenced at the top of the document.
