# Data Residency & Sub-Processor Documentation

## Overview

Oltigo Health processes Protected Health Information (PHI) for Moroccan clinics,
subject to Moroccan Law 09-08 (Data Protection Act) and CNDP regulations.

This document maps each sub-processor's data residency and transfer mechanisms.

## Sub-Processor Registry

| Sub-Processor | Data Type | Region | Transfer Mechanism | DPA Status |
|---|---|---|---|---|
| **Supabase** (PostgreSQL) | PHI, PII, auth | AWS eu-west-1 (Ireland) | EU SCCs | Signed |
| **Cloudflare Workers** | Request routing, caching | Global edge (nearest PoP) | Cloudflare DPA | Signed |
| **Cloudflare R2** | Encrypted patient files | Auto (nearest region) | Cloudflare DPA | Signed |
| **Cloudflare KV** | Rate limit counters, feature flags | Global edge | Cloudflare DPA | N/A (no PHI) |
| **Sentry** | Error telemetry (scrubbed) | US (sentry.io) | EU SCCs | Signed |
| **OpenAI** | AI chat (medical Q&A) | US | OpenAI DPA | Signed |
| **Stripe** | Payment data | US/EU | Stripe DPA, PCI DSS | Signed |
| **CMI** | Payment data (MAD) | Morocco | Local processor | N/A (domestic) |
| **Meta (WhatsApp)** | Phone numbers, appointment reminders | US/EU | Meta DPA | Signed |
| **Twilio** (fallback) | Phone numbers, SMS | US | Twilio DPA | Signed |
| **Resend** | Email addresses, notification text | US | Resend DPA | Signed |

## Cross-Border Transfer Position

### Moroccan Law 09-08 Compliance

Under Law 09-08, personal data may only be transferred outside Morocco to
countries that provide an "adequate level of protection" or with appropriate
safeguards (Article 43-44).

**Current position:**

1. **Primary data store (Supabase/AWS Ireland):** EU provides adequate protection
   recognized by Morocco's CNDP. Standard Contractual Clauses (SCCs) provide
   additional safeguards.

2. **US-based processors (Sentry, OpenAI, Stripe, Meta, Twilio, Resend):**
   All operate under signed DPAs with EU SCCs. PHI is scrubbed from Sentry
   payloads before transmission (see `sentry.server.config.ts`).

3. **AI data:** Patient conversations with the AI assistant are NOT stored
   by OpenAI (data processing agreement prohibits training on customer data).
   No PHI identifiers are sent in AI prompts — only anonymized medical queries.

4. **Domestic processing (CMI):** Moroccan payment processor. No cross-border
   transfer involved.

## PHI Handling by Sub-Processor

### Data Scrubbing

- **Sentry:** All PII/PHI is scrubbed via `beforeSend` and `beforeBreadcrumb`
  hooks in `sentry.server.config.ts`. Fields matching email, phone, address,
  diagnosis, prescription patterns are replaced with `[REDACTED_PII]`.

- **Cloudflare Analytics:** No PHI is sent to analytics. Only aggregate
  performance metrics (p95 latency, error rates) are collected.

### Encryption

- **At rest:** Patient files in R2 are encrypted with AES-256-GCM
  (per-file unique IV). See `src/lib/encryption.ts`.

- **In transit:** All connections use TLS 1.3 (enforced by Cloudflare).

- **Database:** Supabase encrypts data at rest using AES-256.

## Action Items for SOC 2 / Law 09-08 Audit

- [ ] File CNDP declaration for cross-border transfers
- [ ] Obtain formal DPA signatures from all sub-processors listed above
- [ ] Conduct annual review of sub-processor data residency
- [ ] Document data retention periods per table
- [ ] Implement data subject access request (DSAR) API endpoint

## Last Updated

2026-04-27
