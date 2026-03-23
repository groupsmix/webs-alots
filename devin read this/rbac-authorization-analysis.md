# Authorization & Role-Based Access Control (RBAC) Analysis

> Analysis date: 2026-03-23
> Scope: `auth-roles.ts`, `with-auth.ts`, `middleware.ts` (role checks), all API routes, frontend route protection

---

## 1. Role Definitions

The system defines **5 user roles** via the `UserRole` type in `src/lib/types/database.ts`, stored in the `users.role` column:

| Role | Description |
|------|-------------|
| `super_admin` | Platform-wide administrator. Can access all routes, bypass tenant isolation, impersonate users. |
| `clinic_admin` | Administrator for a single clinic. Manages branding, settings, payments, staff. |
| `receptionist` | Front-desk staff. Manages bookings, patients, payments, notifications. |
| `doctor` | Clinical staff. Manages appointments, prescriptions, lab/radiology orders. |
| `patient` | End user / patient. Can view own appointments, notifications. |

### Role Constants (`src/lib/auth-roles.ts`)

```ts
export const STAFF_ROLES: UserRole[] = ["super_admin", "clinic_admin", "receptionist", "doctor"];
```

`STAFF_ROLES` is the most commonly used role group — it grants access to all staff but excludes `patient`.

One route file (`booking/payment/refund/route.ts`) defines a local constant:
```ts
const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];
```

The `branding/route.ts` file also defines its own local `ADMIN_ROLES` with the same values.

---

## 2. Authorization Mechanisms

### 2.1 `withAuth` Wrapper (`src/lib/with-auth.ts`)

The primary API route protection mechanism. Every call:

1. Creates a Supabase server client
2. Calls `supabase.auth.getUser()` to validate the session (NOT `getSession()` — tamper-proof)
3. Fetches the user's profile from the `users` table (role + clinic_id)
4. Checks the profile's role against the `allowedRoles` parameter:
   - **Specific roles array** (e.g., `["super_admin"]`) — only those roles can access
   - **`null`** — any authenticated user can access (no role restriction)

Returns 401 if not authenticated, 404 if no profile, 403 if role not allowed.

### 2.2 Middleware Role Enforcement (`src/middleware.ts`)

The Next.js middleware enforces **frontend route protection** based on URL prefixes:

```
ROLE_ROUTE_MAP:
  super_admin  → /super-admin/*
  clinic_admin → /admin/*
  receptionist → /receptionist/*
  doctor       → /doctor/*
  patient      → /patient/*
```

**How it works:**
- Protected route prefixes: `/patient`, `/doctor`, `/receptionist`, `/admin`, `/super-admin`
- If user is not authenticated → redirect to `/login`
- If authenticated, fetches user's role from DB
- **`super_admin` can access ALL protected routes** (explicit bypass at line 399)
- Other roles can only access their own prefix (e.g., `doctor` can only access `/doctor/*`)
- If a user tries to access a different role's prefix → redirected to their own dashboard

**Public routes** (no auth required): `/`, `/about`, `/services`, `/contact`, `/blog`, `/book`, `/reviews`, `/login`, `/register`, `/auth/callback`, `/how-to-book`, `/location`, `/pharmacy/*`

**Important:** The middleware treats ALL `/api/*` routes as "public" for middleware purposes (line 75: `pathname.startsWith("/api/")`). This means the middleware does NOT enforce role checks on API routes — that responsibility falls entirely on `withAuth` in each route handler.

### 2.3 API Key Authentication (`src/lib/api-auth.ts`)

Used exclusively by the V1 public REST API (`/api/v1/*`). Validates a Bearer token against SHA-256 hashed keys in `clinic_api_keys` table. No role concept — access is scoped to a `clinicId`.

### 2.4 Cron Secret Authentication (`src/lib/cron-auth.ts`)

Used by `/api/cron/*` routes. Validates `Authorization: Bearer <CRON_SECRET>` header using timing-safe comparison.

### 2.5 Webhook Signature Verification

- `/api/webhooks` — Meta/WhatsApp HMAC-SHA256 signature verification
- `/api/payments/webhook` — Stripe signature verification
- `/api/payments/cmi/callback` — CMI HMAC hash verification

### 2.6 Token-Based Verification (Booking)

`/api/booking` POST uses a custom `x-booking-token` header instead of session auth. This is for public patient booking without requiring login.

---

## 3. Complete API Route Role Matrix

### Legend
- **SA** = super_admin
- **CA** = clinic_admin
- **RE** = receptionist
- **DO** = doctor
- **PA** = patient
- **STAFF** = SA + CA + RE + DO (uses `STAFF_ROLES`)
- **ADMIN** = SA + CA (uses local `ADMIN_ROLES`)
- **ANY_AUTH** = Any authenticated user (`withAuth` with `null`)
- **PUBLIC** = No authentication required
- **API_KEY** = Authenticated via API key (V1 endpoints)
- **CRON** = Authenticated via `CRON_SECRET`
- **WEBHOOK** = Authenticated via webhook signature

| Endpoint | Method | Auth Mechanism | Allowed Roles |
|----------|--------|----------------|---------------|
| `/api/impersonate` | POST | `withAuth` | SA only |
| `/api/impersonate` | DELETE | `withAuth` | SA only |
| `/api/custom-fields` | GET | None | PUBLIC |
| `/api/custom-fields` | POST | `withAuth` | SA only |
| `/api/custom-fields` | PATCH | `withAuth` | SA only |
| `/api/custom-fields` | DELETE | `withAuth` | SA only |
| `/api/custom-fields/values` | GET | `withAuth` | STAFF |
| `/api/custom-fields/values` | POST | `withAuth` | STAFF |
| `/api/custom-fields/values` | PATCH | `withAuth` | STAFF |
| `/api/clinic-features` | GET | `withAuth` | ANY_AUTH |
| `/api/branding` | GET | None | PUBLIC |
| `/api/branding` | PUT | `withAuth` | ADMIN |
| `/api/branding` | POST | `withAuth` | ADMIN |
| `/api/onboarding` | POST | `withAuth` | ANY_AUTH |
| `/api/booking` | GET | None | PUBLIC |
| `/api/booking` | POST | Token (`x-booking-token`) | PUBLIC (token-verified) |
| `/api/booking/cancel` | POST | `withAuth` | ANY_AUTH |
| `/api/booking/cancel` | GET | `withAuth` | ANY_AUTH |
| `/api/booking/reschedule` | POST | `withAuth` | ANY_AUTH |
| `/api/booking/waiting-list` | POST | `withAuth` | ANY_AUTH |
| `/api/booking/waiting-list` | GET | `withAuth` | ANY_AUTH |
| `/api/booking/waiting-list` | DELETE | `withAuth` | ANY_AUTH |
| `/api/booking/recurring` | POST | `withAuth` | STAFF |
| `/api/booking/emergency-slot` | POST | `withAuth` | STAFF |
| `/api/booking/emergency-slot` | GET | `withAuth` | STAFF |
| `/api/booking/payment/initiate` | POST | `withAuth` | STAFF |
| `/api/booking/payment/confirm` | POST | `withAuth` | STAFF |
| `/api/booking/payment/refund` | POST | `withAuth` | ADMIN |
| `/api/upload` | POST | `withAuth` | SA, CA, RE, DO |
| `/api/upload` | PUT | `withAuth` | SA, CA, RE, DO |
| `/api/upload` | GET | `withAuth` | SA, CA, RE, DO |
| `/api/notifications` | POST | `withAuth` | STAFF |
| `/api/notifications` | GET | `withAuth` | STAFF |
| `/api/notifications/trigger` | POST | `withAuth` | STAFF |
| `/api/radiology/orders` | POST | `withAuth` | STAFF |
| `/api/radiology/orders` | PATCH | `withAuth` | STAFF |
| `/api/radiology/report-pdf` | POST | `withAuth` | STAFF |
| `/api/radiology/upload` | POST | `withAuth` | STAFF |
| `/api/lab/report-html` | POST | `withAuth` | STAFF |
| `/api/payments/cmi` | POST | `withAuth` | STAFF |
| `/api/payments/create-checkout` | POST | `withAuth` | STAFF |
| `/api/chat` | POST | Supabase auth (inline) | ANY_AUTH |
| `/api/health` | GET | None | PUBLIC |
| `/api/webhooks` | POST | Webhook signature | WEBHOOK (Meta) |
| `/api/webhooks` | GET | Verify token | PUBLIC (Meta verification) |
| `/api/payments/webhook` | POST | Webhook signature | WEBHOOK (Stripe) |
| `/api/payments/cmi/callback` | POST | CMI hash | WEBHOOK (CMI) |
| `/api/cron/billing` | GET | Cron secret | CRON |
| `/api/cron/reminders` | GET | Cron secret | CRON |
| `/api/v1/appointments` | GET | API key | API_KEY |
| `/api/v1/appointments` | POST | API key | API_KEY |
| `/api/v1/patients` | GET | API key | API_KEY |
| `/api/v1/patients` | POST | API key | API_KEY |

---

## 4. Frontend Route Protection Matrix

| URL Prefix | Required Role | Enforcement |
|------------|---------------|-------------|
| `/super-admin/*` | `super_admin` | Middleware redirect |
| `/admin/*` | `clinic_admin` | Middleware redirect |
| `/receptionist/*` | `receptionist` | Middleware redirect |
| `/doctor/*` | `doctor` | Middleware redirect |
| `/patient/*` | `patient` | Middleware redirect |
| `/` | None | Public |
| `/login`, `/register` | None (redirects if already logged in) | Middleware redirect to dashboard |
| `/book`, `/services`, `/contact`, etc. | None | Public |
| `/pharmacy/*` | None | Public |

**Note:** `super_admin` has an explicit bypass that allows access to ALL protected prefixes, not just `/super-admin/*`.

---

## 5. Role Access Summary

### super_admin
- **Frontend:** All protected routes (explicit bypass)
- **API:** Everything STAFF can do, plus:
  - Impersonate users (`/api/impersonate`)
  - Manage custom field definitions (CRUD on `/api/custom-fields`)
  - Bypass tenant isolation in notifications (can send to any clinic's users)
  - Upload files with arbitrary `clinicId` (falls back to "shared")

### clinic_admin
- **Frontend:** `/admin/*` only
- **API:** Everything STAFF can do, plus:
  - Update branding (PUT/POST on `/api/branding`)
  - Refund payments (`/api/booking/payment/refund`)

### receptionist
- **Frontend:** `/receptionist/*` only
- **API:** All STAFF endpoints (bookings, payments, notifications, radiology, lab, uploads)
- **Cannot:** Update branding, refund payments, manage custom field definitions, impersonate

### doctor
- **Frontend:** `/doctor/*` only
- **API:** All STAFF endpoints (same as receptionist)
- **Cannot:** Same restrictions as receptionist

### patient
- **Frontend:** `/patient/*` only
- **API (via withAuth):**
  - View clinic features (`/api/clinic-features`)
  - Cancel bookings (`/api/booking/cancel`)
  - Reschedule bookings (`/api/booking/reschedule`)
  - Manage waiting list (`/api/booking/waiting-list`)
  - Use chatbot (`/api/chat`)
  - Onboard (`/api/onboarding`)
- **Cannot:** Access any STAFF, ADMIN, or SA-only endpoints

---

## 6. Findings: Weak or Missing Protections

### 6.1 Endpoints Using `null` (ANY_AUTH) — No Role Restriction

These endpoints allow any authenticated user (including `patient`) to access them. This is intentional in some cases but worth noting:

| Endpoint | Methods | Concern |
|----------|---------|---------|
| `/api/booking/cancel` | POST, GET | A patient can cancel — intentional. But any authenticated user can cancel ANY appointment by ID (no ownership check beyond clinic_id in the query). |
| `/api/booking/reschedule` | POST | Same concern — any authenticated user can reschedule any appointment. No check that the requester owns the appointment. |
| `/api/booking/waiting-list` | POST, GET, DELETE | Any authenticated user can manage waiting list entries. No ownership enforcement. |
| `/api/clinic-features` | GET | Low risk — read-only clinic config. |
| `/api/onboarding` | POST | Intentionally `null` — new users don't have a role yet. Has its own internal guards (checks for existing profile, email verification). Comment in code confirms this is deliberate. |

### 6.2 Fully Public Endpoints (No Auth At All)

| Endpoint | Method | Concern |
|----------|--------|---------|
| `/api/booking` | GET | Returns available time slots for a doctor on a date. Public by design (for the booking page). Exposes doctor availability but no PII. |
| `/api/branding` | GET | Returns clinic branding (colors, logo URLs). Public by design. Low risk. |
| `/api/custom-fields` | GET | Returns custom field definitions for a clinic type. Public. No sensitive data. |
| `/api/health` | GET | Health check. Public by design. Exposes DB latency but no sensitive data. |

### 6.3 Inconsistent Role Definitions

**Upload endpoint uses inline role array instead of `STAFF_ROLES`:**
- `/api/upload` (POST, PUT, GET) uses `["super_admin", "clinic_admin", "receptionist", "doctor"]`
- This is identical to `STAFF_ROLES` but defined inline. If `STAFF_ROLES` is ever updated (e.g., a new staff role is added), these upload routes would not pick up the change.

**Payment refund uses local `ADMIN_ROLES` instead of importing from a shared location:**
- `/api/booking/payment/refund` defines `const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"]` locally.
- `/api/branding` also defines its own `const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"]` locally.
- These are identical but not shared. If the definition needs to change, both files must be updated independently.

### 6.4 Missing Ownership/Tenant Checks in `null`-Role Endpoints

Several endpoints use `withAuth(handler, null)` which means any authenticated user can access them, but they don't always verify that the requesting user owns or is associated with the resource being acted upon:

1. **`/api/booking/cancel` POST** — Cancels an appointment by `appointmentId`. Filters by `clinic_id` (from config, not user's profile) but does NOT verify that the requesting user is the patient who booked or a staff member of the clinic. A patient from Clinic A could potentially cancel appointments in Clinic B if `clinicConfig.clinicId` matches.

2. **`/api/booking/reschedule` POST** — Same pattern. Reschedules by `appointmentId` with clinic_id filter from config, no user-ownership check.

3. **`/api/booking/waiting-list` DELETE** — Deletes a waiting list entry by `id`. Filters by `clinic_id` from config but no ownership check on who created the entry.

### 6.5 Notification Tenant Isolation

The notifications endpoints (`/api/notifications` POST, `/api/notifications/trigger` POST) implement proper tenant isolation:
- Non-`super_admin` users can only send notifications to recipients within their own clinic
- `super_admin` bypasses this check

The GET endpoint (`/api/notifications` GET) also properly scopes: non-staff users can only read their own notifications; staff can read by `userId`.

### 6.6 Chat Endpoint Auth Pattern

`/api/chat` does NOT use `withAuth`. Instead it manually calls `supabase.auth.getUser()` inline. This means:
- It verifies authentication but does NOT check role or profile
- It does NOT fetch the user's profile — so no role-based restrictions
- Any authenticated user (any role) can use the chatbot
- Comment in code says this is intentional (SEC-01 fix)

---

## 7. Suspicious Endpoints

### 7.1 `/api/booking` GET — Completely Unauthenticated

```ts
export async function GET(request: NextRequest) {
  // No auth check at all
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");
  // Returns booked slots for a doctor on a date
}
```

This is a plain `export async function` — not wrapped in `withAuth`. Any anonymous user can query doctor availability. This appears intentional for the public booking page, but it does expose which time slots are booked for any doctor.

### 7.2 `/api/custom-fields` GET — Completely Unauthenticated

```ts
export async function GET(request: NextRequest) {
  // No auth — returns custom field definitions
}
```

Also a plain function, not `withAuth`. Returns field definitions (metadata about form fields). Low sensitivity but inconsistent — the write operations (POST/PATCH/DELETE) on the same route require `super_admin`.

### 7.3 `/api/branding` GET — Completely Unauthenticated

Same pattern — plain function, no auth. Returns clinic branding. Low risk, intentional for public-facing pages.

### 7.4 `/api/chat` POST — Auth Without Profile/Role Check

Uses `supabase.auth.getUser()` directly instead of `withAuth`. This means there's no profile lookup, no role check, and no `clinic_id` scoping from the user's profile. The clinic context comes from the tenant header or request body, which could potentially allow a user authenticated under one clinic to query another clinic's chatbot context.

### 7.5 Booking Token System — No Rate Limit on Token Issuance

The `/api/booking` POST requires an `x-booking-token` header, but the token verification endpoint (POST `/api/booking/verify` — referenced in error messages but not present in the current API routes) is not visible in the codebase. The booking POST itself is a plain `export async function` without `withAuth`.

---

## 8. Auth Flow Consistency Analysis

### Pattern Distribution

| Auth Pattern | Count | Endpoints |
|--------------|-------|-----------|
| `withAuth(handler, STAFF_ROLES)` | 18 methods | Majority of management endpoints |
| `withAuth(handler, ["super_admin"])` | 5 methods | Impersonate, custom-field definitions |
| `withAuth(handler, ADMIN_ROLES)` | 4 methods | Branding write, payment refund |
| `withAuth(handler, null)` | 8 methods | Booking cancel/reschedule/waiting-list, clinic-features, onboarding |
| `withAuth(handler, [...inline...])` | 3 methods | Upload (identical to STAFF_ROLES) |
| Plain `export async function` (no auth) | 7 methods | booking GET, branding GET, custom-fields GET, health GET, chat POST, webhooks |
| API key (`authenticateApiKey`) | 4 methods | V1 endpoints |
| Cron secret (`verifyCronSecret`) | 2 methods | Cron endpoints |
| Webhook signature | 3 methods | Webhooks, payment callbacks |

### Consistency Observations

1. **Staff endpoints are consistently protected** — All clinic management, medical (radiology, lab), payment, and notification endpoints correctly use `STAFF_ROLES` or more restrictive role lists.

2. **Admin-only operations are correctly restricted** — Branding updates and payment refunds require `ADMIN_ROLES` (SA + CA only). Custom field definitions require `super_admin` only.

3. **Patient-facing endpoints use `null` appropriately in most cases** — Booking cancel, reschedule, and waiting list are accessible to any authenticated user. This allows patients to manage their own bookings. However, ownership verification is missing (see section 6.4).

4. **Public endpoints follow a clear pattern** — Read-only, non-sensitive data (branding, availability, health check, custom field definitions) are correctly left public.

5. **Webhook/cron endpoints use appropriate non-session auth** — Signature verification for webhooks, shared secret for cron. These are correctly exempt from CSRF protection in middleware.

6. **The `withAuth` wrapper is the single source of truth for API auth** — All authenticated API routes funnel through it, ensuring consistent session validation and role checking. The only exception is `/api/chat` which does inline auth.

---

## 9. Summary

### What Works Well
- Clear role hierarchy with `STAFF_ROLES` constant for DRY role definitions
- `withAuth` wrapper provides consistent auth + role enforcement across all protected API routes
- Middleware enforces frontend route isolation per role
- `super_admin` has explicit bypass in middleware and tenant isolation checks
- Webhook and cron endpoints use appropriate signature/secret verification
- Profile is always fetched from DB (not trusted from JWT/cookies)

### Areas to Note
- **6 endpoints** use `withAuth(handler, null)` — any authenticated user including patients can access them, with no ownership verification on the resources being acted upon
- **3 upload methods** define roles inline instead of using `STAFF_ROLES` — functionally identical but not DRY
- **2 files** define local `ADMIN_ROLES` independently — same values, not shared
- **`/api/chat`** uses inline auth instead of `withAuth` — skips profile/role checking
- **`/api/booking` GET, `/api/custom-fields` GET, `/api/branding` GET** are fully public — intentional but worth documenting
- **No ownership checks** on booking cancel/reschedule/waiting-list — any authenticated user can act on any resource by ID within the clinic
