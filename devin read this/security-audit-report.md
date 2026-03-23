# Deep Security Audit Report — Authentication & Authorization

**Scope:** All auth-related files, API routes, middleware, impersonation, cron auth, API key auth, webhooks  
**Methodology:** Static code analysis with attacker mindset — tracing trust boundaries, identifying bypass vectors, simulating attack chains  
**Date:** March 2026

---

## Executive Summary

The application implements a generally solid security architecture with server-side role enforcement, HMAC-based token verification, timing-safe comparisons, and defense-in-depth patterns. However, **several medium-to-high severity vulnerabilities exist** that could be exploited by authenticated attackers to escalate privileges, access cross-tenant data, or bypass authorization controls.

The most critical finding is that **multiple booking endpoints use `withAuth(handler, null)`**, meaning any authenticated user (including patients) can perform staff-only actions like cancelling other patients' appointments, adding entries to waiting lists, or rescheduling appointments — actions that should be restricted to staff roles.

---

## Severity Rating System

| Severity | Definition |
|----------|-----------|
| **CRITICAL** | Immediate exploitation possible, full system compromise or data breach |
| **HIGH** | Exploitable with moderate effort, significant data exposure or privilege escalation |
| **MEDIUM** | Requires specific conditions, limited impact or partial bypass |
| **LOW** | Theoretical risk, minimal impact, or requires insider access |
| **INFO** | Security hardening opportunity, no direct exploit |

---

## Finding 1: Booking Endpoints Allow Any Authenticated User to Perform Staff Actions

**Severity: HIGH**  
**Files:**
- `src/app/api/booking/cancel/route.ts` (lines 113, 165)
- `src/app/api/booking/reschedule/route.ts` (line 132)
- `src/app/api/booking/waiting-list/route.ts` (lines 72, 118, 158)

**Vulnerability:**  
The `POST /api/booking/cancel`, `GET /api/booking/cancel`, `POST /api/booking/reschedule`, and all methods on `/api/booking/waiting-list` use `withAuth(handler, null)`. The `null` parameter means **any authenticated user is allowed** — no role restriction is enforced. A patient can:

- Cancel any other patient's appointment (by guessing/enumerating appointment IDs)
- Reschedule any appointment in the clinic
- Add/remove entries from the waiting list
- Query any patient's waiting list entries

**Attack Scenario:**
```
1. Attacker registers as a patient (role: "patient")
2. Attacker calls POST /api/booking/cancel with:
   { "appointmentId": "<target-appointment-uuid>" }
3. The endpoint only checks that the appointment belongs to clinicConfig.clinicId
4. There is NO check that the authenticated user owns the appointment
5. The appointment is cancelled — the legitimate patient's booking is destroyed
```

**Impact:** Any authenticated patient can disrupt clinic operations by mass-cancelling or rescheduling other patients' appointments. This is a real-world griefing/denial-of-service vector against healthcare operations.

**Root Cause:** The `withAuth(handler, null)` pattern bypasses role enforcement. The handlers also lack ownership checks — they do not verify that the authenticated user is the patient who owns the appointment.

---

## Finding 2: Missing Ownership Checks on Appointment Operations

**Severity: HIGH**  
**Files:**
- `src/app/api/booking/cancel/route.ts` (line 30-31)
- `src/app/api/booking/reschedule/route.ts` (line 53-54)

**Vulnerability:**  
Even if role restrictions were added, the cancel and reschedule endpoints only filter appointments by `appointmentId` and `clinicConfig.clinicId`. They never check whether the authenticated user is the patient who owns the appointment, or a staff member authorized to manage it.

**Attack Scenario:**
```
1. Patient A is authenticated
2. Patient A discovers Patient B's appointment ID (via waiting list query, 
   booking confirmation leak, or UUID enumeration)
3. Patient A calls POST /api/booking/cancel with Patient B's appointment ID
4. The endpoint verifies:
   ✅ appointment exists
   ✅ appointment belongs to this clinic
   ❌ NEVER checks if Patient A owns the appointment
5. Patient B's appointment is cancelled
```

**Impact:** Horizontal privilege escalation — one patient can act on another patient's appointments.

---

## Finding 3: Custom Field Values Endpoint — Cross-Tenant Data Access

**Severity: HIGH**  
**Files:**
- `src/app/api/custom-fields/values/route.ts` (lines 15-47, 54-135, 142-235)

**Vulnerability:**  
The `GET /api/custom-fields/values` and `POST /api/custom-fields/values` endpoints accept `clinic_id` as a query parameter (GET) or request body field (POST). They are protected by `withAuth(handler, STAFF_ROLES)`, but **they do not verify that the authenticated user's `profile.clinic_id` matches the requested `clinic_id`**.

A staff member from Clinic A can read and write custom field values belonging to Clinic B by simply supplying Clinic B's UUID.

**Attack Scenario:**
```
1. Receptionist at Clinic A authenticates (role: "receptionist", clinic_id: "clinic-a")
2. Receptionist calls GET /api/custom-fields/values?clinic_id=clinic-b&entity_type=patient&entity_id=<uuid>
3. The endpoint checks:
   ✅ User is authenticated
   ✅ User has STAFF_ROLES role
   ❌ NEVER checks if user belongs to clinic-b
4. Custom field values from Clinic B are returned — including potentially sensitive patient data
```

**Impact:** Multi-tenant data breach. Any staff member can access or modify custom field data across all clinics in the system.

---

## Finding 4: Custom Fields GET Endpoint — Unauthenticated Access

**Severity: MEDIUM**  
**File:** `src/app/api/custom-fields/route.ts` (lines 15-57)

**Vulnerability:**  
The `GET /api/custom-fields` endpoint is a plain `export async function GET()` — it does NOT use `withAuth`. Anyone can enumerate custom field definitions (schema metadata) for any clinic type without authentication.

While field definitions are less sensitive than field values, they leak the internal data model (field keys, types, validation rules) that an attacker can use to craft targeted attacks against the custom-fields/values endpoint.

**Impact:** Information disclosure — unauthenticated users can discover the data schema of any clinic type.

---

## Finding 5: Branding GET Endpoint — Unauthenticated Information Disclosure

**Severity: LOW**  
**File:** `src/app/api/branding/route.ts` (lines 60-107)

**Vulnerability:**  
The `GET /api/branding` endpoint is not wrapped with `withAuth`. It returns clinic branding data including `name`, `phone`, `address`, logo URLs, etc. While branding is semi-public data, the phone number and address exposure may not be intended for unauthenticated access.

**Impact:** Minor information disclosure. May be intentional for public-facing clinic pages.

---

## Finding 6: Health Endpoint Leaks Database Latency Metrics

**Severity: LOW**  
**File:** `src/app/api/health/route.ts` (lines 13-48)

**Vulnerability:**  
The `GET /api/health` endpoint is unauthenticated and returns database connectivity status and latency in milliseconds. This gives attackers:
- Confirmation that the database is reachable
- Latency metrics useful for timing attacks
- Database health status for monitoring when to attack

**Impact:** Reconnaissance aid for attackers. Standard practice is to either protect health endpoints or return minimal information.

---

## Finding 7: Booking Token Dev-Bypass in Development Mode

**Severity: MEDIUM (conditional)**  
**File:** `src/app/api/booking/route.ts` (lines 47-53)

**Vulnerability:**  
When `BOOKING_TOKEN_SECRET` is not set AND `NODE_ENV === "development"`, the token `"dev-bypass"` is accepted as valid. If a production deployment accidentally runs with `NODE_ENV=development` or without `BOOKING_TOKEN_SECRET`, **any unauthenticated user can create unlimited bookings** by sending `x-booking-token: dev-bypass`.

```typescript
if (!secret) {
  if (process.env.NODE_ENV === "development") return token === "dev-bypass";
  return false;
}
```

**Attack Scenario:**
```
1. Production server misconfigured with NODE_ENV=development (common in staging)
2. Attacker sends POST /api/booking with header: x-booking-token: dev-bypass
3. Token verification passes — unlimited fake bookings
4. Clinic's schedule is flooded with spam appointments
```

**Impact:** If misconfigured, complete bypass of booking verification. The booking endpoint creates real patient records and appointments without any OTP verification.

---

## Finding 8: Lab/Radiology Report Endpoints — No Tenant Isolation

**Severity: HIGH**  
**Files:**
- `src/app/api/lab/report-html/route.ts` (line 125)
- `src/app/api/radiology/report-pdf/route.ts` (line 76)
- `src/app/api/radiology/orders/route.ts` (line 28)

**Vulnerability:**  
The lab report and radiology endpoints accept `clinicId` from the request body and use it directly without verifying it matches the authenticated user's `profile.clinic_id`. A doctor or staff member at Clinic A can:

1. Generate lab reports for Clinic B by passing Clinic B's UUID
2. Create radiology orders in Clinic B's context
3. Upload radiology images to Clinic B's storage path

The `radiology/upload/route.ts` was fixed (MED-03) to derive `clinicId` from `profile.clinic_id`, but the other routes in the same domain were not fixed.

**Attack Scenario:**
```
1. Doctor at Clinic A authenticates
2. Doctor calls POST /api/lab/report-html with:
   { "orderId": "...", "clinicId": "clinic-b-uuid", "patientName": "...", ... }
3. Report is generated and stored under Clinic B's storage path
4. Doctor can create fake lab reports attributed to Clinic B
```

**Impact:** Cross-tenant data manipulation. Fake medical reports can be created under another clinic's identity — a serious healthcare compliance violation.

---

## Finding 9: Notification Endpoints — Partial Tenant Isolation Bypass for Null clinic_id

**Severity: MEDIUM**  
**Files:**
- `src/app/api/notifications/route.ts` (lines 39-51)
- `src/app/api/notifications/trigger/route.ts` (lines 55-75)

**Vulnerability:**  
The tenant isolation check in both notification endpoints has a subtle bypass:

```typescript
if (profile.role !== "super_admin" && profile.clinic_id) {
  // ... check recipient belongs to same clinic
}
```

If a staff user somehow has `clinic_id = null` (possible during onboarding race conditions or database inconsistencies), the tenant isolation check is **skipped entirely** because `profile.clinic_id` is falsy. This user could send notifications to any user across all tenants.

**Impact:** Conditional cross-tenant notification abuse. Requires a user with a staff role but null clinic_id.

---

## Finding 10: CSRF Exemption on V1 API Routes

**Severity: MEDIUM**  
**File:** `src/middleware.ts` (lines 30-36, 187-248)

**Vulnerability:**  
The V1 API routes (`/api/v1/patients`, `/api/v1/appointments`) are protected by API key authentication, not cookie-based session auth. However, the CSRF protection only exempts specific webhook/cron prefixes — V1 routes are NOT exempt.

This creates an inconsistency: V1 POST requests from external integrations will be **blocked by CSRF validation** unless they include a valid Origin header matching the allowlist. This isn't a vulnerability per se, but it means:

1. External API consumers must set an Origin header that matches the site's domain
2. If `ALLOWED_API_ORIGINS` is set to `*`, the CORS layer allows any origin, but the middleware CSRF check may still reject mutations without a proper Origin

The real risk: if CSRF is relaxed to fix V1 integration issues, cookie-authenticated endpoints could be exposed.

**Impact:** V1 API usability issue that may lead to insecure CSRF relaxation.

---

## Finding 11: Impersonation Cookie Not Scoped to Super-Admin Routes

**Severity: MEDIUM**  
**File:** `src/app/api/impersonate/route.ts` (lines 59-65)

**Vulnerability:**  
The impersonation cookie `sa_impersonate_clinic_id` is set with `path: "/"`, meaning it's sent on every request to the application. If any non-admin endpoint reads this cookie to determine clinic context, a non-super-admin user who manages to set this cookie (e.g., via a separate XSS vulnerability) could impersonate any clinic.

The impersonation endpoint itself is properly protected by `withAuth(handler, ["super_admin"])`. The risk is in how the cookie is consumed downstream.

**Where the cookie is read matters:** If admin dashboard components blindly trust this cookie to switch clinic context without re-verifying the user's super_admin role, the impersonation can be abused.

**Attack Scenario:**
```
1. Attacker finds XSS vulnerability on any page
2. XSS sets cookie: document.cookie = "sa_impersonate_clinic_id=target-clinic-uuid"
   → This FAILS because the cookie is httpOnly ✅
3. Alternative: Attacker uses a non-httpOnly cookie injection technique (CRLF injection
   in a response header) to set the cookie
4. If admin dashboard reads the cookie without re-verifying super_admin role,
   attacker gains clinic context switch
```

**Mitigation:** The httpOnly flag prevents direct JavaScript access. The primary risk is if the cookie value is consumed by server-side code that doesn't re-verify the super_admin role.

---

## Finding 12: Booking Endpoint Race Condition Window

**Severity: LOW**  
**File:** `src/app/api/booking/route.ts` (lines 309-339)

**Vulnerability:**  
The booking endpoint has a TOCTOU (Time-of-Check-Time-of-Use) mitigation for the maxPerSlot limit: it inserts the appointment first, then checks if the slot count exceeds the maximum. If it does, it rolls back.

However, there's a small window where the "rollback" (delete) could fail, leaving an extra appointment in a slot. The code doesn't handle the case where the delete operation fails:

```typescript
await supabase
  .from("appointments")
  .delete()
  .eq("id", appointment.id);
// No error handling on the delete
```

**Impact:** Minor — could result in one extra booking per slot in rare race conditions with database errors.

---

## Finding 13: Chat Endpoint Clinic Resolution from Client-Controlled Header

**Severity: MEDIUM**  
**File:** `src/app/api/chat/route.ts` (lines 76-83)

**Vulnerability:**  
The chat endpoint resolves the clinic context from either:
1. `x-tenant-clinic-id` header (set by middleware from subdomain resolution)
2. `clinicId` in the request body (client-supplied fallback)

```typescript
const tenantClinicId = request.headers.get(TENANT_HEADERS.clinicId);
const clinicId = tenantClinicId || body.clinicId;
```

An attacker can bypass subdomain-based tenant resolution by directly supplying `clinicId` in the request body. This lets them query the chatbot context of any clinic — potentially exposing that clinic's FAQ data, doctor information, service details, and chatbot configuration.

**Attack Scenario:**
```
1. Attacker authenticates on clinic-a.example.com
2. Attacker sends POST /api/chat with body: { clinicId: "clinic-b-uuid", messages: [...] }
3. The middleware sets x-tenant-clinic-id to clinic-a's ID
4. But if the middleware doesn't set the header (e.g., no subdomain), 
   the body.clinicId is used instead
5. Chatbot responds with Clinic B's context data (doctors, services, hours, FAQs)
```

**Impact:** Information disclosure — an attacker can probe any clinic's chatbot data. Not a full data breach, but leaks business information.

---

## Finding 14: Webhook Signature Verification — No Replay Protection on Meta Webhooks

**Severity: LOW**  
**File:** `src/app/api/webhooks/route.ts` (lines 16-30)

**Vulnerability:**  
The Meta/WhatsApp webhook verification uses HMAC-SHA256 but does **not include timestamp validation**. Unlike the Stripe webhook handler (which has a 5-minute timestamp tolerance), the Meta webhook handler will accept replayed payloads indefinitely.

Compare:
- **Stripe** (secure): Checks `Math.abs(now - parseInt(timestamp, 10)) > 300` ✅
- **Meta** (no replay protection): Only checks HMAC signature ❌

**Attack Scenario:**
```
1. Attacker captures a valid Meta webhook payload (e.g., via network sniffing or log leak)
2. Attacker replays the exact same payload days later
3. The HMAC signature is still valid (no timestamp check)
4. The webhook handler re-processes the action (e.g., confirming or cancelling an appointment)
```

**Impact:** Low because capturing the original webhook payload requires network-level access or log access. But if obtained, unlimited replay is possible.

---

## Finding 15: V1 API Routes — No Scoping of Patient/Appointment to API Key's Clinic

**Severity: INFO (properly handled)**  
**Files:**
- `src/app/api/v1/patients/route.ts` (line 41)
- `src/app/api/v1/appointments/route.ts` (line 42)

**Assessment:**  
The V1 API routes properly scope queries to `auth.clinicId` which comes from the API key authentication. This is correct — each API key is bound to a specific clinic, and all queries are filtered by that clinic ID.

**No vulnerability here.** This is noted as a positive security control.

---

## Trust Boundary Analysis

### Client → Server Trust Boundaries

| Data Source | Trusted? | Enforcement |
|------------|----------|-------------|
| Supabase JWT (via cookies) | ✅ Server-validated | `supabase.auth.getUser()` validates with Supabase servers, not just JWT decode |
| User role | ✅ Server-validated | Always fetched from DB via `users` table, never from JWT claims |
| Origin header (CSRF) | ✅ Server-validated | Checked against allowlist of configured origins |
| `clinicId` in request body | ❌ **Client-controlled** | Some endpoints trust this without checking against `profile.clinic_id` |
| `clinic_id` in custom-fields | ❌ **Client-controlled** | Passed through to DB queries without tenant verification |
| `x-booking-token` header | ✅ Server-validated | HMAC-SHA256 verification with constant-time comparison |
| `x-tenant-clinic-id` header | ⚠️ Mixed | Set by middleware (trusted), but body fallback is client-controlled |
| API key (Bearer token) | ✅ Server-validated | SHA-256 hash comparison with timing-safe equal |
| `Content-Length` header | ✅ Server-validated | 25 MB body size limit enforced in middleware |
| Webhook signatures | ✅ Server-validated | HMAC verification with timing-safe comparison |
| File upload MIME type | ✅ Server-validated | Magic byte validation after upload |
| Form field `clinicId` (uploads) | ✅ Mostly fixed | Upload and radiology use `profile.clinic_id`, but lab reports still trust body |

### Server-Side Enforcement Summary

| Control | Status |
|---------|--------|
| Authentication (identity verification) | ✅ Strong — uses `getUser()` not `getSession()` |
| Role-based access control | ⚠️ Partial — some endpoints use `null` roles |
| Tenant isolation (clinic scoping) | ❌ Inconsistent — several endpoints trust client-supplied clinic IDs |
| Ownership verification (user owns resource) | ❌ Missing — no checks that a patient owns their own appointment |
| CSRF protection | ✅ Good — Origin-based validation with strict allowlist |
| Rate limiting | ✅ Good — applied to all API routes including GET |
| Input validation | ✅ Good — Zod schemas on most endpoints |
| Cryptographic controls | ✅ Strong — HMAC-SHA256, timing-safe comparisons |

---

## Attack Simulation Summary

### Simulation 1: Patient Cancels Other Patients' Appointments
**Result: EXPLOITABLE ❌**  
Any authenticated patient can cancel any appointment in their clinic by calling `POST /api/booking/cancel` with a guessed appointment ID. No role check, no ownership check.

### Simulation 2: Role Escalation via Onboarding
**Result: BLOCKED ✅**  
The onboarding endpoint checks for existing profiles and prevents users with existing roles from creating clinics or escalating to clinic_admin. Email verification is also required.

### Simulation 3: Cross-Tenant Custom Field Access
**Result: EXPLOITABLE ❌**  
A staff member from Clinic A can read/write custom field values for Clinic B by passing `clinic_id=clinic-b-uuid` in the request.

### Simulation 4: Impersonation Abuse by Non-Super-Admin
**Result: BLOCKED ✅**  
The impersonation endpoint is properly protected by `withAuth(handler, ["super_admin"])`. The cookie is httpOnly and SameSite=strict. A non-super-admin cannot set or exploit this cookie.

### Simulation 5: Unauthenticated API Access
**Result: BLOCKED ✅**  
All authenticated endpoints correctly return 401 when no session cookie is present. The `withAuth` wrapper reliably enforces authentication.

### Simulation 6: Booking Without OTP Verification
**Result: BLOCKED ✅ (in production)**  
The booking token verification correctly rejects requests without valid HMAC tokens. The dev-bypass only works when `NODE_ENV=development` AND `BOOKING_TOKEN_SECRET` is not set.

### Simulation 7: Cross-Tenant Lab Report Generation
**Result: EXPLOITABLE ❌**  
A doctor at Clinic A can generate lab reports attributed to Clinic B by passing `clinicId: "clinic-b-uuid"` in the request body.

### Simulation 8: CRON Endpoint Access
**Result: BLOCKED ✅**  
Both cron endpoints correctly verify the `CRON_SECRET` bearer token with timing-safe comparison. Without the secret, requests are rejected with 401.

### Simulation 9: Webhook Replay Attack
**Result: PARTIALLY EXPLOITABLE ⚠️**  
Stripe webhooks are protected against replay (5-minute timestamp tolerance). Meta webhooks are not — valid payloads can be replayed indefinitely.

### Simulation 10: Forging Super-Admin Role via Database
**Result: BLOCKED ✅**  
Roles are always fetched from the `users` table via `auth_id` lookup. An attacker cannot modify JWT claims to escalate roles — the server always queries the database for the real role.

---

## Vulnerability Summary Table

| ID | Finding | Severity | Exploitable? |
|----|---------|----------|-------------|
| SEC-A01 | Booking cancel/reschedule/waitlist open to any authenticated user | **HIGH** | Yes |
| SEC-A02 | No ownership check on appointment operations | **HIGH** | Yes |
| SEC-A03 | Custom field values — cross-tenant data access | **HIGH** | Yes |
| SEC-A04 | Lab/Radiology reports — cross-tenant generation | **HIGH** | Yes |
| SEC-A05 | Booking token dev-bypass misconfiguration risk | **MEDIUM** | Conditional |
| SEC-A06 | Chat endpoint clinic resolution from client body | **MEDIUM** | Yes |
| SEC-A07 | Notification tenant check bypassed when clinic_id is null | **MEDIUM** | Conditional |
| SEC-A08 | CSRF/CORS tension on V1 API routes | **MEDIUM** | No (usability) |
| SEC-A09 | Impersonation cookie path scope too broad | **MEDIUM** | Requires chained exploit |
| SEC-A10 | Custom fields GET — unauthenticated schema access | **MEDIUM** | Yes |
| SEC-A11 | Meta webhook — no replay protection | **LOW** | Requires network access |
| SEC-A12 | Health endpoint leaks DB metrics | **LOW** | Reconnaissance only |
| SEC-A13 | Booking race condition rollback failure | **LOW** | Rare edge case |
| SEC-A14 | Branding GET — unauthenticated info disclosure | **LOW** | Minor |

---

## Positive Security Controls

The following security measures are correctly implemented and should be preserved:

1. **`getUser()` over `getSession()`**: The middleware and `withAuth` always validate the session with Supabase servers, not just decode the JWT. This prevents token forgery.

2. **Database-backed role enforcement**: Roles are fetched from the `users` table on every request, not from JWT claims. Role escalation via token manipulation is impossible.

3. **Timing-safe comparisons**: All secret comparisons (API keys, cron secrets, webhook signatures, CSRF tokens) use constant-time comparison to prevent timing attacks.

4. **HMAC-SHA256 signatures**: Booking tokens, Stripe webhooks, CMI callbacks, and Meta webhooks all use HMAC-SHA256 for integrity verification.

5. **Input validation with Zod**: Most endpoints validate request bodies with Zod schemas, preventing malformed input.

6. **Magic byte validation on uploads**: File uploads verify magic bytes to prevent MIME type spoofing attacks.

7. **CSP with nonce-based script-src**: Content Security Policy uses per-request nonces instead of `unsafe-inline` for scripts.

8. **SVG upload blocking**: SVG files are excluded from allowed upload types because they can contain embedded `<script>` tags.

9. **Open redirect prevention**: Stripe checkout and CMI payment redirect URLs are validated to be same-origin.

10. **Rate limiting on all API routes**: Both GET and mutation endpoints are rate-limited, preventing data scraping and brute-force attacks.

11. **Idempotent webhook processing**: Payment webhooks use upsert patterns to prevent duplicate processing.

12. **Audit logging**: Sensitive operations (impersonation, bookings, payments) are logged to an audit trail.

---

*Report generated by static analysis of all authentication and authorization code paths in the webs-alots repository. No live testing or exploitation was performed.*
