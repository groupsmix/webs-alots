# Oltigo Health — Final Project Architecture & Schema

> **Historical note:** This is a point-in-time analysis snapshot kept for provenance.
> Use `docs/architecture.md`, `docs/architecture/`, and `docs/audit/README.md` for the current living architecture and audit position.
>
> **Date:** July 2026
> **Scope:** Full architecture resolution, dashboard schemas, AI logic, and operational readiness.

## 1. High-Level Architecture Definition

Oltigo Health is a **multi-tenant SaaS platform for Moroccan clinics**. Every clinic is a tenant, strictly isolated by `clinic_id` at the application layer and the database layer (Supabase RLS).

The platform provides:

- **Public managed clinic websites & online booking**
- **Role-based operational dashboards** (Super-Admin, Clinic-Admin, Receptionist, Doctor, Patient)
- **WhatsApp, Email, and SMS notifications**
- **Payments & Subscriptions** (CMI + Stripe)
- **AI-powered Operations** (FAQ/booking bots, triage, clinic briefings, circuit-breaker resilience)

### 1.1 Tech Stack

- **Framework:** Next.js 16 + React 19 (App Router)
- **Database:** Supabase PostgreSQL (202 migrations, RLS, pgTAP)
- **Edge Deployment:** Cloudflare Workers via OpenNext
- **Storage & State:** Cloudflare R2 (PHI Files), KV (Feature Flags & Rate Limits), CF Queues (Notifications)
- **Third-Party:** Stripe, CMI, Meta WhatsApp API, OpenAI/Anthropic, Resend, Sentry, Plausible.

---

## 2. Directory Structure & Key Components

The repository is strictly organized to separate concerns, with a heavy emphasis on operational guardrails.

- `src/app/`: Next.js App Router containing 11 role-based route groups (e.g., `(super-admin)`, `(doctor)`) and 70 API route groups.
- `src/lib/`: Core backend library. Note that massive monoliths have been successfully split (e.g., `super-admin-actions.ts` is now modularized into `src/lib/super-admin/`, and `env.ts` was extracted into `env-startup.ts` and `env-validation.ts`).
- `src/lib/config/`: Single source of truth for platform configuration (`agent.config.ts`, `pricing.ts`, `verticals.ts`).
- `src/lib/types/`: Holds the generated `database.ts` (340KB) and domain-specific types.
- `docs/audit/`: Centralized operational tracking containing 31 audit reports and runbooks (replacing the legacy `need to fix/` directory).
- `scripts/`: Critical CI/CD validation scripts (e.g., `check-tenant-scoping.mjs`, `smoke-post-deploy.mjs`).

---

## 3. Dashboard Schemas & Role-Based Access Control (RBAC)

Oltigo enforces a strict 5-tier role hierarchy:
`super_admin > clinic_admin > receptionist > doctor > patient`

### 3.1. Super Admin Dashboard `/(super-admin)`

_Scope: Platform-wide control, cross-tenant management._

- **Feature Flags:** `/super-admin/feature-flags` UI to toggle AI and operational features via KV/Database.
- **Tenant Provisioning:** Clinic creation, DB seeding, and subscription assignment.
- **Compliance & Security:** Egress monitoring, PHI access logs, and system health snapshots.

### 3.2. Clinic Admin Dashboard `/(admin)`

_Scope: Single-tenant (clinic_id) operational configuration._

- **Settings:** Customizing clinic branding, operating hours, and booking rules.
- **Staff Management:** Inviting doctors and receptionists.
- **Analytics:** High-level revenue and appointment volume reporting.

### 3.3. Receptionist Dashboard `/(receptionist)`

_Scope: Daily operations and patient flow._

- **Schedule Grid:** Real-time view of all doctors' calendars.
- **Walk-ins & Check-ins:** Managing the live waiting room queue.
- **Communications:** WhatsApp reminder status and patient messaging.

### 3.4. Doctor Dashboard `/(doctor)`

_Scope: Clinical care and patient encounters (PHI surface)._

- **Daily Roster:** List of patients for the day.
- **Patient EMR:** Medical history, prescriptions, radiology reports (DICOM/R2).
- **AI Assistance:** Clinical encounter summarization and ICD-10 tagging.
- _Note:_ Contains 47 specialized sub-dashboards (e.g., cardiology, IVF) adapted to the clinic's vertical.

### 3.5. Patient Dashboard `/(patient)`

_Scope: Self-service and personal health data._

- **Booking Management:** Rescheduling, cancellations, and history.
- **Medical Records:** Secure download of encrypted PHI documents.
- **Telemetry:** (Optional) Real-time vitals streaming integration.

---

## 4. AI Architecture & Data Flow

AI in Oltigo is designed around **resilience, cost-control, and PHI safety**.

### 4.1. Core Components

- **Multi-Provider Routing (`src/lib/ai/router.ts`):** Dynamically shifts traffic between OpenAI, Anthropic, or local models based on availability and cost.
- **Circuit Breaker (`src/lib/ai/circuit-breaker.ts`):** Tracks consecutive provider failures. If a threshold is crossed (e.g., 5 errors in 1 min), the breaker opens, instantly failing over or returning graceful degradation to the user without hanging the app.
- **Feature Toggles (`src/lib/ai/feature-toggles.ts`):** Granular, tier-based enablement of AI features (e.g., `dashboard_insights`, `smart_recommendations`) stored in DB and mirrored to KV.

### 4.2. Workflows

1. **Clinic Briefings (`clinic-briefings.ts`):** A nightly cron job that aggregates non-PHI metrics (revenue, appointments) and uses the LLM to generate an executive summary for clinic admins.
2. **WhatsApp Booking Bot:** Parses natural language in Darija/French to extract booking intents and schedule appointments.
3. **Data Safety (`phi-compliance.ts`):** PII/PHI is explicitly stripped or pseudonymized before any prompt leaves the Cloudflare worker boundary. Egress is strictly enforced via `safeFetch()`.

---

## 5. Security & Operational Guardrails (Negative Architecture)

Oltigo is defined by what it **refuses** to do:

- **Never trust inbound tenant headers:** Middleware strips `x-clinic-id` and derives the tenant exclusively from the subdomain.
- **Never perform unscoped DB mutations:** CI scripts (`check-tenant-scoping.mjs`) block any PR that lacks `.eq("clinic_id", ...)` on updates/deletes.
- **Never allow arbitrary external network calls:** Backend fetches use `safeFetch()` to enforce the `EGRESS_ALLOWLIST` (Stripe, Supabase, Anthropic, etc.).
- **Never expose PHI unencrypted:** Files in R2 are encrypted via AES-256-GCM.
- **Never deploy broken AI:** Post-deploy smoke tests explicitly ping `/api/health` and verify the AI Worker routing zones.

---

## 6. Known Bugs & Audit Resolution (As of July 2026)

Following the exhaustive June/July audits, **the platform is 100% production-ready**:

- **K6 Performance Tests:** Trailing slash, IPv6 loopback, and JSON parsing bugs in `k6/lib/env-guard.js` are resolved.
- **P2 Operational Tasks:** Egress allowlists, AI Smoke tests, Feature Flag UIs, and Database Index / Chaos Engineering runbooks are fully implemented and verified.
- **Architecture Drift:** Monolith files like `super-admin-actions.ts` have been successfully modularized, and duplicate config directories have been purged.
