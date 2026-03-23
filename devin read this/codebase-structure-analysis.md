# Codebase Structure & Organization Analysis

**Date:** 2026-03-23  
**Scope:** Folder structure, separation of concerns, naming conventions  
**NOT covered:** Performance, security, deep code logic

---

## 1. High-Level Folder Structure

```
webs-alots/
├── src/
│   ├── app/            # Next.js App Router (256 files)
│   │   ├── (admin)/         # 26 files - Clinic admin pages
│   │   ├── (doctor)/        # 48 files - Doctor dashboard & specialties
│   │   ├── (patient)/       # 16 files - Patient portal
│   │   ├── (receptionist)/  # 9 files
│   │   ├── (super-admin)/   # 12 files
│   │   ├── (pharmacist)/    # 9 files
│   │   ├── (public)/        # 16 files - Public-facing pages
│   │   ├── (pharmacy-public)/ # 12 files
│   │   ├── (lab-public)/    # 6 files
│   │   ├── (lab)/           # 6 files
│   │   ├── (dentist-public)/ # 5 files
│   │   ├── (radiology)/     # 7 files
│   │   ├── (equipment)/     # 5 files
│   │   ├── (nutritionist)/  # 5 files
│   │   ├── (optician)/      # 5 files
│   │   ├── (physiotherapist)/ # 5 files
│   │   ├── (psychologist)/  # 5 files
│   │   ├── (speech-therapist)/ # 5 files
│   │   ├── (parapharmacy)/  # 5 files
│   │   ├── (auth)/          # 4 files
│   │   ├── api/             # 35 files - API routes
│   │   └── auth/            # 1 file - Auth callback
│   ├── components/     # 128 files across 24 domain folders
│   ├── lib/            # 81 files - Utilities, data layer, types
│   └── config/         # 2 files
├── supabase/           # Migrations (28 files) + edge functions
├── e2e/                # 2 Playwright test files
├── scripts/            # 5 build/deploy scripts
├── public/             # 4 SVG assets
├── .github/workflows/  # 5 CI/CD workflows
└── devin read this/    # Analysis reports
```

**Total source files:** ~465 TypeScript/TSX files in `src/`

---

## 2. Structure Problems

### 2.1 CRITICAL: `src/lib/data/client.ts` is a 5,114-line monolith

This single file contains **every client-side data function** for the entire application: appointments, patients, doctors, prescriptions, invoices, waiting list, lab orders, pharmacy stock, radiology, IVF, dental, dialysis, and dozens more.

**Why this is a problem:**
- Impossible to navigate or find specific functions
- Every domain change touches this one file, creating merge conflicts
- No domain boundaries - dental functions sit next to pharmacy functions
- The file itself admits this pattern: `"use client"` at the top, then 5,000+ lines of fetch functions

**Recommendation:** Split into domain-specific data modules:
```
src/lib/data/client/
├── appointments.ts
├── patients.ts
├── pharmacy.ts
├── dental.ts
├── radiology.ts
├── lab.ts
└── index.ts  (barrel re-exports)
```

### 2.2 CRITICAL: `src/lib/data/server.ts` (1,203 lines) - Same problem, server side

The server data layer mirrors the same monolith pattern. All server-side queries for every domain in one file.

### 2.3 CRITICAL: `src/lib/data/specialists.ts` (1,180 lines) - Third monolith

A third mega-file holding specialist-specific data functions (cardiology, endocrinology, etc.) that was created to offload `client.ts` but follows the same "dump everything in one file" pattern.

### 2.4 HIGH: `src/lib/types/database.ts` is 10,694 lines

This is a generated Supabase types file, so it's somewhat expected, but at 10K+ lines it significantly slows IDE tooling. Consider splitting if manual sections exist.

---

## 3. Mixed Responsibilities

### 3.1 Page files contain full application logic (400-764 lines each)

Most `page.tsx` files in the doctor, admin, and specialist routes are **self-contained mega-components** that combine:
- State management (useState, useEffect)
- Data fetching (direct Supabase calls via client.ts)
- Business logic (calculations, transformations)
- Full UI rendering (forms, tables, charts, dialogs)

**Worst offenders (lines):**
| File | Lines |
|------|-------|
| `(admin)/admin/website-editor/page.tsx` | 764 |
| `(admin)/admin/branding/page.tsx` | 649 |
| `(admin)/admin/settings/page.tsx` | 558 |
| `(doctor)/doctor/endocrinology/page.tsx` | 535 |
| `(doctor)/doctor/dashboard/page.tsx` | 531 |
| `(doctor)/doctor/orthopedics/page.tsx` | 510 |
| `(doctor)/doctor/cardiology/page.tsx` | 507 |
| `(super-admin)/super-admin/onboarding/page.tsx` | 504 |
| `(pharmacist)/pharmacist/dashboard/page.tsx` | 501 |
| `(equipment)/equipment/rentals/page.tsx` | 500 |
| `(equipment)/equipment/maintenance/page.tsx` | 500 |

**Why this is a problem:**
- No reusable logic - each page re-implements its own data fetching patterns
- Cannot unit test business logic separately from UI
- Violates single responsibility principle

**Recommendation:** Extract into:
- `hooks/` - Custom hooks for data fetching per domain
- Separate component files for complex UI sections
- Move business logic into domain-specific service files

### 3.2 Components making direct Supabase calls

8 components in `src/components/` import and call Supabase directly:
- `patient/appointment-list.tsx`
- `patient/reschedule-dialog.tsx`
- `patient/waiting-list-status.tsx`
- `custom-fields/custom-fields-form.tsx`
- `booking/payment-step.tsx`
- `booking/booking-form.tsx`
- `doctor/emergency-slot-creator.tsx`
- `chatbot/chatbot-provider.tsx`

These components mix UI presentation with data access, making them hard to test and reuse.

### 3.3 `src/lib/` is a flat dumping ground (45 files at root level)

The `lib/` directory has 45 `.ts` files directly at its root with no sub-organization:

```
lib/
├── api-auth.ts          # Auth for API routes
├── audit-log.ts         # Audit logging
├── auth-roles.ts        # Role definitions
├── auth.ts              # Auth helpers
├── backup.ts            # Database backup
├── chatbot-data.ts      # Chatbot logic
├── cmi.ts               # CMI payment gateway
├── cors.ts              # CORS config
├── cron-auth.ts         # Cron authentication
├── crypto-utils.ts      # Encryption
├── custom-domain.ts     # Custom domain logic
├── email.ts             # Email sending
├── env.ts               # Env var validation
├── escape-html.ts       # HTML sanitization
├── export-data.ts       # Data export
├── features.ts          # Feature flags
├── find-or-create-patient.ts  # Patient upsert
├── google-calendar.ts   # Google Calendar integration
├── i18n.ts              # Internationalization (469 lines)
├── invoice-generator.ts # Invoice PDF generation
├── json-ld.ts           # SEO structured data
├── logger.ts            # Logging
├── morocco.ts           # Morocco-specific logic (601 lines)
├── notification-persist.ts  # Notification persistence
├── notifications.ts     # Notification logic (518 lines)
├── prescription-pdf.ts  # Prescription PDF
├── r2-fallback.ts       # R2 storage fallback
├── r2.ts                # Cloudflare R2 storage
├── rate-limit.ts        # Rate limiting
├── responsive.ts        # Responsive utilities
├── section-visibility.ts # Section visibility
├── sms.ts               # SMS sending
├── subdomain.ts         # Subdomain extraction
├── subscription-billing.ts  # Billing logic (431 lines)
├── supabase-client.ts   # Browser Supabase client
├── supabase-server.ts   # Server Supabase client
├── super-admin-actions.ts   # Super admin actions (686 lines)
├── templates.ts         # Template definitions
├── tenant.ts            # Multi-tenant logic
├── timezone.ts          # Timezone handling
├── utils.ts             # General utilities
├── validations.ts       # Zod schemas
├── website-config.ts    # Website configuration
├── whatsapp.ts          # WhatsApp integration
├── with-auth.ts         # Auth wrapper for API routes
└── (+ subdirectories)
```

**Problems:**
- No grouping by concern (auth files scattered: `auth.ts`, `auth-roles.ts`, `api-auth.ts`, `cron-auth.ts`, `with-auth.ts`)
- Infrastructure mixed with domain logic (`morocco.ts` next to `cors.ts`)
- Country-specific logic (`morocco.ts` at 601 lines) at same level as tiny utilities (`escape-html.ts`)
- Communication channels scattered (`email.ts`, `sms.ts`, `whatsapp.ts`) instead of grouped

**Recommendation:**
```
lib/
├── auth/           # auth.ts, auth-roles.ts, api-auth.ts, cron-auth.ts, with-auth.ts
├── communication/  # email.ts, sms.ts, whatsapp.ts, notifications.ts
├── payments/       # cmi.ts, subscription-billing.ts, invoice-generator.ts
├── storage/        # r2.ts, r2-fallback.ts
├── tenant/         # tenant.ts, subdomain.ts, custom-domain.ts
├── morocco/        # morocco.ts (country-specific)
├── data/           # (already exists)
├── types/          # (already exists)
└── utils/          # utils.ts, escape-html.ts, timezone.ts, crypto-utils.ts
```

---

## 4. Domain Boundary Issues

### 4.1 Mismatched domain names between `app/` routes and `components/`

The route groups and component folders don't align consistently:

| Route Group | Has Matching Component Folder? |
|-------------|-------------------------------|
| `(doctor)` | Yes: `components/doctor/` |
| `(admin)` | Yes: `components/admin/` |
| `(patient)` | Yes: `components/patient/` |
| `(receptionist)` | Yes: `components/receptionist/` |
| `(super-admin)` | Yes: `components/super-admin/` |
| `(pharmacist)` | No matching folder |
| `(pharmacy-public)` | `components/pharmacy/` (naming mismatch) |
| `(dentist-public)` | `components/dental/` (naming mismatch) |
| `(radiology)` | No matching folder |
| `(nutritionist)` | No matching folder |
| `(optician)` | No matching folder |
| `(physiotherapist)` | No matching folder |
| `(psychologist)` | No matching folder |
| `(speech-therapist)` | No matching folder |
| `(equipment)` | No matching folder |
| `(parapharmacy)` | No matching folder |
| `(lab)` | `components/lab/` (partial match) |

**Extra component folders with no matching route:**
- `components/aesthetic/`
- `components/analytics/`
- `components/booking/`
- `components/chatbot/`
- `components/dental-lab/`
- `components/dialysis/`
- `components/installments/`
- `components/ivf/`
- `components/medical/`
- `components/morocco/`
- `components/para-medical/`
- `components/polyclinic/`

**Why this matters:** New developers can't intuit where to find or place code for a given domain.

### 4.2 The `(doctor)` route group is a catch-all (45 sub-routes!)

The doctor route group has become a dumping ground for every medical specialty:
```
(doctor)/doctor/
├── cardiology/
├── dermatology/
├── endocrinology/
├── ent/
├── neurology/
├── orthopedics/
├── psychiatry/
├── pulmonology/
├── rheumatology/
├── urology/
├── odontogram/          # dental
├── dialysis-sessions/   # dialysis
├── dialysis-machines/   # dialysis
├── ivf-cycles/          # IVF
├── ivf-protocols/       # IVF
├── pregnancies/         # OB/GYN
├── ultrasounds/         # imaging
├── vision-tests/        # ophthalmology
├── lab-orders/          # lab
├── lab-invoices/        # lab
├── lab-materials/        # lab
├── prosthetic-orders/   # dental lab
├── sterilization/       # dental
├── stock/               # inventory
├── treatment-packages/  # aesthetic
├── treatment-plans/     # dental
├── before-after/        # aesthetic
├── consultation-photos/ # aesthetic
├── consent-forms/       # aesthetic
├── growth-charts/       # pediatrics
├── child-info/          # pediatrics
├── vaccinations/        # pediatrics
├── iop-tracking/        # ophthalmology
└── ... (+ 12 more)
```

This is **45 pages under one route group** - many of which belong to completely different medical domains. A dentist doesn't need cardiology pages, and a cardiologist doesn't need odontogram.

### 4.3 No service/domain layer between pages and data

The architecture is effectively:

```
page.tsx (UI + logic) --> lib/data/client.ts (5K line monolith) --> Supabase
```

There's no intermediate domain/service layer. Business rules are scattered across page files.

---

## 5. Naming Conventions

### 5.1 Naming is mostly consistent (positive)

- **All files use kebab-case** (154 kebab-case files, 0 camelCase, 0 PascalCase, 0 snake_case) 
- **Components use `.tsx`**, utilities use `.ts`
- **Route groups use parenthesized kebab-case**: `(doctor)`, `(super-admin)`, `(pharmacy-public)`

### 5.2 Inconsistent domain naming across layers

The same concept has different names in different places:
- Route: `(dentist-public)` vs Component: `dental/` vs Lib type: `dental.ts`
- Route: `(pharmacy-public)` vs Component: `pharmacy/`
- Route: `(physiotherapist)` vs Component: `para-medical/`
- Route: `(speech-therapist)` vs Component: `para-medical/` (shared folder)

### 5.3 One non-standard file name

`devin read this/# Database Performance & Query Efficiency Audit` - This file has a `#` in its name, which is problematic for URLs and shell commands.

---

## 6. Overly Large Folders

| Folder | File Count | Issue |
|--------|-----------|-------|
| `src/app/(doctor)/doctor/` | 45 sub-routes | Way too many specialties under one role |
| `src/components/para-medical/` | 13 files | Mixes 4 different professions (optician, physio, speech, nutritionist) |
| `src/components/morocco/` | 11 files | Country-specific code at same level as core domain code |
| `src/components/dental/` | 8 files | Growing and will keep growing |
| `src/lib/` (flat) | 45 files | No sub-grouping for 45 files |

---

## 7. Confusing Structure Points

### 7.1 Two separate config locations
- `src/config/clinic.config.ts` and `src/config/theme.config.ts`
- `src/lib/config/pricing.ts` and `src/lib/config/clinic-types.ts`

Config is split between `src/config/` and `src/lib/config/` with no clear rationale.

### 7.2 `worker-cron-handler.ts` and `worker-env.d.ts` at root
These Cloudflare Worker files sit at the project root alongside Next.js config files, creating confusion about the project's runtime boundaries. They should be in a `workers/` directory.

### 7.3 `src/lib/hooks/` has only 3 hooks
There are only 3 custom hooks in `lib/hooks/`, yet pages contain dozens of inline `useEffect` + `useState` patterns that should be extracted as hooks.

### 7.4 `src/lib/data/index.ts` is intentionally empty
The barrel file for the data layer explicitly tells you NOT to import from it. While the comment explains why, an empty barrel file is confusing.

### 7.5 Tests are scattered
- `src/lib/__tests__/` - Unit tests for lib utilities (17 files)
- `src/app/api/__tests__/` - API route tests (2 files)
- `e2e/` - Playwright E2E tests (2 files)
- No component tests exist at all

---

## 8. Risk of Future Complexity

### 8.1 HIGH RISK: Adding new medical specialties
Every new specialty requires:
1. Add routes under `(doctor)/doctor/` (already 45 pages)
2. Add data functions to `client.ts` (already 5,114 lines)
3. Add specialist functions to `specialists.ts` (already 1,180 lines)
4. Add types to `database.ts` (already 10,694 lines)
5. Optionally add components to a new or existing folder

There's no template or pattern enforced - each specialty page is a standalone 400-500 line file that re-implements the same patterns.

### 8.2 HIGH RISK: Multi-tenant complexity
Tenant resolution spans: `middleware.ts` (426 lines) + `lib/tenant.ts` + `lib/subdomain.ts` + `lib/custom-domain.ts` + `components/tenant-provider.tsx`. This cross-cutting concern has no clear home.

### 8.3 MEDIUM RISK: Morocco-specific code will multiply
`src/lib/morocco.ts` (601 lines) and `src/components/morocco/` (11 files) suggest country-specific features. If the app expands to other countries, this pattern will lead to country-specific code scattered throughout.

### 8.4 MEDIUM RISK: No shared layout/component patterns
Each role's layout (`(doctor)/layout.tsx`, `(admin)/layout.tsx`, etc.) is independent. Adding a cross-role feature (like notifications, which already has `notification-bell.tsx` as a standalone component) requires touching every layout.

---

## 9. Summary of Recommendations

| Priority | Issue | Action |
|----------|-------|--------|
| P0 | `client.ts` is 5,114 lines | Split into domain-specific data modules |
| P0 | `server.ts` is 1,203 lines | Split into domain-specific server modules |
| P0 | Page files are 400-764 line monoliths | Extract hooks, sub-components, and service logic |
| P1 | `lib/` has 45 flat files | Group into sub-directories by concern |
| P1 | `(doctor)/` has 45 sub-routes | Group specialty routes or use feature flags |
| P1 | No domain/service layer | Add intermediate business logic layer |
| P2 | Mismatched domain naming | Standardize naming between routes and components |
| P2 | Config in two locations | Consolidate into one `config/` directory |
| P2 | Worker files at root | Move to `workers/` directory |
| P3 | Country-specific code pattern | Design a plugin/locale system before adding more countries |
| P3 | No component tests | Add test infrastructure for components |
