# Plausible Analytics — Privacy & Compliance

> Addresses audit finding **L7-H2**: Plausible analytics privacy documentation.

## Overview

Oltigo Health uses [Plausible Analytics](https://plausible.io) for aggregate website metrics on the public landing pages (e.g., `oltigo.com`). Plausible was chosen specifically for its **privacy-first** design, which aligns with Moroccan **Law 09-08** (protection of personal data) and **GDPR** requirements.

## Why Plausible?

| Feature | Details |
|---|---|
| No cookies | Plausible does not set any cookies — no cookie banner required |
| No personal data | Does not collect IP addresses, device fingerprints, or cross-site identifiers |
| No tracking across sites | Each domain is isolated; no cross-domain tracking |
| EU-hosted infrastructure | Plausible Cloud servers are in the EU (Germany) |
| Open source | Fully auditable source code ([github.com/plausible/analytics](https://github.com/plausible/analytics)) |
| Lightweight | < 1 kB script — no impact on page performance |

## What Is Tracked

Plausible collects **aggregate, anonymised** metrics only:

- **Page views** — which pages are visited and how often
- **Referral sources** — where visitors come from (Google, social media, direct)
- **Device type** — desktop vs. mobile vs. tablet (from User-Agent, not fingerprinted)
- **Country/region** — coarse geo-location derived from IP at processing time (IP is never stored)
- **Session duration** — approximate time on site

## What Is NOT Tracked

- No patient data, health information, or PHI
- No logged-in user activity (Plausible is only on public pages)
- No form submissions or input contents
- No IP addresses (hashed transiently, never stored)
- No cross-session or cross-device tracking
- No advertising identifiers or retargeting pixels

## Scope

Plausible is loaded **only** on public-facing pages (`(public)` route group). It is **not** loaded in:

- Patient portal (`(patient)/`)
- Doctor dashboard (`(doctor)/`)
- Receptionist panel (`(receptionist)/`)
- Admin panel (`(admin)/`)
- Super-admin panel (`(super-admin)/`)

The script is conditionally rendered via `<PlausibleScript />` in `src/components/plausible-script.tsx` and only activates when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set.

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Yes | Domain to track (e.g., `oltigo.com`) |
| `NEXT_PUBLIC_PLAUSIBLE_HOST` | No | Custom Plausible host (default: `https://plausible.io`). Set this if using a self-hosted instance. |

### Self-Hosted Option

For maximum data sovereignty, Plausible can be self-hosted on your own infrastructure. Set `NEXT_PUBLIC_PLAUSIBLE_HOST` to your instance URL. This ensures analytics data never leaves your network.

## Moroccan Law 09-08 Compliance

Plausible's design is inherently compliant with Law 09-08:

1. **No personal data processing** — Plausible does not collect data that identifies or can identify a natural person (Article 1 of Law 09-08)
2. **No consent required** — Since no cookies are set and no personal data is processed, explicit consent is not required under Moroccan law
3. **No cross-border data transfer concerns** — When self-hosted, all data stays within your infrastructure. Plausible Cloud stores data in the EU with GDPR-grade protections
4. **Data minimisation** — Only aggregate counters are stored, aligning with the proportionality principle

## GDPR Compliance

Plausible is explicitly designed for GDPR compliance without requiring consent:

- No personal data is processed (Recital 26 — anonymous data is outside GDPR scope)
- No cookie consent banner needed (ePrivacy Directive does not apply since no cookies are used)
- Plausible has a signed DPA (Data Processing Agreement) available for Cloud customers

## Per-Clinic Analytics (Separate System)

Individual clinics may optionally configure **Google Analytics** or **Google Tag Manager** via the clinic configuration (`src/config/clinic.config.ts`). These are entirely separate from Plausible and are the clinic's responsibility to configure with appropriate consent mechanisms.

The clinic-level analytics component (`src/components/analytics-script.tsx`) is independent of the Plausible integration.

## References

- [Plausible Privacy Policy](https://plausible.io/privacy)
- [Plausible Data Policy](https://plausible.io/data-policy)
- [Plausible GDPR Compliance](https://plausible.io/blog/google-analytics-gdpr)
- [Moroccan Law 09-08](https://www.cndp.ma/fr/loi-09-08.html) (CNDP — Commission Nationale de controle de la protection des Donnees a caractere Personnel)
- Component source: `src/components/plausible-script.tsx`
