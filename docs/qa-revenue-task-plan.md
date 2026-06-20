# Revenue Section QA — Actionable Task Plan

Source: Oltigo.com Revenue Section QA Test Report (June 19, 2026)
Scope: Super Admin → Billing · Pricing & Tiers · Subscriptions
Verified against code on June 20, 2026.

This plan maps each QA finding to the exact source location, states the root
cause confirmed in code, and rates how safely an **AI sub-agent** can apply the
fix autonomously.

## Sub-agent applicability legend

| Rating            | Meaning                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 AUTONOMOUS     | Root cause confirmed in code. Deterministic, self-contained fix. A sub-agent can implement and verify with `npm run typecheck` + `npm run test` + `npm run lint`.    |
| 🟡 DECISION-FIRST | Fix is mechanical, but needs one product/UX/data decision before coding. Once decided, a sub-agent can apply it.                                                     |
| 🔴 NEEDS-HUMAN    | Requires DB schema/seed changes, backend wiring, live reproduction, or a large cross-cutting effort. A sub-agent should investigate and propose, not blindly change. |

## Key files

- `src/app/(super-admin)/super-admin/billing/page.tsx`
- `src/app/(super-admin)/super-admin/pricing/page.tsx`
- `src/app/(super-admin)/super-admin/subscriptions/page.tsx`
- `src/lib/super-admin-actions.ts` (`fetchBillingRecords`, `fetchClientSubscriptions`, `fetchPricingTiers`)
- `src/lib/export-utils.ts` (`exportToPDF`)
- `src/lib/utils.ts` (`formatCurrency`)
- `src/components/layouts/super-admin-layout-shell.tsx` (sidebar nav)
- `src/lib/config/pricing.ts` (labels, tier slugs, status colors)

---

## Track A — Autonomous (sub-agent can implement + self-verify)

### A1 · B6 / I4 — "Annulé" vs "Suspendu" terminology mismatch 🟢 (Critical)

- **Where:** `subscriptions/page.tsx` and `pricing/page.tsx` KPI "Problèmes/Impayés" cards.
- **Root cause (confirmed):** `stats.cancelled = subscriptions.filter(s => s.status === "cancelled" || s.status === "suspended").length`, then the card labels the whole number `… annulés`. Suspended accounts are counted as cancelled.
- **Fix:** Split the metric into `suspended` and `cancelled` counts and label each correctly (e.g. `{stats.pastDue} impayés · {stats.suspended} suspendus · {stats.cancelled} annulés`). Reuse the existing `statusLabel()` mapping for consistency.
- **Acceptance:** Card text distinguishes suspended from cancelled; counts add up to the "Problèmes" total; `npm run typecheck` + `npm run test` pass.

### A2 · I1 — Billing summary cards ignore active filters 🟢

- **Where:** `billing/page.tsx`.
- **Root cause (confirmed):** `mrr`, `arr`, `totalRevenue`, `paidCount`, `overdueAmount` are derived from `records` (full set), but the table renders `filtered`.
- **Fix:** Compute the KPI values from `filtered` so cards react to search/status filters, and add an explicit "filtered view" affordance (e.g. caption "Reflète les filtres actifs"). Keep `all` filter behaviour identical to today.
- **Acceptance:** Switching status filter updates the four cards; with filter = `all` the numbers match the current totals.

### A3 · I5 — French plural grammar "Illimité" 🟢 (Low)

- **Where:** `pricing/page.tsx` tier limits block.
- **Root cause (confirmed):** Hardcoded `"Illimité"` with `praticien{s}` / `patients`.
- **Fix:** Use `"Praticiens illimités"` / `"Patients illimités"` (or `"Illimités"`) for the unlimited (`-1`) case. Keep the singular/plural logic for finite counts.
- **Acceptance:** Premium/SaaS cards read grammatically correct French.

### A4 · I10 — Inconsistent action buttons across subscription rows 🟢 (Medium)

- **Where:** `subscriptions/page.tsx` table row actions.
- **Root cause (confirmed):** The invoices (Receipt) button is gated by `sub.invoices.length > 0` and the reminder button by status, so only clinics with payments show extra actions.
- **Fix:** Render a consistent action set per row. Either always show the actions and disable (with tooltip) when not applicable, or move secondary actions into a single dropdown so every row looks uniform.
- **Acceptance:** Every row exposes the same action affordances; disabled states are explained via `title`/tooltip.

### A5 · XI2 — Currency formatting standardisation 🟢 (Low, cross-cutting)

- **Where:** All three pages use `amount.toLocaleString() + " MAD"`; invoice rows use `formatCurrency()` (Intl, 2 decimals) from `src/lib/utils.ts`.
- **Root cause (confirmed):** Two formatting paths produce `300 MAD` vs `300,00 MAD`.
- **Fix:** Route all monetary display through `formatCurrency()` (or a thin `formatMAD()` wrapper) so KPI cards, table cells, and dialogs are consistent. Do not touch CSV export numeric values (machine-readable).
- **Acceptance:** Every on-screen amount uses one formatter; CSV exports still emit raw numbers.

### A6 · B2 — Raw UUID shown as invoice ID 🟢 / 🟡 (Medium)

- **Where:** `billing/page.tsx` (`record.id`), data from `fetchBillingRecords` in `super-admin-actions.ts`.
- **Root cause (confirmed):** The payments table UUID is displayed verbatim.
- **Fix (autonomous part):** Add a display-only helper that renders a human-friendly invoice number derived deterministically from the invoice date + a short UUID suffix (e.g. `INV-2026-06-…A1B2`), keeping the full UUID available on hover/detail.
- **Decision needed (the 🟡 part):** If the team wants true sequential numbers (`INV-2026-0001`) that requires a DB-backed sequence/column — see C3.
- **Acceptance:** Table shows a readable identifier; the underlying UUID is still discoverable (tooltip or detail modal).

---

## Track B — Decision-first (one call needed, then mechanical)

### B1 · I6 / I7 — Vitrine tier "— patients" and missing price 🟡 (Low)

- **Where:** `pricing/page.tsx`; tier data from `fetchPricingTiers` / `pricing_tiers` table.
- **Root cause (confirmed):** `maxPatients === 0 ? "—"` and `price > 0 ? … : "Mensuel uniquement"`.
- **Decision:** What does Vitrine actually offer? (real price? "Gratuit"? "Sur devis"? patient limit = 0/N-A/unlimited?)
- **Then:** Replace the `—` with the agreed label and show the agreed price string. Mechanical once decided.

### B2 · I3 / S6 — SaaS Monthly vs Premium value confusion 🟡 (Medium)

- **Where:** `pricing/page.tsx` tier cards.
- **Decision:** Confirm intended differentiation (SaaS 1,499/50GB vs Premium 1,999/100GB).
- **Then:** Add a short differentiator line / comparison tooltip per tier. UI-only.

### B3 · I2 / I13 / S16 — Pagination for invoices & subscriptions 🟡

- **Where:** `billing/page.tsx`, `subscriptions/page.tsx` tables.
- **Decision:** Page size + client-side vs server-side pagination (tied to data volume strategy in C2).
- **Then:** Add pagination controls. Client-side is autonomous; server-side depends on C2.

### B4 · B1 / S3 / R1 — PDF export UX 🟡 (Critical per report)

- **Where:** `export-utils.ts#exportToPDF` (opens a print window and calls `window.print()`).
- **Root cause (confirmed):** It is **print-dialog based**, not a generated file. In headless/browser-automation (how the QA ran) `window.print()` blocks → the reported ">60s timeout". In a real browser it opens the OS print dialog.
- **Decision:** Keep print-to-PDF (then this is a UX/labeling fix: rename button to "Imprimer / PDF", add a loading toast, handle popup-blocked) **or** switch to a true server-generated PDF (larger effort, new dependency).
- **Then:** If keeping print: add popup-blocked detection + progress toast (autonomous). If true PDF: see C-level effort.

---

## Track C — Needs human / backend / live reproduction

### C1 · I9 — 29/30 subscriptions show 0 MAD 🔴 (High)

- **Where:** `fetchClientSubscriptions` in `super-admin-actions.ts`.
- **Root cause (confirmed):** `amount = latestPayment?.amount ?? 0` — the subscription amount is read from the latest _payment_, not the clinic's _tier price_. Clinics without a payment row show 0.
- **Why human:** Correct behaviour depends on whether 0-MAD rows are seed/test data or a billing-config gap, and on whether amount should fall back to `pricing_tiers` price by `tier`/`billingCycle`. Touches data semantics, not just display.
- **Proposal for sub-agent:** Implement a tier-price fallback (look up `pricing_tiers` by slug + cycle when no payment exists) once the product owner confirms that's the desired semantics.

### C2 · I12 — All subscriptions share the current-month period 🔴 (Low sev, structural)

- **Where:** `fetchClientSubscriptions` hardcodes `currentPeriodStart/End` to `now` month boundaries.
- **Why human:** Real periods require a subscriptions table / lifecycle (start, renewal, end) that does not yet exist in the queried data. Schema + seed work.

### C3 · S1 — Sequential human-readable invoice numbers 🔴 (Medium)

- **Why human:** A durable `INV-2026-0001` scheme needs a DB column/sequence + migration (`supabase/migrations/`) and backfill. A6 covers the display-only stopgap.

### C4 · B3 — Sidebar "Subscriptions" link doesn't navigate from Pricing 🔴 (Critical per report, NOT reproduced in code)

- **Where:** `super-admin-layout-shell.tsx` uses a standard Next.js `<Link href="/super-admin/subscriptions">`; the pricing tabs are local `useState`. No interception found in source.
- **Why human:** Cannot be reproduced from static code. Needs a live repro (record steps/HAR) — likely a client-side navigation/hydration or event-bubbling timing issue, or a QA-automation artifact.
- **Sub-agent action:** Investigate with an E2E test (`e2e/`) that navigates pricing → clicks the sidebar Subscriptions link → asserts URL. Fix only if the test reproduces it.

### C5 · B4 — Promotions tab reverts to Feature Toggles 🔴 (NOT reproduced in code)

- **Where:** `pricing/page.tsx` tab is `useState<TabView>`; no effect resets it.
- **Why human:** Same as C4 — needs live reproduction. Add a Playwright assertion on tab persistence before changing logic.

### C6 · B5 / R6 — Subscriptions page slow skeleton (5–8s) 🔴 → optimisable

- **Where:** `fetchClientSubscriptions` (a `"use server"` action) pulls **all** clinics + **all** payments on client mount, then maps in JS.
- **Why human-ish:** Confirmed inefficiency, but the fix (server-side pagination, column-narrowing, indexing, or caching) interacts with C2/B3 data strategy. A sub-agent can do safe wins autonomously: narrow selected columns, add `.limit()`, parallelise already done; bigger gains need a data-volume decision.

### C7 · XB1 / XS1 — Mixed French/English UI 🔴 (Medium, large)

- **Where:** Admin surfaces deliberately use literal strings (see the `eslint-disable i18next/no-literal-string` headers).
- **Why human:** This is an intentional, documented backlog item. Full i18n of the super-admin surface is a large, coordinated effort, not a point fix.

### C8 · B7 — Filter button highlight stays on "Actif" 🟡/🔴 (NOT reproduced in code)

- **Where:** `subscriptions/page.tsx` status filter buttons set `variant` from `statusFilter === s`. Logic is correct in source.
- **Why caution:** Likely a screenshot/timing artifact. Add an E2E assertion (click "Suspendu" → assert its button has the active variant) before changing anything.

---

## Cross-cutting improvement suggestions (backlog, not bugs)

S2 (date-range filter), S5/S7 (revenue charts — `recharts` already a dependency),
S8 (consistent "recommended" badge), S9 (duplicate tier), S10 (annual monthly-equivalent),
S11/S14 (bulk actions), S13 (suspension reason), S15 (last-payment column),
S17 (column sorting), S18 (tag test accounts), S19 (subscription detail page),
XS3 (clickable breadcrumbs — `Breadcrumb` component already present),
XS4 (consolidated revenue dashboard).
Each is an additive feature; most are 🟢/🟡 once prioritised.

---

## Suggested execution order

1. **Track A** as a single PR (A1–A5 + A6 display stopgap). Low risk, high signal, self-verifiable.
2. **Track B** decisions (15-min product review), then implement B1–B4.
3. **Track C** reproduction work: write the E2E tests for C4/C5/C8 first (cheap, settles whether real), then schedule the data/schema items C1–C3, C6, C7.
