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

| Vendor | DPA Required | DPA Signed | SCCs Included | Expiry | Review Date |
|--------|-------------|------------|---------------|--------|-------------|
| Supabase | Yes | Pending | Yes (US sub-processors) | — | — |
| Cloudflare | Yes | Pending | Yes (global edge) | — | — |
| GitHub | Yes | Pending | Yes (US) | — | — |
| Stripe | Yes | Pending | Yes (US) | — | — |
| Meta (WhatsApp) | Yes | Pending | Yes (US) | — | — |
| Twilio | Yes | Pending | Yes (US) | — | — |
| Resend | Yes | Pending | Yes (US) | — | — |
| Sentry | Yes | Pending | Yes (US) | — | — |
| OpenAI | Yes | Pending | Yes (US) | — | — |
| Plausible | No (no PII) | N/A | N/A | — | — |
| CMI | No (local) | N/A | N/A | — | — |

> **Action required:** Sign DPAs with all "Pending" vendors before production launch. Use template in `docs/compliance/dpa-template.md`. For US-based vendors, ensure Standard Contractual Clauses (SCCs) are included per EU Commission Decision 2021/914 (adopted by Morocco under CNDP guidance).

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
