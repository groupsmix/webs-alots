# Business Associate Agreement (BAA) Register

> **Reference:** A64-F3, HIPAA §164.308(b)(1), Moroccan Law 09-08 Art.3(2)  
> **Owner:** DPO + Legal | **Review:** Annual + when adding sub-processors  
> **Classification:** INTERNAL CONFIDENTIAL

---

## Overview

A Business Associate Agreement (BAA) is required under HIPAA whenever a covered entity (clinic) shares Protected Health Information (PHI) with a vendor ("business associate") that processes that data on its behalf. While Moroccan Law 09-08 does not use the term "BAA", Art.3(2) requires equivalent data processing agreements with sub-processors who access personal data.

**Oltigo Health's position:**
- Oltigo Health acts as a **Business Associate** to its clinic customers (covered entities)
- Oltigo Health acts as a **Covered Entity/Controller** in relation to its sub-processors
- All sub-processors listed below must have signed BAAs or equivalent DPAs

---

## BAA / DPA Status by Vendor

| Vendor | Purpose | PHI Involved? | BAA/DPA Status | Signed Date | Expiry | Notes |
|---|---|---|---|---|---|---|
| **Cloudflare** | Edge Workers, R2 PHI storage, KV, WAF | ✅ YES — R2 stores encrypted PHI files | ✅ Cloudflare DPA executed | — | Perpetual | Cloudflare BAA available for Enterprise. R2 stores encrypted PHI (AES-256-GCM). |
| **Supabase** | Primary database (PHI records) | ✅ YES — all patient data | ✅ Supabase DPA executed | — | Perpetual | Supabase HIPAA compliance: https://supabase.com/docs/guides/security/hipaa |
| **OpenAI** | AI drug-check, prescription, patient summary | ⚠️ YES — de-identified clinical text | ⚠️ OpenAI DPA signed | — | Annual | **CRITICAL:** OpenAI BAA required if PHI transmitted. Review prompt contents. Patient names must NOT be sent. See `src/app/api/v1/ai/prescription/route.ts` for sanitization. |
| **Meta (WhatsApp)** | Appointment reminders, WhatsApp bot | ⚠️ YES — phone number + appointment details | ✅ Meta DPA | — | Perpetual | Meta's BAA covers WhatsApp Business API. Avoid sending diagnosis in messages. |
| **Resend** | Email notifications | ⚠️ MINIMAL — name + appointment date in subject | ✅ Resend DPA | — | Annual | Review email templates to minimize PHI in subject lines. |
| **Stripe** | International payments | ⚠️ YES — patient name, email linked to payment | ✅ Stripe BAA available | — | Perpetual | Stripe is PCI-DSS Level 1. BAA covers payment processing. |
| **CMI** | Moroccan payment gateway | ⚠️ YES — payment data | ✅ CMI Agreement | — | Per contract | Moroccan entity; governed by Law 09-08 + CMI merchant agreement. |
| **Sentry** | Error monitoring | ⚠️ RISK — breadcrumbs may capture PHI | ⚠️ REVIEW REQUIRED | — | — | Sentry has HIPAA BAA for Business plan+. **Must verify breadcrumb scrubbing removes PHI.** See `sentry.server.config.ts`. |
| **Twilio** (if used) | SMS fallback | ⚠️ YES — phone + message | ❌ NOT SIGNED if active | — | — | If Twilio SMS is active, BAA required before go-live. |

---

## Risk Assessment

### 🔴 Critical — Action Required Before Go-Live

1. **OpenAI BAA**: If any PHI (even de-identified text that could re-identify) is sent to OpenAI, a BAA is **mandatory** under HIPAA and advisable under Law 09-08. Current mitigation: patient names are sanitized before prompts. Confirm OpenAI's Enterprise BAA is in place.

2. **Sentry PHI Scrubbing**: Verify that error events captured by Sentry cannot contain patient names, phone numbers, or medical data. Review `sentry.server.config.ts` `beforeSend` hook.

### 🟡 Medium — Review Within 30 Days

3. **Twilio SMS**: If active, execute BAA before any SMS with PHI is sent.

4. **Resend templates**: Audit all email templates to ensure PHI in subject/body is minimized.

---

## BAA Execution Checklist (for new vendors)

Before adding any new sub-processor that may receive PHI:

- [ ] Identify if PHI will be transmitted/stored
- [ ] Request vendor's BAA template or their standard DPA
- [ ] Legal review of BAA scope (does it cover all processing activities?)
- [ ] Execute BAA and store signed copy in legal document vault
- [ ] Add vendor to this register with signed date
- [ ] Update `docs/personal-data-inventory.md` with new processor
- [ ] Update privacy policy sub-processor list
- [ ] Notify DPO of new processor

---

## Signed Agreement Storage

All signed BAA/DPA documents are stored in:
- **Primary:** Legal document vault (1Password → Secure Notes → "Vendor BAAs")
- **Backup:** Encrypted email attachment in legal@oltigo.com (GPG encrypted)

---

## Annual Review Checklist

- [ ] Verify all BAAs are current (not expired)
- [ ] Confirm vendor HIPAA/security certifications are current (SOC 2, ISO 27001)
- [ ] Review sub-processor list against actual API calls in code
- [ ] Check if any new vendors have been onboarded without BAA
- [ ] Verify OpenAI prompt contents don't include unanticipated PHI

**Last reviewed:** [DATE]  
**Reviewed by:** [NAME, TITLE]  
**Next review due:** [DATE + 1 year]
