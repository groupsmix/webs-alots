# Cross-Border Data Flow Map

**C-05: Documents categories of data sent to each provider with the legal basis for each transfer.**

## Data Flows to Third-Party Providers

| Provider | Data Categories | Transfer Destination | Legal Basis | Encryption in Transit |
|---|---|---|---|---|
| **Supabase** (PostgreSQL) | All PHI, user accounts, appointments | AWS eu-west-1 (Ireland) | Contractual necessity, DPA signed | TLS 1.3, RLS enforced |
| **Cloudflare R2** | PHI documents, images, lab reports | Cloudflare global edge | Contractual necessity, DPA signed | TLS 1.3 + AES-256-GCM at rest |
| **Cloudflare Workers** | Request processing (transient) | Cloudflare global edge | Contractual necessity | TLS 1.3 |
| **Stripe** | Payment amounts, customer email | US (Stripe Inc.) | Contractual necessity, SCCs | TLS 1.3, PCI DSS Level 1 |
| **CMI** (Centre Monetique Interbancaire) | Payment amounts, order IDs | Morocco | Contractual necessity | TLS 1.2+, HMAC-SHA256 |
| **Meta WhatsApp** (Cloud API) | Patient phone numbers, message templates | US (Meta Platforms) | Explicit consent | End-to-end encryption (WhatsApp) |
| **Twilio** (SMS fallback) | Phone numbers, OTP codes | US (Twilio Inc.) | Explicit consent | TLS 1.2+ |
| **Resend** (Email) | Email addresses, notification content | US (Resend Inc.) | Contractual necessity | TLS 1.3 |
| **OpenAI** | De-identified clinical context (AI features) | US (OpenAI) | Explicit consent, data minimized | TLS 1.3 |
| **Sentry** | Error traces, breadcrumbs (PHI stripped) | US (Sentry.io) | Legitimate interest | TLS 1.3, beforeSend PHI filter |
| **Plausible Analytics** | Anonymized page views (no PII) | EU (Plausible.io) | Legitimate interest | TLS 1.3, no cookies |

## CNDP Registration

**C-04**: Platform registration with the Commission Nationale de controle de la protection des Donnees a caractere Personnel (CNDP) is required before production launch.

- Registration status: **PENDING**
- Filing reference: _To be completed_
- Receipt stored at: `docs/compliance/cndp.md` (once filed)

## Safeguards for US Transfers

For providers based in the US (Stripe, Meta, Twilio, Resend, OpenAI, Sentry):
- Standard Contractual Clauses (SCCs) in DPA
- Data minimization (only necessary fields transferred)
- PHI stripping for observability tools (Sentry)
- Encryption in transit and at rest
- Patient consent captured for WhatsApp/AI features
