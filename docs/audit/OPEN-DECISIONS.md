# Owner Decisions & Playbooks

**Created:** 2026-06-30 · **Owner decisions recorded:** 2026-06-30
Companion to `CURRENT-STATUS.md`.

Context: **pre-launch, no real users yet.** The product owner delegated these calls. This file
records the **decisions made** and leaves only the items that physically require cloud/deploy access
or a professional translator.

## Owner decisions — summary

| #   | Item                                                              | Decision                                                                                                                                           | Status                 |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | License                                                           | **Keep proprietary** (`UNLICENSED` + `private:true` + `LICENSE` are already consistent)                                                            | ✅ resolved, no change |
| 2   | `patient-metadata.ts` (redundant type)                            | **Cut** — superseded, 0 references                                                                                                                 | ✅ done                |
| 3   | `video/client.ts` telemedicine + dental lab-orders + ~278 exports | **Keep** — real unwired features / config-bound / API contracts; zero runtime cost (tree-shaken)                                                   | ✅ decided             |
| 4   | i18n (~3,365 strings)                                             | **Defer to a professional translator, post-MVP** — app renders in French today; not a launch blocker; medical Arabic must not be machine-generated | ⏸ deferred             |
| 5   | Egress allowlist enforcement                                      | **Enable at next deploy** (`EGRESS_ALLOWLIST_ENFORCE=true`) — ideal pre-launch window                                                              | ⏳ needs deploy access |
| 6   | DR drill, IaC prod-import, SLO dashboards, sentry-cron wiring     | **Assign to the Cloudflare/Supabase account owner** — cannot be done from the repo                                                                 | ⏳ needs cloud access  |

The remaining ⏳ items are the **real pre-launch checklist** and need whoever administers the
Cloudflare + Supabase accounts. Details and playbooks below.

---

## 1. License — DECISION: keep proprietary ✅

Verified consistent, **no change needed**: `package.json` has `"private": true` +
`"license": "UNLICENSED"`, and `LICENSE` is an all-rights-reserved proprietary notice
(© Oltigo Health / MediaHoly). This is the correct setup for a closed-source commercial SaaS.
(The earlier "mismatch" flag was a false alarm.)

---

## 2. Disaster-recovery restore drill — operational (RISK-003)

The code/docs exist (`docs/disaster-recovery.md`, `docs/restore-drill-evidence.md`,
`.github/workflows/restore-test.yml`). What's missing is **recorded evidence of a successful drill**.
This must be run by someone with infra access — checklist:

- [ ] Confirm where `BACKUP_ENCRYPTION_KEY` and `PHI_ENCRYPTION_KEY` live (out-of-band inventory).
- [ ] Spin up a scratch Supabase project; restore the latest R2 backup into it.
- [ ] Verify row counts on `patients`, `appointments`, `prescriptions` match the source snapshot.
- [ ] Time the restore end-to-end; confirm it meets the RTO target (<4h).
- [ ] Record date, operator, duration, and result in `docs/restore-drill-evidence.md`.
- [ ] Update `LAST_RESTORE_TEST_AT` so `/api/health/internal` reflects the drill age.

---

## 3. Production go-live checklist (the genuinely-open items)

From `CURRENT-STATUS.md`, the open work is operational, not code:

- [ ] **RISK-002** Import existing prod/staging Cloudflare resources into Terraform state before first `apply`.
- [ ] **RISK-018** Set `EGRESS_ALLOWLIST_ENFORCE=true` in production (after confirming all outbound
      domains in `src/lib/fetch-wrapper.ts` are present). The mechanism is built & tested; it's just gated off.
- [ ] **RISK-006** Add `k6/booking-flow.js` (login → create appointment → upload → cancel) and wire into CI.
- [ ] **RISK-005/011/014** Stand up SLO dashboards, a CSP-report review runbook, and wire `sentry-cron`
      into the cron routes.

> **Note:** RISK-008 (PHI dual-key rotation) is **already covered** — `encryption.test.ts` (`SEC-013`)
> tests encrypt-with-old / decrypt-after-rotation and the fail-when-neither-key-matches path.

---

## 4. Unwired feature scaffolding — DECISIONS recorded

`knip` flags these as unused. They are **intended features not yet wired**, not garbage.
**Owner decision:** keep the real features (zero runtime cost — they are tree-shaken out of the
bundle), and cut only genuinely-redundant/superseded code. Do **not** bulk-delete: `RateLimiterDO`
is referenced in `wrangler.toml` (not via TS imports), and the Zod schemas are API contracts.

| Item                                                                                        | What it is                                                                   | Decision                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/types/patient-metadata.ts`                                                         | Redundant `PatientMetadata` type (docstring claims usage that doesn't exist) | **CUT** ✅ (done — 0 references, superseded)                                                                                                                                                                                           |
| `src/lib/video/client.ts`                                                                   | Twilio video telemedicine client                                             | **KEEP** — a coherent, complete module for a plausible healthcare roadmap feature; not redundant, just unwired. **If/when wired, add `video.twilio.com` to the `safeFetch` egress allowlist** (only `api.twilio.com` is listed today). |
| `src/components/dental/lab-orders-panel.tsx` + `LabOrder`/`fetchLabOrders`/`createLabOrder` | Dental lab-orders feature (UI + data layer)                                  | **KEEP** — real unwired feature; revisit when dental lab orders are scheduled or formally descoped.                                                                                                                                    |
| ~278 other unused exports                                                                   | API-contract Zod schemas, security/GDPR fns, infra bindings                  | **KEEP** — public surface / config-bound. Trim only when cutting a specific feature.                                                                                                                                                   |

**Rationale:** cutting real unwired features saves ~0 bytes at runtime but risks breaking the build
(their exports are interdependent) and destroys intended work. Revisit per-feature as each is wired
or descoped — a product-roadmap moment, not an audit cleanup.

---

## 5. i18n backfill — content effort (≈3,365 strings)

**Infra is solid and the pattern is already established** — see `src/components/offline-indicator.tsx`
for the canonical example. The remaining `i18next/no-literal-string` warnings are hardcoded JSX text
in components that haven't been converted yet.

### Why this isn't an auto-fix

`scripts/check-translations.mjs` enforces **0 empty EN/AR values** (`.translation-empty-baseline = 0`).
So every new key needs a **real** French, English, AND Arabic value. For a healthcare product, the
Arabic (incl. RTL + medical terminology) should come from a professional translator — not machine output.

### Per-component playbook (copy-paste)

1. Add the plumbing (client components):
   ```tsx
   import { useLocale } from "@/components/locale-switcher";
   import { t } from "@/lib/i18n";
   // inside the component:
   const [locale] = useLocale();
   ```
2. Replace each literal: `<span>Enregistrer</span>` → `<span>{t(locale, "common.save")}</span>`
3. Add the key to **all three** files with real translations (keep keys sorted/grouped):
   - `src/locales/fr.json`: `"common.save": "Enregistrer"`
   - `src/locales/en.json`: `"common.save": "Save"`
   - `src/locales/ar.json`: `"common.save": "حفظ"`
4. Run `node scripts/check-translations.mjs` (must stay at 0 empties) and `npx eslint <file>`.

### Suggested sequencing

Start with shared UI primitives (buttons, table headers, empty/loading/error states) — they're
generic, safe to translate, and reused everywhere, so they knock out many warnings at once. Defer
long-form marketing/landing copy until a translator is engaged.

---

## 6. Test-coverage plan (floor ~14% → target 80%)

`vitest run` passes (1,990 tests) but the coverage floor is low. Prioritize **security-critical,
pure-logic** modules first (high value, easy to test without heavy mocking):

- [x] `src/lib/insurance/client.ts` — **done** (`src/lib/__tests__/insurance-client.test.ts`).
- [x] `src/lib/idempotency.ts` — **done** (`src/lib/__tests__/idempotency.test.ts`): determinism,
      SHA-256 vector, separator collision-safety for both sync/async variants.
- [x] `src/lib/encryption.ts` — **already covered** (`encryption.test.ts`, incl. `SEC-013` rotation).
- [x] `src/lib/tenant.ts` / `assert-tenant.ts` / `with-auth.ts` / `rate-limit.ts` / `crypto-utils.ts` —
      **already covered** (dedicated test files exist).
- [ ] `src/lib/validations/*` — schema accept/reject cases for the heavily-used schemas (partial coverage today).
- [ ] Broaden coverage on data-layer + API route handlers (the largest remaining untested surface).

Each merged PR should ratchet `.vitest-coverage-floor.json` upward (never down), per the existing
FE-006 convention in `vitest.config.ts`.
