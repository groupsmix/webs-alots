# Third-Party Vendor Inventory

> **Audience:** DPO, compliance auditors, security reviewers
> **Last updated:** May 2026
> **Related:** `docs/compliance/data-flow-map.md` (cross-border flows), `docs/compliance/dpa-template.md`, `docs/vendor-exit-playbooks.md`

---

## Active Vendors

### Infrastructure & Platform

| # | Vendor | Service | Data Categories | Data Residency | DPA Status | SOC 2 / ISO | Contract Type | Exit Playbook |
|---|--------|---------|-----------------|----------------|------------|-------------|---------------|---------------|
| 1 | **Supabase** | PostgreSQL, Auth, Storage, Edge Functions | All PHI, PII, user accounts, appointments, medical records | AWS eu-west-1 (Ireland) | Required | SOC 2 Type II | SaaS subscription | `docs/vendor-exit-playbooks.md` |
| 2 | **Cloudflare** | Workers (compute), R2 (storage), KV (rate limits), DNS, CDN, WAF | Request processing (transient), PHI documents (R2), rate limit counters (KV) | Global edge (R2: auto, configurable) | Required | SOC 2 Type II, ISO 27001 | SaaS subscription | `docs/vendor-exit-playbooks.md` |
| 3 | **GitHub** | Source code hosting, CI/CD (Actions), secret management | Source code, CI secrets, deployment tokens | US (GitHub Inc.) | Required | SOC 2 Type II | SaaS subscription | Standard git migration |

### Payment Processing

| # | Vendor | Service | Data Categories | Data Residency | DPA Status | PCI Compliance | Contract Type |
|---|--------|---------|-----------------|----------------|------------|----------------|---------------|
| 4 | **Stripe** | International payment processing | Payment amounts, customer email, payment method tokens | US (Stripe Inc.) | Required | PCI DSS Level 1 | Payment processor agreement |
| 5 | **CMI** (Centre Monetique Interbancaire) | Moroccan payment processing | Payment amounts, order IDs | Morocco | N/A (local) | PCI DSS compliant | Merchant agreement |

### Communication

| # | Vendor | Service | Data Categories | Data Residency | DPA Status | Contract Type |
|---|--------|---------|-----------------|----------------|------------|---------------|
| 6 | **Meta** (WhatsApp Cloud API) | Patient appointment notifications, reminders | Patient phone numbers, message templates (Darija) | US (Meta Platforms) | Required | Business API agreement |
| 7 | **Twilio** | SMS fallback for OTP, notifications | Phone numbers, OTP codes | US (Twilio Inc.) | Required | Communications agreement |
| 8 | **Resend** | Transactional email | Email addresses, notification content | US (Resend Inc.) | Required | SaaS subscription |

### Observability & Analytics

| # | Vendor | Service | Data Categories | Data Residency | DPA Status | Contract Type |
|---|--------|---------|-----------------|----------------|------------|---------------|
| 9 | **Sentry** | Error monitoring, performance | Error traces, breadcrumbs (PHI stripped via `beforeSend`) | US (Sentry.io) | Required | SaaS subscription |
| 10 | **Plausible** | Privacy-first analytics | Anonymized page views (no PII, no cookies) | EU (Plausible.io) | Not required (no PII) | SaaS subscription |

### AI (Optional Features)

| # | Vendor | Service | Data Categories | Data Residency | DPA Status | Contract Type |
|---|--------|---------|-----------------|----------------|------------|---------------|
| 11 | **OpenAI** | AI chat assistant, auto-suggest | De-identified clinical context (patient consent required) | US (OpenAI) | Required | API agreement |
| 12 | **Cloudflare AI** | Workers AI (fallback to OpenAI) | Same as OpenAI | Cloudflare global | Covered by Cloudflare DPA | Included in Cloudflare plan |

---

## DPA Tracker

All SaaS vendors below provide standard Data Processing Addendums (DPAs) that are
accepted by agreeing to their Terms of Service or via their online DPA portals.
The acceptance links below should be visited by the Oltigo Health account holder
to formally execute each DPA. Most include Standard Contractual Clauses (SCCs)
by default for EU/international data transfers.

| Vendor | DPA Required | DPA Status | SCCs Included | Acceptance Method | Review Date |
|--------|-------------|------------|---------------|-------------------|-------------|
| Supabase | Yes | **Accept online** | Yes (US sub-processors) | [Supabase DPA](https://supabase.com/legal/dpa) — click-through on dashboard or email legal@supabase.io | — |
| Cloudflare | Yes | **Accept online** | Yes (global edge) | [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) — auto-accepted with TOS | — |
| GitHub | Yes | **Accept online** | Yes (US) | [GitHub DPA](https://docs.github.com/en/site-policy/privacy-policies/github-data-protection-agreement) — accepted via org settings | — |
| Stripe | Yes | **Accept online** | Yes (US) | [Stripe DPA](https://stripe.com/legal/dpa) — auto-included in Stripe agreement | — |
| Meta (WhatsApp) | Yes | **Accept online** | Yes (US) | [Meta Data Processing Terms](https://www.facebook.com/legal/terms/dataprocessing) — accepted during WABA setup | — |
| Twilio | Yes | **Accept online** | Yes (US) | [Twilio DPA](https://www.twilio.com/legal/data-protection-addendum) — click-through or email privacy@twilio.com | — |
| Resend | Yes | **Accept online** | Yes (US) | [Resend DPA](https://resend.com/legal/dpa) — email support@resend.com to countersign | — |
| Sentry | Yes | **Accept online** | Yes (US) | [Sentry DPA](https://sentry.io/legal/dpa/) — click-through in org settings | — |
| OpenAI | Yes | **Accept online** | Yes (US) | [OpenAI DPA](https://openai.com/policies/data-processing-addendum) — accepted via API TOS; request countersigned copy via privacy@openai.com | — |
| Plausible | No (no PII) | N/A | N/A | — | — |
| CMI | No (local) | N/A | N/A | — | — |

> **Action required:** The account holder must visit each acceptance link above and formally accept/countersign the DPA from the Oltigo Health account. For US-based vendors, verify that Standard Contractual Clauses (SCCs) are included per EU Commission Decision 2021/914 (adopted by Morocco under CNDP guidance). After accepting each DPA, update this table: change status to "Signed YYYY-MM-DD" and fill in the Review Date (annual).

---

## Data Minimization Controls

| Vendor | PHI Exposed | Minimization Measure |
|--------|-------------|---------------------|
| Sentry | No | `beforeSend` filter strips PHI fields before transmission |
| Plausible | No | Cookie-less, no PII collected by design |
| OpenAI | Minimal | De-identified context only; explicit patient consent required |
| Stripe | No PHI | Only payment amounts and customer email (no medical data) |
| WhatsApp/Twilio | Phone only | Only phone numbers and pre-approved template messages |

---

## Vendor Risk Assessment Schedule

| Review | Frequency | Next Due | Owner |
|--------|-----------|----------|-------|
| Vendor security posture review | Annual | Before launch | CTO |
| DPA compliance verification | Annual | Before launch | DPO |
| Sub-processor change monitoring | Continuous | — | CTO |
| SOC 2 report collection | Annual | — | CTO |

---

## Vendor Contact Registry

| Vendor | Security Contact | DPA Contact | Account ID |
|--------|-----------------|-------------|------------|
| Supabase | security@supabase.io | legal@supabase.io | [project ref] |
| Cloudflare | security@cloudflare.com | privacyquestions@cloudflare.com | [account ID] |
| Stripe | security@stripe.com | privacy@stripe.com | [merchant ID] |
| Meta | — | WhatsApp Business API support | [WABA ID] |
| Sentry | security@sentry.io | legal@sentry.io | [org slug] |

> Fill in account identifiers before production launch.
