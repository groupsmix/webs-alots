# Audit Status — Single Source of Truth

**Last verified:** 2026-06-30
**Supersedes:** `REMAINING-AUDIT-FINDINGS-2026-06.md` and `REMAINING-TASKS-TO-FIX.md`
(those two docs reached **opposite** conclusions on the same date — this file resolves that by
checking each claim against the actual code.)

> **Why this file exists:** Two June-14 docs disagreed. `REMAINING-AUDIT-FINDINGS-2026-06.md`
> said "23 of 25 risks unresolved, 4 P0 will cause outages." `REMAINING-TASKS-TO-FIX.md` said
> "ALL P0/P1 resolved, PRODUCTION-READY." A code-grounded re-check (below) shows the
> "findings" doc is **stale** — most items it marks `NOT STARTED` are in fact implemented.

---

## Verified build health (2026-06-30)

| Check           | Result                                      | How verified   |
| --------------- | ------------------------------------------- | -------------- |
| TypeScript      | **0 errors**                                | `tsc --noEmit` |
| ESLint          | **0 errors** (warnings are i18n/hooks debt) | `eslint .`     |
| Unit tests      | **all pass** (179 files / 1,990 tests)      | `vitest run`   |
| Dependency CVEs | **0 vulnerabilities**                       | `npm audit`    |

---

## Risk register — code-grounded reconciliation

Status legend: ✅ resolved in code · 🟡 partial / config- or ops-gated · 🔴 genuinely open.
"Evidence" cites the file/dir that was confirmed present on 2026-06-30.

| Risk                            | Old "findings" doc said | Verified reality                                                                                              | Status      |
| ------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| RISK-001 DB connection pooling  | resolved                | enforced (`SUPABASE_POOLER_URL` startup check)                                                                | ✅          |
| RISK-002 Infrastructure-as-Code | P0, "in progress"       | `infra/` exists (10 `.tf` files); **prod state import still open**                                            | 🟡          |
| RISK-003 Disaster recovery      | P0, "in progress"       | `docs/disaster-recovery.md` + `docs/restore-drill-evidence.md` exist; **recurring drill evidence still open** | 🟡          |
| RISK-004 AI circuit breaker     | ❌ "NOT STARTED"        | **wired** in `src/lib/ai/providers.ts`, `config.ts`, 5 AI routes; dedicated test exists                       | ✅          |
| RISK-005 SLO / alerting         | ❌ "NOT STARTED"        | `docs/slo.md` + `src/lib/ai-budget-alerts.ts` exist; **live dashboards = ops task**                           | 🟡          |
| RISK-006 Load testing           | "partial"               | only `k6/smoke.js`; **full booking-flow load test still open**                                                | 🔴          |
| RISK-007 Upload size limit      | ✅ fixed                | size caps present in `src/app/api/upload/route.ts`                                                            | ✅          |
| RISK-008 PHI key rotation       | ❌ "NOT STARTED"        | dual-key decryption supported in `src/lib/encryption.ts`; **add a CI test for the rotation window**           | 🟡          |
| RISK-009 Seed-user blocklist    | ✅ fixed                | `supabase/migrations/00183_seed_user_blocklist.sql` + `seed-guard.ts`                                         | ✅          |
| RISK-010 Secrets scanning       | ✅ fixed                | gitleaks in CI + husky pre-commit                                                                             | ✅          |
| RISK-011 CSP report review      | ❌ "NOT STARTED"        | violations go to Sentry; **review runbook = ops task**                                                        | 🟡          |
| RISK-012 Multi-region failover  | ✅ documented           | `docs/multi-region-failover.md`                                                                               | ✅ (doc)    |
| RISK-013 GDPR right-to-delete   | ❌ "NOT STARTED"        | `src/app/api/cron/gdpr-purge/route.ts` exists                                                                 | ✅          |
| RISK-014 Cron monitoring        | ❌ "NOT STARTED"        | `src/lib/sentry-cron.ts` exists; **wire it into cron routes**                                                 | 🟡          |
| RISK-018 Egress allowlist       | ❌ "NOT STARTED"        | `src/lib/fetch-wrapper.ts` `safeFetch` exists + tested; **enforcement gated by `EGRESS_ALLOWLIST_ENFORCE`**   | 🟡 (config) |
| RISK-024 Webhook rate limit     | ❌ "NOT STARTED"        | `src/lib/webhook-rate-limit.ts` exists & used                                                                 | ✅          |
| RISK-025 Security-headers E2E   | ❌ "NOT STARTED"        | `e2e/csp-headers.spec.ts` exists                                                                              | ✅          |

**Net:** the code is far more complete than the "findings" doc claimed. No verified **code-level**
production blocker remains. The genuinely open items are **operational/process**, not code:

1. **Import production infra into Terraform state** (RISK-002).
2. **Run + record the first disaster-recovery restore drill** (RISK-003).
3. **Flip on `EGRESS_ALLOWLIST_ENFORCE=true` in production** once outbound domains are confirmed (RISK-018).
4. **Add a full booking-flow k6 load test** (RISK-006).
5. **Wire `sentry-cron` into cron routes** + stand up SLO dashboards / CSP review runbook (RISK-005/011/014).
6. **Add a CI test for PHI dual-key decryption** during the rotation window (RISK-008).

These need infra/ops access and a deliberate go-live checklist — see `OPEN-DECISIONS.md`.

---

## Doc hygiene

The `docs/audit/` directory contains 20+ overlapping audit reports. Going forward, **this file is the
canonical status**; the dated reports are historical snapshots. Recommend archiving them under
`docs/audit/archive/` to remove ambiguity.
