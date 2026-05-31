# Oltigo Health — Sub-Processor List

> **Last updated:** 2026-05-31 | **Version:** 1.0
> 
> This document is published at `/sub-processors` as required by GDPR Art.28(3)(a)
> and Moroccan Law 09-08. Clinic customers (data controllers) may review this list
> to verify sub-processor authorisations. Material changes will be communicated
> at least 30 days in advance.

## Active Sub-Processors

| Sub-Processor | Data Processed | Region | Transfer Basis | Certification | DPA |
|---|---|---|---|---|---|
| **Supabase** (PostgreSQL) | PHI, PII, authentication tokens | AWS eu-west-1 (Ireland) | EU SCCs | SOC 2 Type II, ISO 27001 | Signed |
| **Cloudflare Workers** | Request routing, edge caching | Global edge (transient only — no persistent PHI) | Cloudflare DPA | SOC 2 Type II, ISO 27001 | Signed |
| **Cloudflare R2** | Encrypted patient files (AES-256-GCM) | EU jurisdiction pinned¹ | Cloudflare DPA | SOC 2 Type II | Signed |
| **Cloudflare KV** | Rate-limit counters, feature flags (no PHI) | Global edge | Cloudflare DPA | SOC 2 Type II | N/A |
| **OpenAI** | Pseudonymised clinical context for AI features | US (Azure hosting) | OpenAI DPA + EU SCCs + explicit consent | SOC 2 Type II | Signed |
| **Stripe** | Payment gateway references (no PAN stored) | US / EU | Stripe DPA + PCI DSS L1 | PCI DSS L1, SOC 2 Type II | Signed |
| **CMI** (Centre Monétique Interbancaire) | Payment processing (MAD) | Morocco | Domestic processor | PCI DSS L1 (AOC on request) | N/A (domestic) |
| **Meta** (WhatsApp Business API) | Phone numbers, appointment reminder text | US / EU | Meta DPA + EU SCCs + explicit consent | SOC 2 Type II, ISO 27001 | Signed |
| **Twilio** (WhatsApp / SMS fallback) | Phone numbers, notification text | US | Twilio DPA + EU SCCs | SOC 2 Type II, ISO 27001 | Signed |
| **Resend** | Email addresses, notification content | US | Resend DPA + EU SCCs | SOC 2 Type II | Signed |
| **Sentry** | Error telemetry (PHI fully scrubbed before transmission) | US | Sentry DPA + EU SCCs | SOC 2 Type II | Signed |
| **Plausible Analytics** | Anonymised page-view counts (not personal data) | EU (Germany) | EU DPA | GDPR-compliant (cookieless) | Signed |

¹ Cloudflare R2 PHI buckets are pinned to EU jurisdiction via the `jurisdiction=eu` location hint.
  See `r2-lifecycle.json` and `docs/compliance/data-residency.md` for configuration evidence.

## Certification Expiry Tracking

| Sub-Processor | Certification | Expiry | Alert Threshold |
|---|---|---|---|
| OpenAI | SOC 2 Type II | 2026-09 | 90-day alert set |
| Twilio | SOC 2 Type II / ISO 27001 | 2026-11 | 90-day alert set |
| Cloudflare | SOC 2 Type II / ISO 27001 | 2026-12 | 90-day alert set |
| Supabase | SOC 2 Type II | 2027-03 | 90-day alert set |
| Stripe | PCI DSS L1 / SOC 2 Type II | 2027-06 | 90-day alert set |

Automated checks against vendor trust pages are scheduled in CI (`.github/workflows/cert-expiry-check.yml`).

## Change Notification

Clinic customers with a signed DPA will receive email notification of any sub-processor
additions, replacements, or removals at least **30 days before** the change takes effect.
To object to a proposed change, contact `dpo@oltigo.health` within the notice period.

## Contact

- Data Protection Officer: `dpo@oltigo.health`
- Privacy Policy: `/privacy`
- CNDP Registration: Pending (Autorisation préalable — see `docs/compliance/cndp-registration.md`)
