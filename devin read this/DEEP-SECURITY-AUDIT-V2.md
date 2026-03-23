# Deep Security Audit Report v2 — Authentication & Authorization

**Date:** 2026-03-23
**Scope:** All auth-related files, API routes, middleware, impersonation, cron auth, API key auth, webhook endpoints, payment flows, booking system
**Methodology:** Manual code review + attack scenario simulation

---

## Executive Summary

The application demonstrates a **mature security posture** with many industry best practices already implemented (timing-safe comparisons, magic-byte file validation, CSRF protection, input sanitization). However, the audit identified **4 Critical**, **6 High**, **8 Medium**, and **5 Low** severity findings that represent real-world exploitable vulnerabilities.

---

## TABLE OF CONTENTS

1. [Critical Vulnerabilities](#1-critical-vulnerabilities)
2. [High Severity Findings](#2-high-severity-findings)
3. [Medium Severity Findings](#3-medium-severity-findings)
4. [Low Severity Findings](#4-low-severity-findings)
5. [Attack Scenarios (Step-by-Step)](#5-attack-scenarios-step-by-step)
6. [Trust Boundary Analysis](#6-trust-boundary-analysis)
7. [Endpoint Security Matrix](#7-endpoint-security-matrix)
8. [Positive Security Controls](#8-positive-security-controls-already-in-place)

---

## 1. CRITICAL VULNERABILITIES

### CRIT-01: Open Redirect via OAuth Callback `next` Parameter

**File:** `src/app/auth/callback/route.ts:7,40`
**Severity:** CRITICAL
**CVSS:** 8.2

```typescript
// Line 7 — user-controlled redirect target
const next = searchParams.get("next") ?? "/patient/dashboard";

// Line 40 — used in redirect without validation
return NextResponse.redirect(`${origin}${next}`);
```

**Vulnerability:** The `next` query parameter is entirely user-controlled and used directly in a redirect. While it is prefixed with `origin`, an attacker can craft a `next` value like `//evil.com` or `@evil.com` which many URL parsers treat as a protocol-relative or authority-relative URL, bypassing the origin prefix.

**Attack Scenario:**
1. Attacker crafts URL: `https://clinic.example.com/auth/callback?code=VALID&next=//evil.com/phishing`
2. User clicks the link (e.g., in a phishing email disguised as a password reset)
3. After successful OAuth, user is redirected to `https://clinic.example.com//evil.com/phishing`
4. Browser may resolve this as `https://evil.com/phishing` (protocol-relative)
5. Attacker's page mimics the login screen to harvest credentials

**Impact:** Credential theft via phishing, session token theft if tokens are passed in URL

**Fix:**
```typescript
// Validate that `next` is a safe relative path
const SAFE_PATH_REGEX = /^\/[a-zA-Z0-9\-_/]*$/;
const next = searchParams.get("next");
const safePath = next && SAFE_PATH_REGEX.test(next) ? next : "/patient/dashboard";
```

---

### CRIT-02: `withAuth(handler, null)` Skips Role Authorization on Sensitive Endpoints

**File:** `src/lib/with-auth.ts:77` and multiple route files
**Severity:** CRITICAL
**CVSS:** 8.5

```typescript
// with-auth.ts line 77 — null bypasses all role checks
if (allowedRoles === null) {
  // No explicit role restriction — any authenticated user is allowed
}
```

**Affected endpoints using `withAuth(..., null)`:**

| Endpoint | File | What it does |
|----------|------|--------------|
| `POST /api/booking/cancel` | `booking/cancel/route.ts:113` | Cancel ANY appointment |
| `GET /api/booking/cancel` | `booking/cancel/route.ts:165` | Check cancellability of ANY appointment |
| `POST /api/booking/reschedule` | `booking/reschedule/route.ts:132` | Reschedule ANY appointment |
| `POST /api/booking/waiting-list` | `booking/waiting-list/route.ts:72` | Add to waiting list |
| `GET /api/booking/waiting-list` | `booking/waiting-list/route.ts:118` | Read waiting list entries |
| `DELETE /api/booking/waiting-list` | `booking/waiting-list/route.ts:158` | Delete waiting list entries |
| `GET /api/clinic-features` | `clinic-features/route.ts:52` | Read clinic feature config |
| `POST /api/onboarding` | `onboarding/route.ts:190` | Create new clinic (has own checks) |

**Vulnerability:** A **patient** user can cancel or reschedule ANY appointment in the clinic (not just their own), delete waiting list entries, and access internal feature configurations. The `null` role parameter was designed for the onboarding flow (where users don't have profiles yet) but has been incorrectly applied to booking management endpoints.

**Attack Scenario:**
1. Patient logs in with their account
2. Patient calls `POST /api/booking/cancel` with any `appointmentId` from the clinic
3. The appointment (belonging to another patient or scheduled by a doctor) is cancelled
4. Patient can systematically cancel ALL appointments in the clinic, causing a denial-of-service

**Impact:** Any authenticated user (including patients) can manipulate other users' appointments. This is a **horizontal privilege escalation** and a **data integrity violation** in a healthcare context.

**Fix:** Replace `null` with explicit role arrays:
```typescript
// booking/cancel — patients can only cancel their OWN appointments
export const POST = withAuth(async (request, { supabase, profile }) => {
  // ... existing logic ...
  // ADD: Verify the appointment belongs to this patient
  if (profile.role === "patient") {
    const { data: appt } = await supabase.from("appointments")
      .select("patient_id").eq("id", body.appointmentId).single();
    if (appt?.patient_id !== profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
}, ["patient", "receptionist", "doctor", "clinic_admin", "super_admin"]);
```

---

### CRIT-03: Missing Ownership Validation — Any Authenticated User Can Cancel/Reschedule Other Users' Appointments

**File:** `src/app/api/booking/cancel/route.ts:27-32`, `src/app/api/booking/reschedule/route.ts:50-55`
**Severity:** CRITICAL
**CVSS:** 8.1

```typescript
// cancel/route.ts — No ownership check; only checks clinic_id
const { data: appt } = await supabase
  .from("appointments")
  .select("id, doctor_id, appointment_date, start_time, status")
  .eq("id", body.appointmentId)
  .eq("clinic_id", clinicConfig.clinicId)  // clinic-level only, no user-level check
  .single();
```

**Vulnerability:** Neither the cancel nor reschedule endpoint verifies that the requesting user owns the appointment or has staff-level permissions. Combined with CRIT-02 (`allowedRoles: null`), any authenticated user (including patients) can cancel or reschedule any other user's appointment within the same clinic by guessing or enumerating appointment IDs.

**Impact:** In a healthcare setting, this means:
- A patient could cancel a doctor's scheduled surgery
- A disgruntled user could reschedule all appointments to invalid times
- Systematic disruption of clinic operations

---

### CRIT-04: `GET /api/custom-fields` Is Completely Unauthenticated

**File:** `src/app/api/custom-fields/route.ts:15`
**Severity:** CRITICAL
**CVSS:** 7.5

```typescript
// Line 15 — exported as a plain function, NOT wrapped in withAuth
export async function GET(request: NextRequest) {
```

**Vulnerability:** The `GET` handler for custom field definitions is a plain `async function`, NOT wrapped in `withAuth`. This means **anyone on the internet** can query all custom field definitions for any clinic type without authentication.

**Impact:** Information disclosure — attackers can enumerate all custom field schemas, field types, validation rules, and data structures of the healthcare application. This reveals the data model and can be used to plan more targeted attacks.

**Fix:**
```typescript
export const GET = withAuth(async (request: NextRequest, { supabase }) => {
  // ... existing logic ...
}, STAFF_ROLES);
```

---

## 2. HIGH SEVERITY FINDINGS

### HIGH-01: Rate Limiter Fails Open on All Errors

**File:** `src/lib/rate-limit.ts:180-184`
**Severity:** HIGH
**CVSS:** 7.0

```typescript
} catch (err) {
  // Network/transient failure — fail open to avoid blocking
  // legitimate traffic.
  logger.error("Rate limiter network failure — failing open", { context: "rate-limit", error: err });
  return true;  // ALLOWS the request through
}
```

**Vulnerability:** If the Supabase rate limit backend is unavailable (network issue, DB overload, misconfiguration), ALL rate limits are disabled. An attacker who can cause the rate limit DB to fail (e.g., by flooding it with requests from many IPs) effectively disables rate limiting for all endpoints.

**Additionally:** The fallback upsert-based approach (lines 118-179) has a documented race condition that can allow burst traffic to exceed limits:
```typescript
// This is still susceptible to a narrow race window but is
// better than the original SELECT → UPDATE pattern.
```

**Impact:** Brute-force attacks, API abuse, DoS amplification, AI API cost abuse (Cloudflare Workers AI, OpenAI)

---

### HIGH-02: IP Spoofing via Attacker-Controlled Headers in Rate Limiting

**File:** `src/lib/rate-limit.ts:34-41`
**Severity:** HIGH
**CVSS:** 7.3

```typescript
export function extractClientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
```

**Vulnerability:** If the application is NOT deployed behind Cloudflare (e.g., during development, staging, or alternative deployment), these headers (`cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`) are **attacker-controlled**. An attacker can:
1. Set `CF-Connecting-IP: random-ip-{N}` on each request
2. Each request gets a different rate limit bucket
3. Rate limiting is completely bypassed

**Impact:** Rate limit bypass, enabling brute-force on all rate-limited endpoints

**Fix:** Validate that reverse proxy headers are only trusted when behind a known proxy:
```typescript
// Only trust CF-Connecting-IP if actually behind Cloudflare
const isBehindProxy = process.env.TRUSTED_PROXY === "cloudflare";
if (isBehindProxy) {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
return request.ip ?? "unknown";
```

---

### HIGH-03: Impersonation Cookie Lacks Re-Authentication and Scope Controls

**File:** `src/app/api/impersonate/route.ts:58-71`
**Severity:** HIGH
**CVSS:** 7.5

```typescript
response.cookies.set("sa_impersonate_clinic_id", clinicId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 60 * 60 * 4, // 4 hours
});
```

**Vulnerabilities:**
1. **No re-authentication:** Impersonation does not require the super_admin to re-enter their password or confirm via 2FA. If a super_admin session is compromised (XSS, session fixation, shared computer), the attacker can impersonate ANY clinic for 4 hours.
2. **4-hour window:** The impersonation cookie persists for 4 hours. This is excessively long for a privilege escalation operation.
3. **No scope limitation:** The impersonation grants full access to the target clinic context. There's no read-only or audit-only mode.
4. **Activity log failure is silenced:** Lines 47-49 — if the activity log insert fails, it's swallowed silently. An attacker who compromises a super_admin account can impersonate clinics without leaving an audit trail.

```typescript
} catch {
  // Activity log insert may fail if table doesn't exist — non-blocking
}
```

**Impact:** If a super_admin session is stolen, the attacker gains god-mode access to any clinic's patient data without any additional verification, and potentially without logging.

---

### HIGH-04: `GET /api/branding` Is Unauthenticated and Exposes Internal Clinic Data

**File:** `src/app/api/branding/route.ts:60`
**Severity:** HIGH
**CVSS:** 6.5

```typescript
// Line 60 — plain function, NOT wrapped in withAuth
export async function GET() {
```

**Vulnerability:** The branding endpoint is unauthenticated and returns clinic configuration data including the clinic name, phone number, address, and internal template/section settings. Combined with a public-facing response, this leaks PII and internal configuration.

**Additional data exposed:**
```
name, logo_url, favicon_url, primary_color, secondary_color, heading_font,
body_font, hero_image_url, tagline, cover_photo_url, template_id,
section_visibility, phone, address
```

**Impact:** Information disclosure of clinic PII (phone, address), internal configuration (template_id, section_visibility)

---

### HIGH-05: Booking Token Dev Bypass May Leak to Production

**File:** `src/app/api/booking/route.ts:48-53`
**Severity:** HIGH
**CVSS:** 7.8

```typescript
if (process.env.NODE_ENV === "development") return token === "dev-bypass";
```

**Vulnerability:** The booking verification token system has a hardcoded `"dev-bypass"` token that works when `NODE_ENV === "development"`. While this is gated by the environment check, several risks exist:
1. If `NODE_ENV` is not explicitly set to `"production"` in the deployment config (e.g., missing env var, defaults to `"development"`), the bypass is active in production
2. The bypass token is a constant string, trivially discoverable in the source code
3. Next.js build behavior: in some deployment scenarios, `NODE_ENV` may not be set as expected

**Impact:** If the bypass leaks to production, anyone can create unlimited fake appointments without phone verification, flooding the system with spam bookings.

---

### HIGH-06: Notifications GET Endpoint Allows Staff to Read Any User's Notifications Across Clinics

**File:** `src/app/api/notifications/route.ts:79-85`
**Severity:** HIGH
**CVSS:** 6.8

```typescript
// Non-staff users can only read their own notifications
const userId = isStaff && requestedUserId ? requestedUserId : profile.id;
```

**Vulnerability:** Staff users (doctor, receptionist, clinic_admin) can pass any `userId` parameter and read notifications belonging to users in OTHER clinics. There's no tenant isolation check on the GET endpoint — unlike the POST endpoint which explicitly validates the recipient belongs to the same clinic (line 39-51).

**Attack Scenario:**
1. A doctor from Clinic A obtains a user ID from Clinic B (e.g., via shared patients, enumeration)
2. Doctor calls `GET /api/notifications?userId=<clinic-b-user-id>`
3. All notifications (appointment details, prescriptions, payment info) for that user are returned

**Impact:** Cross-tenant data leak in a healthcare application — HIPAA/GDPR violation

**Fix:**
```typescript
const userId = isStaff && requestedUserId ? requestedUserId : profile.id;
// ADD: Tenant isolation for staff reading other users' notifications
if (isStaff && requestedUserId && profile.role !== "super_admin") {
  const { data: targetUser } = await supabase.from("users")
    .select("clinic_id").eq("id", requestedUserId).single();
  if (!targetUser || targetUser.clinic_id !== profile.clinic_id) {
    return NextResponse.json({ error: "User not found in your clinic" }, { status: 403 });
  }
}
```

---

## 3. MEDIUM SEVERITY FINDINGS

### MED-01: No Input Validation on `date` and `status` Parameters in v1 API

**File:** `src/app/api/v1/appointments/route.ts:34-51`
**Severity:** MEDIUM
**CVSS:** 5.5

```typescript
const date = url.searchParams.get("date");
const status = url.searchParams.get("status");
// ... used directly in query without validation
if (date) query = query.eq("appointment_date", date);
if (status) query = query.eq("status", status);
```

**Vulnerability:** While the Supabase client parameterizes queries (preventing SQL injection), there's no validation that `date` is a valid date format or `status` is a valid appointment status. This could lead to:
1. Unexpected query behavior with malformed date strings
2. Information disclosure about valid status values through error messages

**Contrast with v1/patients:** The patients endpoint (line 49) sanitizes search input: `search.replace(/[%_,.()]/g, "")`. The appointments endpoint lacks equivalent sanitization.

---

### MED-02: `PUT /api/upload` Confirms Pre-Signed Uploads Without Tenant Isolation

**File:** `src/app/api/upload/route.ts:134-185`
**Severity:** MEDIUM
**CVSS:** 6.0

```typescript
export const PUT = withAuth(async (request) => {
  // ...
  const { key, contentType } = body;
  // No check that `key` belongs to the authenticated user's clinic
```

**Vulnerability:** The PUT confirmation endpoint accepts any R2 `key` without verifying it belongs to the authenticated user's clinic. A staff user from Clinic A could:
1. Discover a key pattern for Clinic B's files (e.g., `clinic-b-id/radiology/scan.jpg`)
2. Call `PUT /api/upload` with that key and a mismatched `contentType`
3. This triggers deletion of Clinic B's file (line 177): `await deleteFromR2(key)`

**Impact:** Cross-tenant file deletion via the magic-byte validation failure path

---

### MED-03: Waiting List and Booking Cancel Endpoints Lack Patient-Level Authorization

**File:** `src/app/api/booking/waiting-list/route.ts:125-158`
**Severity:** MEDIUM
**CVSS:** 6.5

```typescript
// DELETE — any authenticated user can delete any waiting list entry
export const DELETE = withAuth(async (request, { supabase }) => {
  const body = (await request.json()) as { entryId: string };
  // No check that entryId belongs to the requesting user
  const { error } = await supabase
    .from("waiting_list")
    .delete()
    .eq("id", body.entryId)
    .eq("clinic_id", clinicConfig.clinicId);
}, null);  // null = any authenticated user
```

**Vulnerability:** Any authenticated user (including patients) can delete any waiting list entry in the clinic by providing the entry ID. Combined with the GET endpoint (also `null` roles), an attacker can enumerate and delete all waiting list entries.

---

### MED-04: Custom Field Values Endpoint Lacks Tenant Isolation

**File:** `src/app/api/custom-fields/values/route.ts:15-47`
**Severity:** MEDIUM
**CVSS:** 5.8

```typescript
export const GET = withAuth(async (request, { supabase }) => {
  const clinicId = request.nextUrl.searchParams.get("clinic_id");
  // clinic_id is taken from the query parameter, NOT from the user's profile
  const { data } = await supabase
    .from("custom_field_values")
    .select("*")
    .eq("clinic_id", clinicId)  // Attacker controls clinicId
```

**Vulnerability:** The `clinic_id` parameter is taken from the query string, not from the authenticated user's profile. A staff user from Clinic A can read custom field values for any entity in Clinic B by passing Clinic B's ID.

**Similarly in POST and PATCH:** Lines 61, 149 — `clinic_id` from request body is used directly without validating against `profile.clinic_id`.

---

### MED-05: CSRF Exempt Prefixes Include Security-Sensitive Endpoints

**File:** `src/middleware.ts` (CSRF_EXEMPT_PREFIXES)
**Severity:** MEDIUM
**CVSS:** 5.5

The following endpoint prefixes are exempt from CSRF protection:
- `/api/cron/` — Protected only by CRON_SECRET
- `/api/webhooks/` — Protected by webhook signature
- `/api/v1/` — Protected by API key
- `/api/payments/webhook` — Protected by Stripe signature
- `/api/payments/cmi/callback` — Protected by CMI HMAC

**Risk:** While each has its own authentication mechanism, CSRF exemption means:
1. If CRON_SECRET is weak or leaked, cron endpoints can be triggered from any website via a cross-origin POST
2. If API keys are compromised, the v1 API can be abused without CSRF protection adding a second factor

---

### MED-06: WebP Magic Byte Validation Is Incomplete

**File:** `src/app/api/upload/route.ts:48`
**Severity:** MEDIUM
**CVSS:** 4.8

```typescript
"image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],  // "RIFF" only
```

**Vulnerability:** WebP files start with `RIFF....WEBP`. The current check only validates the first 4 bytes (`RIFF`) but not the `WEBP` marker at bytes 8-11. A valid RIFF file that is NOT a WebP image (e.g., AVI, WAV) would pass validation. An attacker could upload a RIFF-format file (potentially containing malicious content) with `Content-Type: image/webp`.

**Fix:**
```typescript
"image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
// Also check bytes 8-11 for "WEBP" in the validation function
```

---

### MED-07: `GET /api/booking` Is Completely Unauthenticated

**File:** `src/app/api/booking/route.ts:380`
**Severity:** MEDIUM
**CVSS:** 5.0

```typescript
export async function GET(request: NextRequest) {
  // No authentication — public endpoint
```

**Vulnerability:** The booking availability endpoint exposes all time slots, booked counts, and slot configuration for any doctor on any date. While designed to be public for the booking widget, it reveals:
- Doctor schedules and working patterns
- How busy each doctor is (via `bookedCounts`)
- Slot duration and buffer time configuration
- Maximum bookings per slot

This is information that competitors or harassers could use to profile clinic operations.

---

### MED-08: `GET /api/health` Exposes Database Latency and Status

**File:** `src/app/api/health/route.ts:13`
**Severity:** MEDIUM
**CVSS:** 4.0

```typescript
export async function GET() {
  // Unauthenticated health endpoint exposing:
  // - Database status (ok/degraded/down)
  // - Database latency in milliseconds
  // - Timestamp
```

**Vulnerability:** While health endpoints are common, exposing database latency to unauthenticated users provides an oracle for timing attacks and infrastructure reconnaissance.

---

## 4. LOW SEVERITY FINDINGS

### LOW-01: Impersonation Cookie Name Leaks Implementation Detail

**File:** `src/app/api/impersonate/route.ts:58`
**Severity:** LOW

Cookie names `sa_impersonate_clinic_id` and `sa_impersonate_clinic_name` reveal that "sa" (super_admin) impersonation is a feature. Use opaque cookie names instead.

---

### LOW-02: `clinicName` in Impersonation Cookie Is URL-Encoded But Not Length-Limited

**File:** `src/app/api/impersonate/route.ts:65`
**Severity:** LOW

```typescript
response.cookies.set("sa_impersonate_clinic_name", encodeURIComponent(clinicName || clinic.name), {
```

No maximum length check on the clinic name before encoding. Excessively long names could cause cookie size issues (>4KB limit) or header overflow.

---

### LOW-03: Timing Information Leak in Booking Token Validation

**File:** `src/app/api/booking/route.ts:61`
**Severity:** LOW

```typescript
if (isNaN(expiry) || Date.now() > expiry) return false;
```

The expiry check returns `false` before the HMAC comparison. An attacker can determine if a token is expired vs. invalid by measuring response time (expired tokens return faster than invalid signatures).

---

### LOW-04: Error Messages Vary Between Auth States

**File:** Various route files
**Severity:** LOW

Different error messages for different auth failure modes can help attackers fingerprint the auth system:
- `"Not authenticated"` (401) — no session
- `"User profile not found"` (404) — valid Supabase session but no DB profile
- `"Forbidden — insufficient permissions"` (403) — valid profile, wrong role

An attacker can distinguish between "this user exists but has no profile" vs "this user doesn't exist at all".

---

### LOW-05: Super Admin Layout Fetches Notifications Client-Side Without Server Auth

**File:** `src/app/(super-admin)/layout.tsx:95-141`
**Severity:** LOW

```typescript
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
```

The super-admin layout uses the client-side Supabase client to fetch notifications. If the session cookie is manipulated, the client could display misleading notifications. However, this is mitigated by the server-side middleware checks.

---

## 5. ATTACK SCENARIOS (Step-by-Step)

### Scenario 1: Patient Escalation → Clinic Sabotage

**Attacker Profile:** Disgruntled patient with a valid account
**Difficulty:** Easy (no special tools required)

1. Patient authenticates normally via the patient portal
2. Using browser DevTools or curl, patient sends:
   ```
   POST /api/booking/cancel
   Content-Type: application/json
   Cookie: <valid session>
   
   {"appointmentId": "<any-appointment-uuid>"}
   ```
3. Because `withAuth(..., null)` allows any role and no ownership check exists, the appointment is cancelled
4. Patient repeats for every appointment ID in the clinic (IDs can be enumerated via the waiting list or booking endpoints)
5. **Result:** All clinic appointments cancelled; patients and doctors lose their schedules

### Scenario 2: Cross-Tenant Data Exfiltration via Notifications

**Attacker Profile:** Malicious staff member at Clinic A
**Difficulty:** Easy

1. Doctor at Clinic A obtains a user ID from Clinic B (e.g., a patient who visits both clinics)
2. Doctor sends: `GET /api/notifications?userId=<clinic-b-patient-id>`
3. Receives all notifications for that patient including appointment details, prescriptions, and payment information from Clinic B
4. **Result:** HIPAA/GDPR violation — healthcare data leaked across tenant boundaries

### Scenario 3: Credential Phishing via Open Redirect

**Attacker Profile:** External attacker
**Difficulty:** Medium

1. Attacker crafts a URL: `https://clinic.example.com/auth/callback?code=expired&next=%2F%2Fevil.com%2Flogin`
2. Sends this link to clinic staff via email: "Please verify your account"
3. When clicked, the OAuth callback fails (expired code), falls through to line 40:
   ```typescript
   return NextResponse.redirect(`${origin}${next}`);
   ```
4. User is redirected to `https://clinic.example.com//evil.com/login`
5. **Note:** Even if the double-slash is not treated as protocol-relative by the specific browser, the path `/evil.com/login` could still be a valid page on the clinic's domain if the attacker can register a subdomain, or the redirect to `/login?error=auth_callback_failed` (line 45) is reached instead if there's no code. However, **if a valid code IS provided** and the user profile lookup fails, line 40 is reached with the unvalidated `next`.
6. **Result:** User lands on attacker's page that mimics the clinic login

### Scenario 4: Cross-Tenant File Deletion

**Attacker Profile:** Staff member at Clinic A
**Difficulty:** Medium

1. Staff user knows or guesses R2 key pattern: `{clinic-b-id}/radiology/{filename}`
2. Sends:
   ```
   PUT /api/upload
   Content-Type: application/json
   Cookie: <valid session>
   
   {"key": "clinic-b-id/radiology/patient-xray.jpg", "contentType": "image/png"}
   ```
3. The endpoint reads the file from R2, finds it's a JPEG (not PNG as declared), and **deletes it** (line 177)
4. **Result:** Patient medical images from another clinic are permanently deleted

### Scenario 5: Rate Limit Bypass for API Abuse

**Attacker Profile:** External attacker
**Difficulty:** Easy

1. Attacker sends requests to `/api/chat` with spoofed IP headers:
   ```
   POST /api/chat
   CF-Connecting-IP: random-ip-1
   ```
2. Each request uses a different `CF-Connecting-IP` value
3. Rate limiter creates a new bucket for each "IP"
4. Attacker sends thousands of requests, each hitting the AI API (OpenAI/Cloudflare Workers AI)
5. **Result:** Massive API cost amplification; clinic's AI API budget exhausted

### Scenario 6: Unauthenticated Clinic Data Harvesting

**Attacker Profile:** Competitor or data scraper
**Difficulty:** Easy (no auth required)

1. Attacker identifies clinic subdomains (e.g., via DNS enumeration)
2. For each clinic: `GET /api/branding` — extracts name, phone, address
3. For each doctor: `GET /api/booking?doctorId=X&date=2026-03-24` — extracts schedule and availability
4. `GET /api/custom-fields?clinic_type_key=general_medicine` — extracts data schema
5. **Result:** Complete mapping of clinic operations, schedules, and data models without any authentication

---

## 6. TRUST BOUNDARY ANALYSIS

### What is trusted from the client (SHOULD NOT be):

| Data Point | Trusted From | Should Be Derived From | Endpoint |
|-----------|-------------|----------------------|----------|
| `clinic_id` (custom field values) | Query param / body | `profile.clinic_id` | `/api/custom-fields/values` |
| `userId` (notifications GET) | Query param | Constrained to same clinic | `/api/notifications` |
| `next` redirect path | Query param | Allowlist/regex validation | `/auth/callback` |
| `key` (upload confirmation) | Request body | Scoped to user's clinic prefix | `/api/upload` (PUT) |
| Rate limit IP | HTTP headers | Trusted proxy only | All rate-limited endpoints |
| `clinicId` (chat fallback) | Request body | Header from middleware only | `/api/chat` |

### Server-side enforcement (correctly implemented):

| Control | Status | Notes |
|---------|--------|-------|
| Session validation via Supabase `getUser()` | CORRECT | Validates JWT with Supabase server, not just decoding |
| Role checks via `withAuth` | PARTIAL | Correct when roles specified; broken when `null` |
| Tenant isolation in middleware | CORRECT | Subdomain → clinic_id resolution is server-side |
| API key hashing + constant-time comparison | CORRECT | SHA-256 hash stored, prefix for lookup, full hash comparison |
| CSRF origin validation | CORRECT | Does not trust Host header, uses env-configured allowlist |
| Webhook HMAC verification | CORRECT | Timing-safe comparison, timestamp tolerance |
| File content validation (magic bytes) | MOSTLY CORRECT | WebP check incomplete (RIFF only) |
| Redirect URL validation (payments) | CORRECT | `validateRedirectUrl` checks same-origin |

---

## 7. ENDPOINT SECURITY MATRIX

| Endpoint | Auth | Roles | Rate Limited | CSRF Protected | Tenant Isolated | Issues |
|----------|------|-------|-------------|----------------|-----------------|--------|
| `POST /api/impersonate` | Session | super_admin | Mutation limiter | Yes | N/A | HIGH-03 |
| `DELETE /api/impersonate` | Session | super_admin | Mutation limiter | Yes | N/A | None |
| `GET /api/v1/appointments` | API Key | N/A | No | Exempt | By API key | MED-01 |
| `POST /api/v1/appointments` | API Key | N/A | No | Exempt | By API key | MED-01 |
| `GET /api/v1/patients` | API Key | N/A | No | Exempt | By API key | None |
| `GET /api/cron/reminders` | CRON_SECRET | N/A | No | Exempt | N/A | None |
| `GET /api/cron/billing` | CRON_SECRET | N/A | No | Exempt | N/A | None |
| `POST /api/webhooks` | HMAC-SHA256 | N/A | Webhook limiter | Exempt | By phone_number_id | None |
| `GET /auth/callback` | OAuth code | N/A | No | N/A | N/A | CRIT-01 |
| `POST /api/booking` | Booking token | N/A | No | Yes | By clinicConfig | HIGH-05 |
| `GET /api/booking` | **NONE** | N/A | No | N/A | By clinicConfig | MED-07 |
| `POST /api/booking/cancel` | Session | **ANY (null)** | Mutation limiter | Yes | Clinic-level only | CRIT-02, CRIT-03 |
| `POST /api/booking/reschedule` | Session | **ANY (null)** | Mutation limiter | Yes | Clinic-level only | CRIT-02, CRIT-03 |
| `POST /api/booking/waiting-list` | Session | **ANY (null)** | Mutation limiter | Yes | By clinicConfig | CRIT-02 |
| `DELETE /api/booking/waiting-list` | Session | **ANY (null)** | Mutation limiter | Yes | Clinic-level only | MED-03 |
| `POST /api/booking/emergency-slot` | Session | STAFF_ROLES | Mutation limiter | Yes | By clinicConfig | None |
| `POST /api/booking/recurring` | Session | STAFF_ROLES | Mutation limiter | Yes | By clinicConfig | None |
| `POST /api/notifications` | Session | STAFF_ROLES | Mutation limiter | Yes | Yes (line 39) | None |
| `GET /api/notifications` | Session | STAFF_ROLES | No | N/A | **NO** | HIGH-06 |
| `POST /api/notifications/trigger` | Session | STAFF_ROLES | Mutation limiter | Yes | Yes (line 55) | None |
| `POST /api/upload` | Session | Staff+doctor | Upload limiter | Yes | Yes (profile) | None |
| `PUT /api/upload` | Session | Staff+doctor | Mutation limiter | Yes | **NO** | MED-02 |
| `GET /api/upload` | Session | Staff+doctor | No | N/A | Yes (profile) | None |
| `POST /api/onboarding` | Session | **ANY (null)** | Onboarding limiter | Yes | N/A | Own checks |
| `POST /api/chat` | Session | Any | Chat limiter | Yes | By header/body | None |
| `GET /api/branding` | **NONE** | N/A | No | N/A | By clinicConfig | HIGH-04 |
| `PUT /api/branding` | Session | Admin roles | Mutation limiter | Yes | By clinicConfig | None |
| `POST /api/branding` | Session | Admin roles | Upload limiter | Yes | By clinicConfig | None |
| `GET /api/custom-fields` | **NONE** | N/A | No | N/A | N/A | CRIT-04 |
| `POST /api/custom-fields` | Session | super_admin | Mutation limiter | Yes | N/A | None |
| `GET /api/custom-fields/values` | Session | STAFF_ROLES | No | N/A | **NO** | MED-04 |
| `POST /api/custom-fields/values` | Session | STAFF_ROLES | Mutation limiter | Yes | **NO** | MED-04 |
| `GET /api/clinic-features` | Session | **ANY (null)** | No | N/A | N/A | CRIT-02 |
| `POST /api/payments/webhook` | Stripe sig | N/A | Webhook limiter | Exempt | By metadata | None |
| `POST /api/payments/create-checkout` | Session | STAFF_ROLES | Mutation limiter | Yes | Yes (profile) | None |
| `POST /api/payments/cmi` | Session | STAFF_ROLES | Mutation limiter | Yes | N/A | None |
| `POST /api/payments/cmi/callback` | CMI HMAC | N/A | No | Exempt | By order ID | None |
| `POST /api/radiology/upload` | Session | STAFF_ROLES | Upload limiter | Yes | Yes (profile) | None |
| `GET /api/health` | **NONE** | N/A | No | N/A | N/A | MED-08 |

---

## 8. POSITIVE SECURITY CONTROLS (Already in Place)

The codebase demonstrates significant security maturity:

1. **Timing-safe comparisons** (`timingSafeEqual`) for all HMAC/signature checks — prevents timing attacks
2. **Magic-byte file validation** — prevents MIME type spoofing attacks (with minor WebP gap)
3. **CSRF protection with proper Origin validation** — does NOT trust the Host header (correctly documented why)
4. **Per-request CSP nonce** — prevents inline script injection
5. **Supabase `getUser()` server-side validation** — validates JWT with the auth server, doesn't just decode
6. **Input validation with Zod schemas** — all API inputs are validated against schemas
7. **API key hashing with SHA-256** — keys are never stored in plaintext
8. **Webhook signature verification** — Stripe and Meta webhooks both use HMAC with timing-safe comparison
9. **Redirect URL validation** in payment flows — prevents open redirects in payment callbacks
10. **Tenant isolation** in most mutation endpoints — clinic_id derived from profile, not request
11. **SVG upload blocked** — prevents XSS via embedded scripts in SVG files
12. **Rate limiting architecture** — well-designed with multiple tiers for different endpoint categories
13. **Prompt injection sanitization** in chat — Unicode normalization, ChatML stripping, role impersonation filtering
14. **Audit logging** for healthcare compliance — booking, cancellation, and emergency events are logged
15. **Onboarding privilege escalation prevention** — existing users cannot create additional clinics

---

## REMEDIATION PRIORITY

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 (URGENT) | CRIT-02 + CRIT-03: Fix `null` roles on booking endpoints + add ownership checks | Low | Prevents patient-level sabotage |
| 2 (URGENT) | CRIT-01: Validate `next` parameter in OAuth callback | Low | Prevents credential phishing |
| 3 (URGENT) | CRIT-04: Add auth to `GET /api/custom-fields` | Low | Prevents info disclosure |
| 4 | HIGH-06: Add tenant isolation to notifications GET | Low | Prevents cross-tenant data leak |
| 5 | HIGH-03: Add re-auth for impersonation | Medium | Prevents session hijack escalation |
| 6 | HIGH-02: Fix IP extraction to only trust configured proxies | Medium | Prevents rate limit bypass |
| 7 | HIGH-01: Rate limiter fail-closed option | Medium | Prevents abuse during outages |
| 8 | MED-02: Scope upload PUT to user's clinic prefix | Low | Prevents cross-tenant file deletion |
| 9 | MED-04: Enforce tenant isolation in custom field values | Low | Prevents cross-tenant reads |
| 10 | HIGH-04: Consider auth for branding endpoint or redact PII | Low | Reduces information exposure |
| 11 | HIGH-05: Remove dev-bypass or add explicit production guard | Low | Eliminates bypass risk |

---

*Report generated by deep code review. All findings are based on static analysis of the source code. Runtime testing is recommended to confirm exploitability of each finding.*
