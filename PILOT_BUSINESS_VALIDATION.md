# Oltigo Health — Morocco Pilot Business Validation

This document is the **3–5 clinic business validation checklist** for the Morocco closed pilot. It is intentionally non-code and focused on whether the Lane A product (scheduling, reminders, billing, website, WhatsApp) is commercially viable before reopening the roadmap.

## Pilot Cohort

Run this checklist with **3 to 5 clinics** in one of these profiles:

1. General-practice / single-doctor clinic
2. Dental clinic or para-pharmacy
3. Specialist office (dermatology, ophthalmology, gynecology)

Each clinic must have a decision-maker and a daily receptionist/operator who uses WhatsApp.

---

## Week 1 — Onboarding Validation

- [ ] Clinic completes tenant setup without engineering support.
- [ ] Staff training (30 min) is completed with the receptionist and doctor.
- [ ] First 5 test bookings are created successfully.
- [ ] Clinic can locate and use the mobile admin dashboard.

## Week 2 — Adoption Validation

- [ ] At least 10 real patient bookings are created.
- [ ] WhatsApp confirmation and reminder open rate is > 40%.
- [ ] No-show rate is tracked (baseline vs. WhatsApp reminder cohort).
- [ ] Staff uses the booking page at least once per day.

## Week 3 — Revenue Validation

- [ ] At least 3 successful CMI or Stripe payments are processed.
- [ ] No duplicate payments or unprocessed callbacks.
- [ ] Invoices are generated and the clinic can reconcile end-of-day totals.
- [ ] At least one patient uses the public booking link.

## Week 4 — Operations & Feedback Validation

- [ ] Staff uses the admin dashboard on mobile daily.
- [ ] Patient feedback is collected via WhatsApp NPS (response rate > 20%).
- [ ] At least one insurance co-pay invoice is tracked (`partially_paid` → `paid`).
- [ ] No cross-tenant data leak or RLS bypass is detected.

## Week 5 — Decision Gate

- [ ] Clinic confirms willingness to pay a monthly fee (pilot or full price).
- [ ] No critical PHI handling requirement surfaced; Lane A remains sufficient.
- [ ] Clinic provides a written testimonial or a referral to another clinic.
- [ ] Pilot feedback is documented in `PILOT_CHECKLIST.md` under the Post-Pilot section.

---

## Success Criteria

A pilot is **successful** if:

1. **3 or more of the 5 clinics** complete onboarding in under 2 hours.
2. **WhatsApp reminder open rate is > 40%**.
3. **No-show rate drops by more than 10%** compared to the pre-pilot baseline.
4. **3 or more clinics** process a real payment and reconcile the invoice.
5. **No security or compliance incident** occurs during the pilot.

If fewer than 3 clinics pass, freeze the feature roadmap and run a follow-up discovery sprint before reopening the backlog.

---

## Go / No-Go Decision

| Decision           | Condition                                           | Next Step                                                              |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- |
| **GO**             | 3+ successful pilots + revenue intent               | Convert to paid, standardize onboarding, prepare commercial rollout    |
| **NO-GO**          | < 3 successful pilots or compliance/PHI requirement | Pause roadmap, run additional discovery, harden Lane A before re-pilot |
| **CONDITIONAL GO** | Strong adoption but payments not validated          | Keep pilots free, add billing/insurance tracking, extend by 2 weeks    |

---

## Post-Pilot

1. Schedule a 1-hour retro with each clinic.
2. Export `audit_logs` and `notification_queue` logs for the pilot period.
3. Review Sentry alerts for `payment_failure`, `whatsapp_failure`, and `payment_tampering`.
4. Decide whether to re-enable any Lane B clinical modules based on a signed DPA and CNDP/Loi 09-08 compliance.
5. Update `PILOT_CHECKLIST.md` and `PILOT_BUSINESS_VALIDATION.md` with findings before the next batch.
