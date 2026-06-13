# Oltigo Health: MVP Scope

This document defines the active product scope for Oltigo Health. Features outside of this scope are considered experimental and should be hidden behind feature flags to maintain repository hygiene and focus.

## Active Scope: Moroccan Clinic SaaS

Oltigo is a multi-tenant SaaS platform built specifically for healthcare clinics in Morocco.

### Core Features

- **Public Clinic Website**: SEO-friendly landing pages for each tenant clinic.
- **Online Booking**: Patients can schedule appointments directly via the web.
- **Patient Records (PHI)**: Encrypted medical records, compliant with Moroccan Law 09-08.
- **Receptionist Dashboard**: Tools for managing daily schedules, walk-ins, and patient flow.
- **Doctor Dashboard**: Clinical view for managing patient encounters, notes, and history.
- **WhatsApp Reminders**: Automated appointment confirmations and reminders in Darija/French (via Meta Cloud API / Twilio).
- **File Uploads**: Secure handling of test results and clinical documents (AV scanned, R2 stored).
- **Admin Branding**: Clinics can customize their public presence.
- **Super-Admin Tenant Management**: System operators can manage billing, tier limits, and tenant lifecycles.
- **CMI Payments**: Integration for Moroccan interbank payment processing.

## Experimental / Non-MVP Scope

The following verticals and features exist in the codebase but are **NOT** part of the active MVP. They are gated by per-clinic configuration.

- **Restaurant / Hospitality Vertical**: Gated by `menu_management`, `table_management`, `qr_ordering`, `reservations` features in clinic type's `features_config`
- **Veterinary / Pet Profiles**: Gated by `pet_profiles` feature in clinic type's `features_config`
- **Advanced AI (CDSS, AI Team Dashboard, Copilots)**: Gated by per-clinic `ai_*` features in `features_config` AND global kill switch via `isAIEnabled()` (KV flag `ai.enabled` or `AI_DISABLED` env var)
- **Specialist Verticals**: Optician, physiotherapy, radiology, speech therapy, equipment rental, parapharmacy, and other specialist features are gated by respective feature flags in clinic type's `features_config`

### Feature Gating Mechanism

Features are controlled at two levels:

1. **Per-clinic configuration**: Each clinic type has a `features_config` JSONB column in the `clinic_types` table that determines which features are available for clinics of that type. See `src/lib/features.ts` for the full list of `ClinicFeatureKey` options.

2. **Global AI kill switch**: AI features have an additional global kill switch via `isAIEnabled()` in `src/lib/features.ts`, which checks either:
   - Cloudflare KV namespace `FEATURE_FLAGS_KV` with key `ai.enabled`
   - Environment variable `AI_DISABLED=true` for immediate disable

If a new PR introduces heavy analytics, alternate industry verticals, or advanced AI capabilities, ensure it is wrapped in the appropriate feature flag in `features_config` and does not impact the core booking and patient management flow.
