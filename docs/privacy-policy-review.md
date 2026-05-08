# Privacy Policy Review Checklist

> **Reference:** A70-F1, Moroccan Law 09-08 Art.6, GDPR Art.13/14  
> **Owner:** DPO | **Frequency:** Before each feature launch + annual  
> **Last Reviewed:** [DATE] | **Reviewed By:** [NAME]

---

## Purpose

This checklist ensures the published privacy policy at `https://oltigo.health/privacy` remains accurate and complete after each material change to data processing activities. Clause-by-clause review is required before go-live.

---

## Section 1: Data Controller Identity (Law 09-08 Art.6(1))

- [ ] Legal name and address of Oltigo Health SARL are current
- [ ] DPO contact (dpo@oltigo.com) is listed
- [ ] CNDP notification reference number is included (once issued)

---

## Section 2: Purpose and Legal Basis (Art.6(2))

- [ ] All processing purposes are described (scheduling, billing, AI decision support, notifications)
- [ ] Legal basis for each purpose is stated:
  - [ ] Contract (Art.6(1)(b)) — appointment booking, payments
  - [ ] Legitimate interest (Art.6(1)(f)) — security audit logs
  - [ ] Legal obligation (Art.6(1)(c)) — mandatory medical record retention
  - [ ] Art.9(2)(h) — health data for medical purposes (explicit basis stated)
- [ ] AI-assisted processing (drug-check, prescription, patient summary) is disclosed

---

## Section 3: Data Categories (Art.6(3))

- [ ] Patient identifiers (name, email, phone, date of birth) are listed
- [ ] Health data categories are listed (appointments, diagnoses, prescriptions, files)
- [ ] Financial data (payments via Stripe, CMI) is listed
- [ ] Audit log data is mentioned
- [ ] AI usage data (anonymized) is mentioned

---

## Section 4: Sub-processors / Recipients (Art.6(4))

Verify the published list matches `docs/baa-register.md`:

- [ ] Cloudflare (infrastructure, R2 storage) ✓
- [ ] Supabase (database) ✓
- [ ] **OpenAI (AI clinical decision support)** — verify this is listed
- [ ] **Meta / WhatsApp (appointment reminders)** — verify listed
- [ ] Resend (email notifications) ✓
- [ ] Stripe (payments) ✓
- [ ] CMI (Moroccan payments) ✓
- [ ] **Sentry (error monitoring)** — verify listed with PHI scrubbing note

> **Action A70-F1:** OpenAI, Sentry, and WhatsApp were added post-initial policy draft and may not appear in the published privacy policy. Review the live page before go-live.

---

## Section 5: International Transfers (Art.6(5) / Law 09-08 Art.43)

- [ ] US sub-processors (OpenAI, Meta, Stripe, Resend) are disclosed
- [ ] EU SCCs or adequacy basis is mentioned for each US transfer
- [ ] CNDP authorization referenced for cross-border transfers (once obtained)

---

## Section 6: Retention Periods (Art.6(6))

- [ ] Patient health records: 10 years (Moroccan Code de la Santé)
- [ ] Financial records: 10 years (Code de Commerce)
- [ ] Audit logs: 7 years (Law 09-08 Art.24)
- [ ] Authentication logs: 3 years
- [ ] Cookie consent records: 5 years
- [ ] Inactive account data: Deletion after [X] months of inactivity (must be defined)

---

## Section 7: Data Subject Rights (Art.7)

- [ ] Right of access (Art.7.1) — with contact method and response SLA (30 days)
- [ ] Right of rectification (Art.7.2) — now available via `/api/patient/profile` PATCH
- [ ] Right of erasure (Art.7.3) — with medical retention caveat
- [ ] Right to portability (Art.7.4) — now available via `/api/patient/export`
- [ ] Right to object to automated decisions (Art.22 / EU AI Act) — AI disclosure
- [ ] CNDP complaint procedure is mentioned (https://www.cndp.ma)

---

## Section 8: AI and Automated Decision-Making

- [ ] AI features are disclosed (drug-check, prescription assist, patient summary, chatbot)
- [ ] Statement that AI outputs are decision-support only (not autonomous decisions)
- [ ] User's right to request human review is stated (Art.22)
- [ ] Contact method for exercising this right is provided

---

## Section 9: Cookies and Analytics

- [ ] Plausible Analytics (cookieless) is mentioned with consent requirement
- [ ] Per-clinic GA/GTM analytics (if enabled) is disclosed
- [ ] Cookie preference management is linked
- [ ] WhatsApp tracking pixels (if any) are disclosed

---

## Section 10: Session Replay (Sentry)

- [ ] If Sentry Session Replay is enabled, this is disclosed
- [ ] PHI masking of form fields in Session Replay is mentioned

---

## Sign-off

| Reviewer | Role | Date | Signature |
|---|---|---|---|
| | DPO | | |
| | Legal Counsel | | |
| | Engineering Lead | | |

**Next scheduled review:** [DATE + 1 year or next major feature launch]
