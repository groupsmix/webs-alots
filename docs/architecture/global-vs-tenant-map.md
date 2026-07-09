# Global vs. Tenant Architecture Map

Oltigo Health is a multi-tenant SaaS application. A critical invariant of the system is the strict separation between **Tenant-Scoped** boundaries (where clinic users operate) and **Platform-Global** boundaries (where Oltigo's super-admins and infrastructure operate).

This document serves as the canonical map for how tables, routes, and services are distributed across these two trust zones.

## 1. Database Tables (Supabase)

### Tenant-Scoped Tables (Requires `clinic_id`)

Almost all tables in Oltigo are tenant-scoped. Operations on these tables _must_ include an `.eq('clinic_id', clinicId)` filter in the application layer (defense-in-depth), and are guarded by RLS policies that enforce `clinic_id` matches.

- **Core Operations**: `clinics`, `users` (staff & patients), `appointments`, `services`, `time_slots`, `payments`, `installments`, `notifications`, `waiting_list`.
- **Clinical (PHI-Bearing)**: `consultation_notes`, `prescriptions`, `documents`, `treatment_plans`, `odontogram`, `lab_orders`, `family_members`, radiology images, vitals, specialized verticals (e.g. `ivf_cycles`, `pregnancies`).
- **Inventory/Pharmacy**: `products`, `suppliers`, `stock`, `lab_materials`, `sterilization_log`.

### Platform-Global Tables (Cross-Tenant)

These tables lack a `clinic_id` (or use it only as a loose foreign key for analytics, rather than scoping) and govern platform-wide behavior.

- **AI Subsystem**: `ai_provider_configs` (global API keys/routing), `ai_feature_toggles` (global kill switches), `ai_task_configs`, `ai_usage_logs` (billing).
- **Infrastructure / Ops**: `uptime_events`, `demo_leads`, `document_templates`.
- **RBAC Overrides**: Internal mappings for capabilities and roles, though mostly defined in code (`src/lib/config/capabilities.ts`).

## 2. API & Frontend Routes (Next.js)

### Tenant-Scoped Routes

Access requires a derived `clinic_id` (usually from the subdomain or the logged-in user's session).

- **Dashboards**: `/admin/*`, `/doctor/*`, `/receptionist/*`, `/patient/*`, and all specialty prefixes (`/pharmacist`, `/radiology`, etc.).
- **Mutations (API)**: `/api/booking/*`, `/api/payments/*`, `/api/patient/*`.

### Platform-Global Routes

Access is either fully public or strictly gated to the `super_admin` role.

- **Super Admin**: `/super-admin/*` (The cross-tenant control plane for provisioning, pricing, global AI toggles).
- **Webhooks**: `/api/webhooks/whatsapp`, `/api/webhooks/stripe` (These receive global payloads and must safely resolve the `clinic_id` from the payload metadata before proceeding).
- **Cron Jobs**: `/api/cron/*` (Runs globally, but execution typically loops over clinics safely).
- **Public**: `/` (marketing), `/api/v1/*` (Public REST API using API keys).

## 3. Infrastructure & Services

### Tenant-Scoped Services

- **R2 Storage**: PHI uploads are encrypted uniquely per file (`AES-256-GCM`) and paths are built with the `clinic_id` prefix.
- **Email / SMS**: Outbound templates are localized to the clinic's language and branded with the clinic's details.
- **Rate Limiting**: Cloudflare KV rate limits are often bucketed by `clinic_id` and `user_id` to prevent noisy-neighbor impact.

### Platform-Global Services

- **Cloudflare Workers (OpenNext)**: The execution environment is shared globally.
- **Database Connection Pooling**: PgBouncer (Supabase Pooler) manages a global pool of connections.
- **Observability**: Sentry and Plausible Analytics operate globally, though events may be tagged with `clinic_id` for debugging.
- **AI Routing**: The AI circuit breaker and provider rotation (`src/lib/ai/circuit-breaker.ts`) are global to prevent a single clinic's high usage from exhausting rate limits for everyone else.

---

> **Design Rule:** When adding a new table, route, or service, default to **Tenant-Scoped** unless it strictly manages platform-wide infrastructure. Cross-tenant queries are strictly forbidden in tenant-scoped routes.
