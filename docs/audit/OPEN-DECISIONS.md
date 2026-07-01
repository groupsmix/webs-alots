# Open Decisions & Playbooks

**Created:** 2026-06-30
Companion to `CURRENT-STATUS.md`. This file holds the items that need a **human decision**
(product/business/ops) or a **content effort**, plus copy-paste-ready playbooks so they can be
executed quickly. None of these are safe for a tool to auto-apply.

---

## 1. License field — decision needed

- `package.json` declares `"license": "UNLICENSED"`, but the repo ships a `LICENSE` file and
  `THIRD_PARTY_LICENSES.md`.
- **Decide:** is this proprietary (keep `UNLICENSED` and confirm `LICENSE` matches) or open-source
  (set the correct SPDX identifier, e.g. `"MIT"`)? One-line change once the business answer is known.

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
- [ ] **RISK-008** Add a CI test for PHI dual-key decryption during the rotation window (code supports it).

---

## 4. Unwired feature scaffolding — keep or cut?

`knip` flags these as unused. They are **intended features not yet wired**, not garbage. Do **not**
bulk-delete — decide per item. (Note `RateLimiterDO` is referenced in `wrangler.toml`, not via TS
imports, so it must NOT be removed regardless of knip.)

| Item                                                                                        | What it is                                                                       | Recommendation                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/video/client.ts`                                                                   | Twilio video telemedicine client                                                 | Keep if telemedicine is on the roadmap. **If kept and wired, add `video.twilio.com` to the `safeFetch` egress allowlist** (only `api.twilio.com` is listed today). Otherwise cut. |
| `src/components/dental/lab-orders-panel.tsx` + `LabOrder`/`fetchLabOrders`/`createLabOrder` | Dental lab-orders feature (UI + data layer)                                      | Keep if dental lab orders are planned; otherwise cut the whole set together.                                                                                                      |
| `src/lib/types/patient-metadata.ts`                                                         | A `PatientMetadata` type its docstring says is "used across AI routes" but isn't | Likely safe to remove (redundant type), low value either way.                                                                                                                     |
| ~278 other unused exports                                                                   | API-contract Zod schemas, security/GDPR fns, infra bindings                      | Leave. They're public surface / config-bound. Trim only as part of cutting a specific feature.                                                                                    |

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
- [ ] `src/lib/encryption.ts` — encrypt/decrypt round-trip + dual-key rotation window (also closes RISK-008).
- [ ] `src/lib/tenant.ts` / `src/lib/assert-tenant.ts` — tenant-scope enforcement & fail-closed behavior.
- [ ] `src/lib/with-auth.ts` — role gating / deny-by-default.
- [ ] `src/lib/rate-limit.ts` — limiter + fail-closed circuit behavior.
- [ ] `src/lib/validations/*` — schema accept/reject cases for the heavily-used schemas.

Each merged PR should ratchet `.vitest-coverage-floor.json` upward (never down), per the existing
FE-006 convention in `vitest.config.ts`.
