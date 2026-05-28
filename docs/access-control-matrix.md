# Access Control Matrix

> **Audience:** Security reviewers, platform operators, developers
> **Last updated:** May 2026
> **Source of truth:** `src/lib/middleware/routes.ts`, `src/middleware.ts`, `src/lib/with-auth.ts`

---

## 1. Role Hierarchy

```
super_admin > clinic_admin > receptionist > doctor > patient
```

Specialized clinical roles are equivalent in privilege to `doctor` within their own route prefix:

```
pharmacist, nutritionist, optician, parapharmacy, physiotherapist,
psychologist, radiology, speech_therapist, equipment, lab
```

---

## 2. Route Prefix Access

Each authenticated role is confined to its route prefix by middleware. Accessing another role's prefix redirects to the user's own dashboard.

| Role               | Route Prefix        | Dashboard                     | Fail Behavior                                               |
| ------------------ | ------------------- | ----------------------------- | ----------------------------------------------------------- |
| `super_admin`      | `/super-admin`      | `/super-admin/dashboard`      | Redirect to own dashboard                                   |
| `clinic_admin`     | `/admin`            | `/admin/dashboard`            | Redirect to own dashboard                                   |
| `receptionist`     | `/receptionist`     | `/receptionist/dashboard`     | Redirect to own dashboard                                   |
| `doctor`           | `/doctor`           | `/doctor/dashboard`           | Redirect to own dashboard                                   |
| `patient`          | `/patient`          | `/patient/dashboard`          | Redirect to own dashboard                                   |
| `pharmacist`       | `/pharmacist`       | `/pharmacist/dashboard`       | Redirect to own dashboard                                   |
| `nutritionist`     | `/nutritionist`     | `/nutritionist/dashboard`     | Redirect to own dashboard                                   |
| `optician`         | `/optician`         | `/optician/dashboard`         | Redirect to own dashboard                                   |
| `parapharmacy`     | `/parapharmacy`     | `/parapharmacy/dashboard`     | Redirect to own dashboard                                   |
| `physiotherapist`  | `/physiotherapist`  | `/physiotherapist/dashboard`  | Redirect to own dashboard                                   |
| `psychologist`     | `/psychologist`     | `/psychologist/dashboard`     | Redirect to own dashboard                                   |
| `radiology`        | `/radiology`        | `/radiology/dashboard`        | Redirect to own dashboard                                   |
| `speech_therapist` | `/speech-therapist` | `/speech-therapist/dashboard` | Redirect to own dashboard                                   |
| `equipment`        | `/equipment`        | `/equipment/dashboard`        | Redirect to own dashboard                                   |
| `lab`              | `/lab-panel`        | `/lab-panel/dashboard`        | Redirect to own dashboard                                   |
| **Unknown role**   | —                   | —                             | **Sign out + redirect to `/login?error=unauthorized_role`** |

---

## 3. API Route Protection

### Default Behavior

All `/api/*` routes are **protected by default** at the middleware level. Unauthenticated requests to non-public API routes receive `401 Unauthorized`.

### Public API Routes (No Auth Required)

These routes are explicitly allowlisted in `src/lib/middleware/routes.ts`:

| Route                        | Purpose                            | How It's Secured                                       |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `/api/health`                | Uptime monitoring                  | No secrets — returns health status                     |
| `/api/health/internal`       | Internal health check              | No secrets — returns extended health                   |
| `/api/booking`               | Public appointment booking         | HMAC booking token + rate limiting                     |
| `/api/booking/verify`        | Phone OTP verification for booking | Rate limiting + Turnstile                              |
| `/api/booking/cancel`        | Appointment cancellation           | Cancellation token (signed)                            |
| `/api/branding`              | Clinic branding data               | Public by design (branding is public)                  |
| `/api/webhooks`              | WhatsApp/provider webhooks         | HMAC-SHA256 signature verification                     |
| `/api/payments/webhook`      | Stripe webhooks                    | `stripe-signature` header verification                 |
| `/api/payments/cmi/callback` | CMI payment callbacks              | HMAC-SHA256 verification                               |
| `/api/cron/*`                | Scheduled cron jobs                | `CRON_SECRET` bearer token                             |
| `/api/verify-email`          | Email verification links           | Signed verification token                              |
| `/api/docs`                  | API documentation                  | Public reference                                       |
| `/api/checkin/lookup`        | Kiosk patient lookup               | Rate limiting                                          |
| `/api/checkin/confirm`       | Kiosk check-in confirmation        | Rate limiting                                          |
| `/api/checkin/status`        | Kiosk status display               | Rate limiting                                          |
| `/api/v1/register-clinic`    | Self-service clinic registration   | Rate limit (failClosed) + Turnstile + DNS verification |
| `/api/auth/demo-login`       | Demo login (dev/staging)           | Guarded in handler; blocked in production              |
| `/api/csp-report`            | CSP violation reports              | Rate limiting; no auth needed                          |

### Handler-Level RBAC (Defense in Depth)

Beyond middleware auth, each API handler uses `withAuth(handler, allowedRoles)` to enforce role-based access:

| API Route Pattern      | Allowed Roles                                 | Notes                                                     |
| ---------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `/api/admin/*`         | `super_admin`, `clinic_admin`                 | Clinic configuration, user management                     |
| `/api/doctor/*`        | `super_admin`, `clinic_admin`, `doctor`       | Medical records, prescriptions                            |
| `/api/receptionist/*`  | `super_admin`, `clinic_admin`, `receptionist` | Scheduling, patient intake                                |
| `/api/patient/*`       | All authenticated                             | Patients access own data; staff access within clinic      |
| `/api/v1/patients`     | API key auth (scope: `patients:read`)         | External API integration                                  |
| `/api/v1/appointments` | API key auth (scope: `appointments:read`)     | External API integration                                  |
| `/api/files/*`         | Role-based per operation                      | Upload: staff; Download: patient (own files), staff (all) |

---

## 4. Database-Level Access (RLS)

All 145+ tables have Row Level Security enabled. Key policy patterns:

| Policy Pattern               | Tables                                                | Rule                                                                                    |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Super admin full access**  | All                                                   | `sa_*_all` policies grant full CRUD                                                     |
| **Clinic admin full access** | Most                                                  | `admin_*_all` policies grant CRUD within `clinic_id`                                    |
| **Doctor read own**          | `appointments`, `consultation_notes`, `prescriptions` | Filter by `doctor_id` AND `clinic_id`                                                   |
| **Patient read own**         | `appointments`, `medical_records`, `documents`        | Filter by `patient_id` AND `clinic_id`                                                  |
| **Receptionist manage**      | `appointments`, `waiting_list`, `users` (patients)    | Filter by `clinic_id`                                                                   |
| **Tenant isolation**         | All tenant-scoped tables                              | Every policy includes `clinic_id = (SELECT clinic_id FROM users WHERE id = auth.uid())` |

### Cross-Tenant Isolation Guarantee

1. **Application layer:** `requireTenant()` derives `clinic_id` from subdomain — never from client input
2. **Database layer:** RLS policies filter by `clinic_id` matching the authenticated user's clinic
3. **Middleware layer:** Strips all incoming `x-clinic-id` and `x-tenant-*` headers
4. **Webhook layer:** Resolves `clinic_id` from provider payload (WABA phone ID, Stripe metadata)

---

## 5. API Key Access

External API keys (`clinic_api_keys` table) have:

| Property           | Enforcement                                                                             |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Scopes**         | `scopes` column (string array). Handler specifies `requiredScope` — key must include it |
| **Expiry**         | `expires_at` column. Expired keys are rejected even if `active = true`                  |
| **Prefix lookup**  | Keys are looked up by 8-char prefix, then timing-safe hash comparison                   |
| **Audit trail**    | `last_used_at` update + `logAuditEvent()` on every successful auth                      |
| **Tenant binding** | Key returns `clinic_id` — all queries scoped to that clinic                             |

---

## 6. Seed User Protection (3-Layer)

| Layer | Mechanism                                 | Where               |
| ----- | ----------------------------------------- | ------------------- |
| 1     | `ALLOW_SEED_USERS` env var must be `true` | Startup validation  |
| 2     | Seed user detection in auth flow          | Login handler       |
| 3     | Well-known password hash comparison       | Password validation |
