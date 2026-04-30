# Data Residency & Sub-Processor Documentation

## Overview

Oltigo Health processes Protected Health Information (PHI) for Moroccan clinics,
subject to Moroccan Law 09-08 (Data Protection Act) and CNDP regulations.

This document maps each sub-processor's data residency and transfer mechanisms.

## Sub-Processor Registry

| Sub-Processor | Data Type | Region | Transfer Mechanism | DPA Status | Criticality | Evidence | Sub-Processors | Breach SLA |
|---|---|---|---|---|---|---|---|---|
| **Supabase** (PostgreSQL) | PHI, PII, auth | AWS eu-west-1 (Ireland) | EU SCCs | Signed | Tier 1 | SOC 2 Type II (exp. 2027-03) | AWS (hosting), Fly.io (edge) | 72 hours |
| **Cloudflare Workers** | Request routing, caching | Global edge (nearest PoP) | Cloudflare DPA | Signed | Tier 1 | SOC 2 Type II, ISO 27001 (exp. 2026-12) | N/A (own infra) | 72 hours |
| **Cloudflare R2** | Encrypted patient files | Auto (nearest region) | Cloudflare DPA | Signed | Tier 1 | (same as CF Workers) | N/A (own infra) | 72 hours |
| **Cloudflare KV** | Rate limit counters, feature flags | Global edge | Cloudflare DPA | N/A (no PHI) | Tier 3 | (same as CF Workers) | N/A (own infra) | N/A |
| **Sentry** | Error telemetry (scrubbed) | US (sentry.io) | EU SCCs | Signed | Tier 3 | SOC 2 Type II (exp. 2027-01) | GCP, Clickhouse Cloud | 72 hours |
| **OpenAI** | AI chat (medical Q&A) | US | OpenAI DPA | Signed | Tier 2 | SOC 2 Type II (exp. 2026-09) | Azure (hosting) | 72 hours |
| **Stripe** | Payment data | US/EU | Stripe DPA, PCI DSS | Signed | Tier 2 | PCI DSS L1, SOC 2 Type II (exp. 2027-06) | AWS (hosting) | 72 hours |
| **CMI** | Payment data (MAD) | Morocco | Local processor | N/A (domestic) | Tier 2 | PCI DSS L1 (verify expiry) | TBD -- request from CMI | Per contract |
| **Meta (WhatsApp)** | Phone numbers, appointment reminders | US/EU | Meta DPA | Signed | Tier 2 | SOC 2 Type II, ISO 27001 | Multiple (see Meta DPA) | 72 hours |
| **Twilio** (fallback) | Phone numbers, SMS | US | Twilio DPA | Signed | Tier 3 | SOC 2 Type II, ISO 27001 (exp. 2026-11) | AWS (hosting) | 72 hours |
| **Resend** | Email addresses, notification text | US | Resend DPA | Signed | Tier 3 | SOC 2 Type II (verify) | AWS SES (delivery) | 72 hours |

### Criticality Tiers

| Tier | Definition | Review Cadence |
|------|-----------|----------------|
| **Tier 1** | Platform cannot operate without this vendor; data loss risk | Quarterly |
| **Tier 2** | Major feature depends on this vendor; degraded experience without | Semi-annual |
| **Tier 3** | Convenience / non-critical; easy to replace or degrade gracefully | Annual |
| **Tier 4** | Development-only tooling; no production data exposure | Annual |

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
