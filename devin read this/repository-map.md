# Repository Map: groupsmix/webs-alots

## 1. System Overview (High-Level Architecture)

**What it is:** A multi-tenant SaaS clinic management platform built for the Moroccan healthcare market. Each clinic tenant gets a subdomain (e.g., `clinic-name.domain.com`) with a public-facing website, patient booking, and a role-based admin dashboard.

**Tech stack:**
- **Framework:** Next.js 16.2.0 (App Router, React 19, TypeScript 5)
- **Runtime:** Cloudflare Workers (via `@opennextjs/cloudflare`)
- **Database / Auth:** Supabase (PostgreSQL + Phone OTP Auth + Row-Level Security)
- **File Storage:** Cloudflare R2 (AWS SDK v3 compatible, with replica failover)
- **Payments:** Stripe (international) + CMI (Morocco-specific gateway)
- **Messaging:** WhatsApp (Meta Business API or Twilio), SMS (Twilio), Email (Resend API or HTTP relay)
- **AI Chatbot:** Cloudflare Workers AI (free, Llama 3.1) or OpenAI (paid)
- **Cron:** Cloudflare Workers scheduled triggers
- **DNS/Domains:** Cloudflare API for custom domain automation
- **CSS:** Tailwind CSS 4 + shadcn/ui component library
- **Validation:** Zod schemas for all API payloads
- **Testing:** Playwright (e2e), Vitest (unit)

**Deployment model:**
- `main` branch deploys to Cloudflare Workers (production)
- `staging` branch deploys to Cloudflare Workers (staging environment)
- CI: GitHub Actions (lint + typecheck on PRs, build + deploy on push)

---

## 2. System Breakdown (by Parts)

### 2.1 Multi-Tenancy System

**How tenants are resolved:**

| Layer | File | Responsibility |
|-------|------|----------------|
| Middleware | `src/middleware.ts` (426 lines) | Extracts subdomain from hostname, looks up `clinics` table by `domain` column, injects `x-tenant-clinic-id` / `x-tenant-clinic-name` / `x-tenant-clinic-type` headers into the request |
| Subdomain extraction | `src/lib/subdomain.ts` (58 lines) | Parses hostname against `ROOT_DOMAIN` env var; supports localhost ports for development |
| Server-side resolver | `src/lib/tenant.ts` (48 lines) | `getTenant()` reads tenant headers; defines `TENANT_HEADERS` constants |
| Client-side context | `src/components/tenant-provider.tsx` (39 lines) | React context provider that reads tenant from response headers on the client |
| Clinic config | `src/config/clinic.config.ts` (212 lines) | Per-deployment config: clinic name, type, currency (MAD), timezone (Africa/Casablanca), locale, feature flags, theme colors, booking settings (advance days, buffer minutes, max per slot) |

**Tenant data flow:**
```
Browser request → middleware extracts subdomain → DB lookup → injects headers →
  Server components read via getTenant() →
  Client components read via TenantProvider context
```

### 2.2 Auth System

**Auth method:** Phone OTP via Supabase Auth (primary). Email and social login also supported.

| File | Responsibility |
|------|----------------|
| `src/lib/auth.ts` (187 lines) | Server actions: `signInWithOTP()`, `verifyOTP()`, `registerPatient()`, `signOut()`, `getUserProfile()`, `requireAuth()`, `requireRole()` |
| `src/lib/with-auth.ts` (103 lines) | Middleware wrapper for API route handlers — verifies session, extracts user profile, enforces role requirements |
| `src/lib/api-auth.ts` (64 lines) | API key authentication for public V1 REST endpoints (header `x-api-key` matched against `api_keys` table) |
| `src/lib/auth-roles.ts` | Role constants and permission mappings |
| `src/app/auth/callback/route.ts` (47 lines) | OAuth callback handler — exchanges auth code, redirects based on user role |
| `src/app/(auth)/` | Auth pages (login, register, verify) |

**5 roles (enforced at DB level via RLS):**
- `super_admin` — full access to everything
- `clinic_admin` — full CRUD within their clinic
- `receptionist` — read/write appointments, patients, payments within clinic
- `doctor` — read/write own patients & appointments within clinic
- `patient` — read own data, create bookings/reviews

**DB auth trigger:** `handle_new_auth_user()` — auto-creates a `users` row on Supabase Auth signup, defaulting role to `patient`.

### 2.3 Database (Schema, Migrations, Supabase)

**Location:** `supabase/migrations/` (28 migration files)

#### Core Schema (00001_initial_schema.sql — 333 lines)

**Shared tables (all clinic types):**

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `clinics` | Tenant registry | id, name, type (doctor/dentist/pharmacy), config (JSONB), tier (vitrine/cabinet/pro/premium/saas), status, domain |
| `users` | All user roles | id, auth_id (FK to Supabase Auth), role, name, phone, email, clinic_id |
| `appointments` | Booking records | patient_id, doctor_id, clinic_id, service_id, slot_start/slot_end, status (8 states), source (online/phone/walk_in/whatsapp), is_first_visit, insurance_flag |
| `services` | Clinic service catalog | clinic_id, name, price, duration_minutes, category |
| `time_slots` | Doctor availability config | doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes |
| `notifications` | Multi-channel notifications | user_id, type, channel (whatsapp/email/sms/in_app), message, sent_at, read_at |
| `payments` | Payment records | clinic_id, patient_id, appointment_id, amount, method, status, ref |
| `reviews` | Patient reviews | patient_id, clinic_id, stars (1-5), comment, response |
| `documents` | Uploaded files | user_id, clinic_id, type (prescription/lab_result/xray/insurance/invoice/photo/other), file_url |
| `waiting_list` | Waitlist entries | patient_id, doctor_id, clinic_id, preferred_date, status |

**Doctor extras:**

| Table | Purpose |
|-------|---------|
| `prescriptions` | Doctor prescriptions (JSONB content, PDF URL) |
| `consultation_notes` | Visit notes (private flag for doctor-only visibility) |
| `family_members` | Patient family relationships |

**Dentist extras:**

| Table | Purpose |
|-------|---------|
| `odontogram` | Tooth chart (32 teeth, 8 statuses) |
| `treatment_plans` | Multi-step treatment plans (JSONB steps, total cost) |
| `lab_orders` | Dental lab work orders |
| `installments` | Payment installment tracking for treatment plans |
| `sterilization_log` | Tool sterilization tracking |

**Pharmacy extras:**

| Table | Purpose |
|-------|---------|
| `products` | Product catalog (barcode, requires_prescription flag) |
| `suppliers` | Supplier registry |
| `stock` | Inventory management (quantity, min_threshold, expiry_date) |
| `prescription_requests` | Patient prescription upload workflow |
| `loyalty_points` | Patient loyalty program |

#### RLS Policies (00002_auth_rls_roles.sql — 669 lines)

RLS is enabled on ALL 22 tables. Six SQL helper functions power the policies:
- `get_my_user_id()` — current user's internal ID
- `get_user_clinic_id()` — current user's clinic_id
- `get_user_role()` — current user's role
- `is_super_admin()` — boolean check
- `is_clinic_admin(clinic_id)` — boolean check for specific clinic
- `is_clinic_staff()` — true for clinic_admin, receptionist, doctor

#### Additional Migrations (00003–00028)

| Migration | Purpose |
|-----------|---------|
| 00003 | Seed data |
| 00004 | Add clinic subdomain/domain columns |
| 00005 | Schema gap fixes |
| 00006 | Clinic branding (colors, fonts, logos) |
| 00007 | Website customization tables |
| 00008 | Chatbot configuration tables (custom FAQs) |
| 00009 | Clinic type categories and registry (36 clinic types) |
| 00010 | Medical-specific feature tables |
| 00011 | Specialty module tables |
| 00012 | Specialist feature tables |
| 00013 | Para-medical tables (physiotherapy, speech therapy, etc.) |
| 00014 | Diagnostic, pharmacy, equipment tables |
| 00015 | Phase 6: clinics & centers tables |
| 00016 | Custom fields system |
| 00017 | Lab, clinic center additional tables |
| 00018 | Missing RLS policies backfill |
| 00019 | Auth/data RLS schema fixes |
| 00020 | Notification log enhancements |
| 00021 | Backfill clinic city column |
| 00022 | Schema drift fixes |
| 00023 | Missing tables backfill |
| 00024 | Missing FK indexes |
| 00025 | Seed features and pricing tiers |
| 00026 | Unique index preventing double-booking |
| 00027 | Unique index preventing duplicate active payments |
| 00028 | Security hardening |

### 2.4 Frontend

#### Route Groups (Next.js App Router)

The `src/app/` directory uses 20+ route groups for role-based page separation:

| Route Group | Purpose |
|-------------|---------|
| `(public)` | Public clinic website: homepage, services, doctors, reviews, booking, contact, location, blog, about, how-to-book, testimonials |
| `(auth)` | Login, register, verify pages |
| `(admin)` | Clinic admin dashboard |
| `(doctor)` | Doctor dashboard |
| `(receptionist)` | Receptionist dashboard |
| `(patient)` | Patient portal |
| `(super-admin)` | Platform super admin panel |
| `(pharmacist)` | Pharmacist dashboard |
| `(dentist-public)` | Dentist-specific public pages |
| `(pharmacy-public)` | Pharmacy-specific public pages |
| `(lab)` | Lab management dashboard |
| `(lab-public)` | Lab public pages |
| `(radiology)` | Radiology dashboard |
| `(equipment)` | Equipment management |
| `(parapharmacy)` | Parapharmacy dashboard |
| `(optician)` | Optician dashboard |
| `(physiotherapist)` | Physiotherapist dashboard |
| `(psychologist)` | Psychologist dashboard |
| `(nutritionist)` | Nutritionist dashboard |
| `(speech-therapist)` | Speech therapist dashboard |

#### Root Layout (`src/app/layout.tsx` — 96 lines)

- Wraps entire app in `TenantProvider`
- Injects `Chatbot` component globally
- Sets viewport metadata and global CSS

#### Components (`src/components/`)

| Directory | Contents |
|-----------|----------|
| `admin/` | Admin dashboard components |
| `doctor/` | Doctor workspace components |
| `receptionist/` | Receptionist workspace components |
| `patient/` | Patient portal components |
| `super-admin/` | Super admin panel components |
| `booking/` | Booking flow components |
| `chatbot/` | AI chatbot widget components |
| `pharmacy/` | Pharmacy management components |
| `dental/` | Dental-specific components (odontogram, treatment plans) |
| `dental-lab/` | Dental lab order components |
| `medical/` | Medical record components |
| `aesthetic/` | Aesthetic clinic components (before/after photos) |
| `dialysis/` | Dialysis center components |
| `ivf/` | IVF clinic components |
| `lab/` | Laboratory components |
| `para-medical/` | Para-medical specialty components |
| `polyclinic/` | Polyclinic management components |
| `morocco/` | Morocco-specific UI components |
| `installments/` | Payment installment components |
| `custom-fields/` | Dynamic custom field components |
| `analytics/` | Dashboard analytics components |
| `public/` | Public website page components |
| `ui/` | shadcn/ui base components (Button, Card, Dialog, etc.) |
| `insurance-calculator.tsx` | Insurance copay calculator |
| `notification-bell.tsx` | In-app notification bell |
| `locale-switcher.tsx` | Language switcher (FR/AR/EN) |
| `qr-code-generator.tsx` | QR code generation |
| `video-consultation.tsx` | Video consultation component |
| `google-maps-embed.tsx` | Google Maps embed |
| `landing-page-builder.tsx` | Visual landing page builder |
| `clinic-type-icon.tsx` | Clinic type icon renderer |
| `sign-out-button.tsx` | Sign out button |
| `tenant-provider.tsx` | Tenant context provider |

### 2.5 Backend (API Routes)

All API routes are in `src/app/api/`:

#### Booking API

| Route | Method | Purpose |
|-------|--------|---------|
| `api/booking/route.ts` (415 lines) | POST | Create appointment. Verifies HMAC booking token, handles race conditions with slot overlap check, calls `findOrCreatePatient()`, dispatches notifications |
| `api/booking/cancel/route.ts` | POST | Cancel appointment |
| `api/booking/reschedule/route.ts` | POST | Reschedule appointment |
| `api/booking/recurring/route.ts` | POST | Create/cancel recurring appointments (weekly/biweekly/monthly) |
| `api/booking/emergency-slot/route.ts` | POST | Create/book emergency slots |
| `api/booking/waiting-list/route.ts` | POST | Add to waiting list |
| `api/booking/payment/route.ts` | POST | Initiate/confirm/refund booking payments |

#### Payment API

| Route | Method | Purpose |
|-------|--------|---------|
| `api/payments/create-checkout/route.ts` (130 lines) | POST | Create Stripe checkout session |
| `api/payments/webhook/route.ts` (180 lines) | POST | Handle Stripe webhooks (checkout.session.completed, payment_intent.succeeded/failed) |
| `api/payments/cmi/route.ts` (102 lines) | POST | Create CMI payment session |
| `api/payments/cmi/callback/route.ts` (82 lines) | POST | Handle CMI payment callback |

#### Other API Routes

| Route | Purpose |
|-------|---------|
| `api/chat/route.ts` (297 lines) | AI chatbot endpoint — 3 intelligence levels (basic/smart/advanced), prompt injection sanitization, rate limiting |
| `api/notifications/route.ts` | Dispatch multi-channel notifications |
| `api/upload/route.ts` | File upload to Cloudflare R2 |
| `api/branding/route.ts` | Clinic branding CRUD |
| `api/onboarding/route.ts` | New clinic onboarding |
| `api/impersonate/route.ts` | Super admin clinic impersonation |
| `api/custom-fields/route.ts` | Custom field definition CRUD |
| `api/clinic-features/route.ts` | Feature toggle management |
| `api/lab/route.ts` | Lab report generation |
| `api/radiology/route.ts` | Radiology order management |
| `api/health/route.ts` | Health check endpoint |
| `api/webhooks/route.ts` | WhatsApp webhook handler |

#### Public REST API (V1)

| Route | Purpose |
|-------|---------|
| `api/v1/appointments/` | External appointment CRUD (API key auth via `x-api-key` header) |
| `api/v1/patients/` | External patient CRUD (API key auth) |

#### Cron Endpoints

| Route | Purpose |
|-------|---------|
| `api/cron/reminders/route.ts` (246 lines) | Appointment reminders — sends WhatsApp/email notifications for appointments in the next 24h. Protected by `CRON_SECRET` bearer token |
| `api/cron/billing/route.ts` (75 lines) | Subscription billing renewal — processes clinics with expired billing periods. Protected by `CRON_SECRET` |

### 2.6 External Integrations

#### Payments

| File | Integration | Details |
|------|-------------|---------|
| `src/lib/cmi.ts` (198 lines) | CMI (Morocco) | HMAC-SHA256 signed payment sessions, callback verification, Moroccan payment gateway |
| `src/app/api/payments/create-checkout/route.ts` | Stripe | International card payments via Stripe Checkout |
| `src/app/api/payments/webhook/route.ts` | Stripe Webhooks | Signature verification, payment status updates |

#### Messaging

| File | Integration | Details |
|------|-------------|---------|
| `src/lib/whatsapp.ts` (270 lines) | WhatsApp Business API | Dual provider support: Meta Graph API v21.0 or Twilio. Template messages, text messages, webhook verification (HMAC-SHA256) |
| `src/lib/sms.ts` (82 lines) | Twilio SMS | Text message sending via Twilio REST API |
| `src/lib/email.ts` (223 lines) | Email | Dual provider: Resend API or generic HTTP relay (Mailgun/Postmark). Supports custom from addresses and reply-to |
| `src/lib/notifications.ts` (519 lines) | Notification Dispatcher | Template-based multi-channel dispatch. Resolves notification templates from DB, substitutes variables, delivers via WhatsApp + in-app + email + SMS |
| `src/lib/notification-persist.ts` (74 lines) | In-App Notifications | Persists in-app notifications to Supabase `notifications` table |

#### Calendar

| File | Integration | Details |
|------|-------------|---------|
| `src/lib/google-calendar.ts` (287 lines) | Google Calendar API v3 | OAuth2 flow, token refresh, CRUD calendar events, appointment-to-event conversion |

#### Storage

| File | Integration | Details |
|------|-------------|---------|
| `src/lib/r2.ts` (242 lines) | Cloudflare R2 | AWS SDK v3 S3Client, presigned upload/download URLs, organized by `clinics/{clinicId}/` prefix |
| `src/lib/r2-fallback.ts` (170 lines) | R2 Replica Failover | Circuit breaker pattern: primary bucket health check with automatic failover to replica bucket |

#### DNS / Custom Domains

| File | Integration | Details |
|------|-------------|---------|
| `src/lib/custom-domain.ts` (246 lines) | Cloudflare DNS API | Add/remove CNAME records for clinic subdomains and custom domains, SSL provisioning, domain verification |

#### AI Chatbot

| File | Integration | Details |
|------|-------------|---------|
| `src/app/api/chat/route.ts` (297 lines) | Cloudflare Workers AI + OpenAI | 3 tiers: basic (keyword matching), smart (Llama 3.1 8B via CF Workers AI), advanced (OpenAI streaming). Includes prompt injection sanitization |
| `src/lib/chatbot-data.ts` (319 lines) | Chatbot Data Layer | Fetches clinic context, builds French-language system prompts, keyword-based fallback responses |

### 2.7 Background Jobs / Cron

| Component | File | Schedule | Purpose |
|-----------|------|----------|---------|
| Reminder Cron | `src/app/api/cron/reminders/route.ts` | Every 30 min | Finds appointments in next 24h across all active clinics, sends WhatsApp/email reminders, marks as notified |
| Billing Cron | `src/app/api/cron/billing/route.ts` | Daily at midnight | Processes subscription renewals for clinics past their billing period end date |
| Worker Entry | `worker-cron-handler.ts` (69 lines) | Cloudflare scheduled | Cloudflare Worker that receives `scheduled` events and calls the Next.js cron API routes with `CRON_SECRET` |
| Worker Config | `wrangler.toml` (66 lines) | — | Defines two cron triggers: `*/30 * * * *` (reminders) and `0 0 * * *` (billing) |

### 2.8 Subscription & Billing

| File | Responsibility |
|------|----------------|
| `src/lib/subscription-billing.ts` (432 lines) | 4 subscription tiers (vitrine/cabinet/pro/premium) with per-clinic-type pricing. Auto-renewal logic, grace periods, tier downgrade on failure |
| `src/lib/config/pricing.ts` (80 lines) | Pricing UI types and display constants (tier colors, status colors, tier limits) |
| `src/lib/super-admin-actions.ts` (687 lines) | Super admin server actions: CRUD clinics/users/services/time-slots, dashboard stats, billing records, announcements, activity logs, feature definitions, pricing tiers, feature toggles, client subscriptions |

### 2.9 Internationalization

| File | Responsibility |
|------|----------------|
| `src/lib/i18n.ts` (470 lines) | 3 locales: French (fr), Arabic (ar), English (en). Translation keys for navigation, booking, payment, invoice, insurance, prescription, waiting room, garde, Ramadan, carnet de sante, directory, accounting. RTL detection. Darija phrases |

### 2.10 Morocco-Specific Business Logic

| File | Responsibility |
|------|----------------|
| `src/lib/morocco.ts` (602 lines) | Phone formatting (Moroccan numbers), TVA calculation (5 rates: 0%/7%/10%/14%/20%), MAD currency formatting, insurance providers (CNSS/CNOPS/AMO/RAMED + 6 private), reste-a-charge calculation, 9 payment methods (cash/CMI/CashPlus/Wafacash/BaridBank/transfer/check/insurance/online), Ramadan mode (adjusted working hours), installment plan calculation, Moroccan cities list, Garde schedule |
| `src/lib/invoice-generator.ts` (366 lines) | Moroccan-compliant invoice generation with TVA breakdown, legal fields (ICE, IF, RC, CNSS, Patente), print-ready HTML, proforma invoices |

---

## 3. Key Files & Responsibilities

### Entry Points

| File | Type | Responsibility |
|------|------|----------------|
| `src/middleware.ts` (426 lines) | Request interceptor | **THE critical gateway.** Every request passes through. Handles: subdomain extraction → tenant DB lookup → CSRF protection → rate limiting → auth session check → role-based route protection → CSP nonce injection. Skips static assets and API routes selectively |
| `src/app/layout.tsx` (96 lines) | Root layout | Wraps all pages in TenantProvider + Chatbot |
| `next.config.ts` (82 lines) | Build config | Security headers (X-Frame-Options, CSP, HSTS), image optimization patterns, Cloudflare Workers compatibility |
| `src/instrumentation.ts` | Startup hook | Calls `enforceEnvValidation()` on server start |

### Shared Utilities

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/supabase-server.ts` (38 lines) | Server | Creates server-side Supabase client with cookie-based auth |
| `src/lib/supabase-client.ts` (18 lines) | Client | Creates browser-side Supabase client |
| `src/lib/data/client.ts` (5115 lines) | Client | **Largest file in the repo.** Client-side data fetching for every entity: appointments, doctors, patients, services, reviews, prescriptions, invoices, waiting list, consultation notes, time slots, notifications, documents, family members, dashboard stats, and 30+ specialty-specific fetchers. Includes lazy lookup caches |
| `src/lib/data/public.ts` (700+ lines) | Server | Public-facing data fetching (no auth required): clinic info, services, doctors, working hours for the public website |
| `src/lib/data/server.ts` (1200+ lines) | Server | Authenticated data fetching for dashboard pages |
| `src/lib/validations.ts` (353 lines) | Shared | Zod schemas for ALL API payloads: booking, payments, notifications, onboarding, custom fields, lab, radiology, V1 API, chat, branding. Includes `safeParse()` helper |
| `src/lib/rate-limit.ts` (308 lines) | Server | Distributed sliding-window rate limiter with named limiters (apiLimiter, authLimiter, chatLimiter, bookingLimiter). Supports Supabase or in-memory backends |
| `src/lib/logger.ts` (107 lines) | Shared | Structured JSON logging to stderr, external transport hooks for Sentry/Datadog/LogTail |
| `src/lib/features.ts` (100 lines) | Shared | Feature flag system: 70+ `ClinicFeatureKey` types, `isFeatureEnabled()`, `filterByFeatures()` |
| `src/lib/env.ts` (137 lines) | Server | Startup env var validation: required vs optional, grouped by feature, hard-fail for missing core vars |
| `src/lib/cors.ts` (94 lines) | Server | CORS config from `ALLOWED_API_ORIGINS` env var, deny-by-default |
| `src/lib/crypto-utils.ts` (54 lines) | Shared | Web Crypto API: timing-safe string comparison, SHA-256, HMAC-SHA256 |
| `src/lib/timezone.ts` (97 lines) | Shared | Morocco DST-aware date/time construction (4 DST transitions/year due to Ramadan) |
| `src/lib/escape-html.ts` (16 lines) | Shared | XSS prevention for HTML template interpolation |
| `src/lib/json-ld.ts` (12 lines) | Shared | Safe JSON-LD serialization for `<script>` tags |
| `src/lib/responsive.ts` (231 lines) | Client | Responsive hooks: useBreakpoint, useIsMobile, useBodyScrollLock, useDebounce, useThrottle |
| `src/lib/utils.ts` | Shared | General utilities (cn class merger, etc.) |
| `src/lib/find-or-create-patient.ts` (93 lines) | Server | Patient deduplication: phone-based lookup preferred, name-based fallback, creates new if ambiguous |
| `src/lib/audit-log.ts` (47 lines) | Server | Healthcare compliance audit logging to `activity_logs` table |
| `src/lib/backup.ts` (324 lines) | Server | Clinic data backup/restore: export to JSON, validate backup, restore with ID remapping (atomic via RPC or sequential fallback) |
| `src/lib/export-data.ts` (149 lines) | Client | CSV export with formula injection prevention |
| `src/lib/prescription-pdf.ts` (225 lines) | Client | Prescription PDF generation via browser print dialog |

### Config Files

| File | Purpose |
|------|---------|
| `src/lib/config/clinic-types.ts` (137 lines) | 5 clinic categories (medical, para-medical, diagnostic, pharmacy/retail, clinics/centers), 36 individual clinic types with French/Arabic labels |
| `src/lib/config/pricing.ts` (80 lines) | Pricing tier types and UI constants |
| `src/lib/templates.ts` (119 lines) | 6 website templates: modern, classic, elegant, bold, minimal, arabic (RTL) |
| `src/lib/website-config.ts` (183 lines) | Public website content configuration (hero, about, services, location, contact, theme) |
| `src/lib/section-visibility.ts` (117 lines) | 11 toggleable website sections (hero, services, doctors, reviews, blog, before/after, location, booking, contact form, insurance, FAQ) |

### CI/CD & DevOps

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | PR checks: lint + typecheck (Node 22) |
| `.github/workflows/deploy.yml` | Build + deploy to Cloudflare Workers on push to main/staging |
| `.github/workflows/backup.yml` | Database backup workflow |
| `.github/workflows/r2-replication.yml` | R2 bucket replication workflow |
| `.github/workflows/migration-check.yml` | Migration validation workflow |
| `wrangler.toml` (66 lines) | Cloudflare Workers config: entry point, compatibility date, cron triggers, environment bindings |
| `scripts/backup-database.sh` | Database backup script |
| `scripts/r2-sync.sh` | R2 bucket sync script |
| `scripts/staging-swap.sh` | Staging environment swap |
| `scripts/patch-opennext.mjs` | OpenNext build patches |
| `scripts/post-build-patch.mjs` | Post-build patches |

### Supabase Edge Functions

| File | Purpose |
|------|---------|
| `supabase/functions/notify-booking/index.ts` (201 lines) | Deno-based edge function triggered on new appointment creation. Sends WhatsApp to patient + doctor, in-app notification to clinic admin |

### E2E Tests

| File | Purpose |
|------|---------|
| `e2e/smoke.spec.ts` | Smoke test |
| `e2e/booking-flow.spec.ts` | Booking flow end-to-end test |

---

## 4. Core Flows (Step-by-Step)

### 4.1 Tenant Resolution Flow

```
1. Browser navigates to https://clinic-name.example.com
2. middleware.ts intercepts the request
3. extractSubdomain(hostname) parses against ROOT_DOMAIN
   - Production: strips .ROOT_DOMAIN from hostname
   - Localhost: reads ?subdomain= query param
4. If subdomain found → query Supabase: clinics WHERE domain = subdomain
5. If clinic found AND status = 'active':
   - Inject headers: x-tenant-clinic-id, x-tenant-clinic-name, x-tenant-clinic-type
   - Continue to Next.js routing
6. If clinic not found → redirect to root domain landing
7. Server components call getTenant() → reads injected headers
8. Client components use TenantProvider context → reads headers from response
```

### 4.2 Authentication Flow

```
1. Patient navigates to /auth/login
2. Enters phone number → signInWithOTP(phone) calls supabase.auth.signInWithOtp()
3. Supabase sends OTP via SMS
4. Patient enters OTP → verifyOTP(phone, token)
   - supabase.auth.verifyOtp({ phone, token, type: 'sms' })
5. On success: Supabase Auth creates session cookie
6. DB trigger handle_new_auth_user() fires:
   - Creates users row with auth_id, role='patient', clinic_id from metadata
7. Middleware on subsequent requests:
   - supabase.auth.getUser() validates session
   - Looks up users table for role
   - Enforces role-based route access:
     * /admin/* → clinic_admin only
     * /doctor/* → doctor only
     * /receptionist/* → receptionist only
     * /patient/* → patient only
     * /super-admin/* → super_admin only
8. OAuth callback flow (for email/social):
   - /auth/callback/route.ts exchanges code for session
   - Redirects to role-appropriate dashboard
```

### 4.3 Booking Flow

```
1. Patient on public website selects doctor + service + date + time
2. Frontend generates HMAC booking token:
   - Payload: clinicId + doctorId + date + time + patientName
   - Signed with BOOKING_TOKEN_SECRET
3. POST /api/booking with token + booking details

4. Server-side (booking/route.ts):
   a. Verify HMAC token signature
   b. Resolve clinic from tenant headers
   c. findOrCreatePatient():
      - If patientId starts with "patient-" → temporary frontend ID
      - Try phone-based lookup first (unique per clinic)
      - Fallback to name-based lookup (only if exactly 1 match)
      - Create new patient if 0 or 2+ matches
   d. Race condition check:
      - Query existing appointments for same doctor + overlapping time slot
      - If conflict exists → return 409
   e. Insert appointment row (status: 'pending')
   f. Dispatch notifications (parallel):
      - WhatsApp confirmation to patient
      - WhatsApp alert to doctor
      - In-app notification to clinic admin
   g. Audit log entry
   h. Return appointment ID

5. Supabase Edge Function notify-booking may also fire (DB webhook)
   - Sends WhatsApp to patient + doctor
   - Creates in-app notification for clinic admin
```

### 4.4 Payment Flow (Stripe)

```
1. POST /api/payments/create-checkout
   a. Auth check via with-auth wrapper
   b. Validate input with stripeCheckoutSchema
   c. Create Stripe checkout session:
      - Line item with amount + description
      - success_url + cancel_url (clinic subdomain)
      - Metadata: clinicId, patientId, appointmentId
   d. Return checkout URL

2. Patient redirected to Stripe Checkout page
3. Patient completes payment on Stripe

4. Stripe sends webhook → POST /api/payments/webhook
   a. Verify Stripe signature (STRIPE_WEBHOOK_SECRET)
   b. Handle checkout.session.completed:
      - Extract metadata (clinicId, appointmentId)
      - Insert payment record (status: 'completed')
      - Update appointment status to 'confirmed'
   c. Handle payment_intent.succeeded/failed:
      - Update payment record status accordingly
```

### 4.5 Payment Flow (CMI — Morocco)

```
1. POST /api/payments/cmi
   a. Auth check
   b. Validate input with cmiPaymentSchema
   c. Generate CMI session:
      - Build parameter string: merchantId + amount + currency + orderId
      - Sign with HMAC-SHA256 using CMI_SECRET_KEY
      - Build CMI form action URL with signed params
   d. Return CMI redirect URL + form data

2. Patient redirected to CMI payment page
3. Patient completes payment on CMI

4. CMI sends callback → POST /api/payments/cmi/callback
   a. Verify HMAC signature against CMI_SECRET_KEY
   b. If valid + successful:
      - Insert payment record
      - Update appointment status
   c. Return success/failure to CMI
```

### 4.6 Notification Dispatch Flow

```
1. Trigger point (booking, reminder, payment, etc.) calls dispatchNotification()
2. notifications.ts resolves notification template from DB:
   - Looks up notification_templates table by trigger key + clinic_id
   - Falls back to global template if no clinic-specific one
3. Variable substitution in template:
   - Replace {{patient_name}}, {{doctor_name}}, {{date}}, {{time}}, etc.
4. For each recipient + channel:
   - whatsapp → whatsapp.ts → Meta API or Twilio API
   - sms → sms.ts → Twilio API
   - email → email.ts → Resend API or HTTP relay
   - in_app → notification-persist.ts → insert into notifications table
5. Log dispatch result to notification_logs table
```

### 4.7 Cron Reminder Flow

```
1. Cloudflare Worker receives scheduled event (every 30 min)
2. worker-cron-handler.ts calls POST /api/cron/reminders with CRON_SECRET
3. Cron auth verified (timing-safe comparison of bearer token)
4. Query all active clinics
5. For each clinic:
   - Find appointments in next 24 hours that haven't been notified
   - For each appointment:
     - Send WhatsApp reminder to patient (if phone available)
     - Send email reminder (if email available)
     - Mark appointment as notification_sent = true
6. Return summary of sent notifications
```

---

## 5. Dependency Map (How Parts Connect)

### Request Processing Pipeline

```
Browser Request
    │
    ▼
middleware.ts
    ├── subdomain.ts (extract subdomain)
    ├── tenant.ts (resolve clinic_id from DB)
    ├── rate-limit.ts (sliding window check)
    ├── crypto-utils.ts (CSRF token verification)
    └── supabase-server.ts (auth session check)
    │
    ▼
Next.js Route Handler
    ├── with-auth.ts (API route auth wrapper)
    ├── validations.ts (Zod schema validation)
    ├── cors.ts (CORS headers for V1 API)
    └── api-auth.ts (API key auth for V1)
```

### Data Layer Dependencies

```
src/lib/data/client.ts (browser)
    └── supabase-client.ts → Supabase JS Client (cookie auth + RLS)

src/lib/data/server.ts (server components)
    └── supabase-server.ts → Supabase JS Client (cookie auth + RLS)

src/lib/data/public.ts (server, no auth)
    └── supabase-server.ts → Supabase JS Client (service role for public data)
```

### Integration Dependencies

```
Booking API
    ├── find-or-create-patient.ts
    ├── notifications.ts → whatsapp.ts, sms.ts, email.ts, notification-persist.ts
    ├── audit-log.ts → activity_logs table
    ├── timezone.ts (Morocco DST handling)
    └── crypto-utils.ts (HMAC token verification)

Payment API
    ├── Stripe SDK (via direct API calls)
    ├── cmi.ts (CMI gateway)
    └── notifications.ts (payment confirmation dispatch)

Cron Jobs
    ├── cron-auth.ts (bearer token verification)
    ├── subscription-billing.ts (tier management)
    ├── whatsapp.ts + email.ts (reminder delivery)
    └── supabase-server.ts (data queries)

Chatbot API
    ├── chatbot-data.ts (clinic context fetching)
    ├── rate-limit.ts (per-IP throttling)
    ├── Cloudflare Workers AI API
    └── OpenAI API (streaming)
```

### Configuration Dependencies

```
clinic.config.ts (per-deployment)
    ├── Read by: middleware, booking, timezone, data layers
    └── Controls: clinic type, currency, timezone, features, theme, booking rules

features.ts (feature flags)
    ├── Read by: components, data fetchers
    └── Controls: which specialty modules are enabled per clinic type

templates.ts + website-config.ts + section-visibility.ts
    ├── Read by: public website pages
    └── Controls: website appearance and content

morocco.ts
    ├── Read by: invoice-generator, payment components, booking, insurance calculator
    └── Controls: TVA rates, currency formatting, insurance, Ramadan hours

i18n.ts
    ├── Read by: all UI components
    └── Controls: FR/AR/EN translations, RTL direction
```

### Cross-Cutting Concerns

```
logger.ts ──── Used by ALL server-side code for structured logging
env.ts ──── Validates ALL env vars at startup (instrumentation.ts)
rate-limit.ts ──── Applied in middleware + individual API routes
audit-log.ts ──── Called from booking, patient CRUD, admin actions
escape-html.ts ──── Used by invoice-generator, prescription-pdf
crypto-utils.ts ──── Used by middleware (CSRF), booking (HMAC), CMI (signatures)
```

### Environment Variables Map

```
CORE (required):
  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

TENANT:
  ROOT_DOMAIN, NEXT_PUBLIC_SITE_URL

AUTH:
  SUPABASE_SERVICE_ROLE_KEY, BOOKING_TOKEN_SECRET

STORAGE:
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
  R2_PUBLIC_URL, R2_REPLICA_PUBLIC_URL

PAYMENTS:
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
  CMI_MERCHANT_ID, CMI_SECRET_KEY

MESSAGING:
  WHATSAPP_PROVIDER (meta|twilio)
  WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN (Meta)
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, TWILIO_SMS_FROM
  META_APP_SECRET, WHATSAPP_VERIFY_TOKEN
  RESEND_API_KEY (or EMAIL_RELAY_HOST, EMAIL_RELAY_USER, EMAIL_RELAY_PASS)

AI:
  OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_API_TOKEN

CALENDAR:
  GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI

CRON:
  CRON_SECRET

DOMAINS:
  CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID

CORS:
  ALLOWED_API_ORIGINS

RATE LIMITING:
  RATE_LIMIT_BACKEND (supabase|memory)
```

### File Count Summary

| Category | Approximate Count |
|----------|-------------------|
| Database migrations | 28 SQL files |
| API routes | ~20 route files |
| Library/utility files | ~50 files in src/lib/ |
| Component directories | ~30 component groups |
| Route groups (pages) | 20+ route groups |
| GitHub workflows | 5 workflow files |
| Scripts | 5 shell/JS scripts |
| E2E tests | 2 spec files |
| Config files | ~10 (next.config, tsconfig, wrangler, tailwind, etc.) |
