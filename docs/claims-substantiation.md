# Marketing Claims Substantiation Register (A199)

**Last reviewed:** 2026-05-28
**Owner:** Marketing / DPO
**Regulatory context:** FTC Act §5, EU UCPD (2005/29/EC), Moroccan Consumer Protection Law 31-08

---

## Purpose

This register documents the evidentiary basis for marketing claims made about
Oltigo Health. For a health-adjacent AI product, unsubstantiated claims carry
regulatory risk under FTC health-marketing enforcement, EU UCPD unfair
commercial practices, and Moroccan Law 31-08.

## Active Claims

| Claim                                | Where Used                   | Basis                                                                             | Evidence Type                                          |
| ------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| "AI-assisted appointment management" | Marketing site, app UI       | AI generates suggestions reviewed by clinicians; no autonomous clinical decisions | Technical architecture docs; AI disclaimer (S5 A109-1) |
| "Secure patient data"                | Marketing site, privacy page | AES-256-GCM encryption, RLS, audit logging, HMAC verification                     | Security audit reports (S0–S7); SOC2 controls matrix   |
| "RGPD / Loi 09-08 compliant"         | Privacy page, marketing      | DPIA completed, consent logging, right-to-delete, data-subject access             | `docs/compliance/dpia.md`, `docs/compliance/cndp.md`   |
| "Multi-tenant isolation"             | Technical docs               | Application-level clinic_id scoping + database RLS                                | Code audit (AGENTS.md); RLS integration tests          |

## Prohibited Claims

The following claims MUST NOT be made without clinical trial evidence:

- ❌ "AI-powered diagnosis" — the AI provides suggestions, not diagnoses
- ❌ "Reduces misdiagnosis" — no clinical outcome data to support
- ❌ "Improves patient outcomes" — no RCT or observational study
- ❌ "FDA/CE approved" — no regulatory approval sought or obtained
- ❌ Any comparative efficacy claim vs. competitors without head-to-head data

## AI-Specific Disclosures

Per Season 5 audit (A109-1), all AI responses include:

1. `aiGenerated: true` flag in response payload
2. French-language disclaimer: AI-generated content requiring professional review
3. `X-AI-Generated: true` HTTP header on streaming responses

These disclosures align with the EU AI Act transparency requirements for
AI systems in healthcare settings.

## Review Cadence

- Review all marketing materials quarterly (next: 2026-08-28)
- Review before any product launch or feature announcement
- Legal review required for any claim involving:
  - Clinical efficacy
  - Regulatory compliance
  - Comparative statements
  - Patient outcomes
