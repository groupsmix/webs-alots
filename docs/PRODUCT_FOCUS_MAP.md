# Oltigo — Product Focus Map

> A focusing document, grounded in the actual codebase, to turn the vision into a short to-do list.
> Created with Kiro. Edit freely.

## 1. The product, in one sentence

**"I design a clinic's website + dashboard, hand it over, and charge monthly. The dashboard
saves the clinic time on day-to-day operations, AI helps the clinic solve everyday problems, and
a separate internal AI 'team' helps me run many client sites without more hours."**

This is a **productized-service / managed-SaaS** model. Keep that sentence pinned — anything that
doesn't serve it is a distraction for now.

---

## 2. The ONE decision everything hinges on: clinical vs operations

You said you want to **stay away from patient/clinical data** because it's high risk, low reward.
But the codebase today is a **full clinical platform**, not an operations tool. Verified surfaces
that store/handle Protected Health Information (PHI) in the cloud:

| Surface                   | Route / file                                           | What it stores                               |
| ------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| Radiology images          | `api/radiology/upload` → `lib/r2`                      | medical images in R2                         |
| Prescriptions             | `api/prescriptions`, `api/radiology/report-pdf`        | clinical docs                                |
| Patient documents         | `api/patient/documents` + `patient_files` table + R2   | patient files (PHI-encrypted, EXIF-stripped) |
| Vitals                    | `api/vitals`, `api/vitals/stream`                      | clinical measurements                        |
| Insurance claims          | `api/insurance/*`, `api/clinic-owner/insurance-claims` | claims + patient identifiers                 |
| Patient timeline / export | `api/patient/timeline`, `api/patient/export`           | aggregated PHI                               |

There is real PHI hygiene already in place (field encryption, EXIF stripping, GDPR-purge cron,
data-retention cron, R2 cleanup cron, RLS on every table). So it's _well built_ — but it's the
**opposite** of "stay away from patient data."

**You must pick a lane:**

- **Lane A — Operations-only (matches what you said you want):** the platform handles scheduling,
  reminders, billing, comms, the site, and _operational_ personal data (name + phone + appointment).
  Clinical/medical files are **not stored in your cloud** (don't handle them, or bring-your-own-storage).
  → Lower risk, faster, cheaper compliance, still very valuable to clinics.
- **Lane B — Full clinical platform (what the code currently is):** you keep radiology, prescriptions,
  patient documents, vitals, etc. → Much higher value ceiling, but heavy CNDP / Loi 09-08 exposure,
  breach liability, and ongoing compliance cost. This is a serious healthcare-software commitment.

> Recommendation: **start in Lane A.** Disable/hide the clinical modules for now (don't delete —
> feature-flag them off) and sell the operations + managed-site value. Graduate to Lane B later,
> deliberately, with compliance support — not by accident.
> (Not legal advice — confirm CNDP/Loi 09-08 specifics with a compliance professional.)

---

## 3. Cloud vs local — the boundary (your "keep it on their PC" idea)

Don't rebuild as local-only: it would break remote management, subscriptions, and AI — the core of
your model. A browser web app also **cannot** reliably save to a clinic's disk (sandbox limits).

Instead, **split by sensitivity** (this is the same Lane-A line, applied to storage):

| Data                                                     | Where                            | Why                                                       |
| -------------------------------------------------------- | -------------------------------- | --------------------------------------------------------- |
| Appointments, reminders, billing, the site, subscription | **Cloud** (current stack)        | low-risk operational data; powers SaaS + AI + remote mgmt |
| Clinical files (scans, prescriptions, reports)           | **Clinic-side / not your cloud** | highest risk, no need for you to hold it                  |

Options for the clinical files (pick later): don't store them at all · bring-your-own-storage
(their Drive/bucket) · a premium "on-prem / desktop app" tier for clinics that demand fully local.

---

## 4. Feature inventory — Real vs Mock vs Clinical

Grounded in the code as of this map.

### Real & working (operations) — your foundation

- Auth + roles + (now optional) 2FA
- Booking / appointments (`api/booking/*`)
- WhatsApp / notifications
- Announcements, document Templates (real CRUD)
- AI Builder (internal super-admin tool) — real
- AI Team routes (`api/ai/team/*`) + kanban
- Referral **payouts** (real API: `api/super-admin/referral-credits`)
- Billing invoices display, Usage metrics (real API; geo-gated)
- Feature Flags runtime (KV-backed; `FEATURE_FLAGS_KV` bound in prod since 2026-06)

### Now persisted (formerly mock — resolved 2026-07)

These were previously mock-only (success toasts with no DB writes). They are now fully persisted
with audit logging, resolving the former "#1 revenue-blocking gap" (P1/P2/P4 in `deep_dive_analysis.md`):

- **Subscription status changes** → `updateSubscriptionStatusImpl` writes `clinics.status` + audit log (`src/lib/super-admin/billing-actions.ts`).
- **Pricing tier edits** → `updatePricingTierImpl` writes `pricing_tiers` + structured `priceChanges` audit diff (`src/lib/super-admin/feature-actions.ts`).
- **Promotions** → `createPromotionImpl` / `setPromotionEnabledImpl` / `deletePromotionImpl` write the `promotions` table (`src/lib/super-admin/promotions-actions.ts`).
- **Feature matrix toggles** → `updateFeatureDefinitionImpl` / `bulkSetFeatureTierImpl` write `feature_definitions` (`src/lib/super-admin/feature-actions.ts`).

The former "aperçu — non enregistré" UI labels (PRs #1099/#1100) have been removed from locale files
since these actions now persist.

### Clinical / PHI — the Lane-A vs Lane-B decision (Section 2)

Radiology, prescriptions, patient documents, vitals, insurance claims, patient timeline/export.

---

## 5. The plan (do these in order)

**Phase 0 — Decide (you):** Lane A or Lane B (Section 2). Everything below assumes **Lane A**.

**Phase 1 — Make the money real (highest value):** ✅ Complete

1. ~~Real persistence for **subscriptions** (status changes) → API + DB writes + audit log + tests.~~ **Done** — `updateSubscriptionStatusImpl` in `billing-actions.ts`.
2. ~~Real persistence for **pricing** tiers + promotions.~~ **Done** — `updatePricingTierImpl` + promotions CRUD in `feature-actions.ts` / `promotions-actions.ts`.
3. ~~Bind `FEATURE_FLAGS_KV` in production (or hide the page) so flags/kill-switch work.~~ **Done** — bound in `wrangler.toml` `[env.production.kv_namespaces]` (namespace `223443c0…`, provisioned 2026-06).

> **Remaining work:** verify + add integration tests for the persistence paths above; confirm audit-log coverage meets billing-grade compliance.

**Phase 2 — Lane-A guardrail:** 4. Feature-flag OFF the clinical modules (radiology, prescriptions, patient docs, vitals, insurance)
so they're not exposed/sold yet; ensure no clinical files are written to your R2 in the active product. 5. Confirm the operational data you _do_ keep (name/phone/appointment) has a clear retention + DSAR story
(you already have GDPR-purge + data-retention crons — verify they cover the kept tables).

**Phase 3 — The valuable, low-risk AI (sell this):** 6. "AI-for-them": no-show reduction / smart reminders + a non-diagnostic FAQ assistant (no PHI). 7. "AI-for-you": lean on the AI Builder + AI Team to spin up/maintain client sites at scale.

**Phase 4 — Managed-site delivery:** 8. Tighten the design→handover→dashboard flow (templates, announcements, branding) so onboarding a
new clinic is a repeatable, mostly-automated checklist.

---

## 6. Open decisions (need your answer)

- [ ] **Lane A or Lane B?** (clinical data in or out)
- [ ] If Lane A: OK to feature-flag-off the clinical modules now (kept in code, hidden)?
- [ ] Persistence first target: **subscriptions** or **pricing**?
- [ ] Keep MFA optional (done) or also add a one-click disable/manage control?
- [ ] Clinical files later: don't-store vs bring-your-own-storage vs on-prem tier?

---

### Status of related work (open PRs)

- #1097 ops-console QA · #1099 content QA · #1100 revenue QA (+ honest non-persistent controls)
- #1101 optional 2FA · #1102 graceful 429 page
- RLS verified: every table has Row-Level Security enabled (252 tables / 265 RLS statements).
