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

The following verticals and features exist in the codebase but are **NOT** part of the active MVP. They are gated by environment variables.

- **Restaurant / Hospitality Vertical**: Gated by `EXPERIMENTAL_VERTICALS_ENABLED`
- **Veterinary / Pet Profiles**: Gated by `EXPERIMENTAL_VERTICALS_ENABLED`
- **Advanced AI (CDSS, AI Team Dashboard, Copilots)**: Gated by `AI_FEATURES_ENABLED`
- **FHIR / Complex CRM Integrations**: Gated by `FHIR_ENABLED`

If a new PR introduces heavy analytics, alternate industry verticals, or advanced AI capabilities, ensure it is wrapped in the appropriate feature flag and does not impact the core booking and patient management flow.
