# Backend & API Performance Analysis

> **Scope**: `src/app/api/*`, server actions, `middleware.ts`, external integrations (payments, WhatsApp)  
> **Date**: 2026-03-23  
> **Focus**: API performance only (no frontend, no DB deep dive)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Slow Endpoints](#2-slow-endpoints)
3. [Blocking Operations](#3-blocking-operations)
4. [Missing Protections](#4-missing-protections)
5. [Rate Limiting Coverage](#5-rate-limiting-coverage)
6. [Cron Job Scalability](#6-cron-job-scalability)
7. [External Integration Bottlenecks](#7-external-integration-bottlenecks)
8. [Concurrency & Race Conditions](#8-concurrency--race-conditions)
9. [Server Actions Performance](#9-server-actions-performance)
10. [Middleware Performance](#10-middleware-performance)
11. [Recommendations Summary](#11-recommendations-summary)

---

## 1. Executive Summary

The backend is generally well-structured with several good patterns already in place (batched queries, `Promise.allSettled` in crons, TOCTOU guards on bookings, distributed rate limiting). However, there are several performance concerns:

- **6 endpoints** with sequential query chains that could be parallelized
- **3 external integrations** (WhatsApp, Stripe, Cloudflare AI) with no retry logic or timeout configuration
- **1 cron job** (billing) that loads all subscriptions into memory with no cursor-based pagination
- **Several API routes** missing dedicated rate-limit rules (falling through to the catch-all 30/60s)
- **Notification dispatch** processes channels sequentially instead of in parallel
- **Server actions** (`super-admin-actions.ts`) fetch entire tables without pagination

| Severity | Count | Category |
|----------|-------|----------|
| HIGH | 5 | Slow endpoints, missing timeouts, unbounded queries |
| MEDIUM | 8 | Sequential operations, missing retry logic, scalability gaps |
| LOW | 4 | Minor optimizations, caching opportunities |

---

## 2. Slow Endpoints

### 2.1 HIGH: `/api/chat` - Multiple External API Calls

**File**: `src/app/api/chat/route.ts`

This endpoint chains multiple heavy operations:
1. Rate limit check (Supabase RPC call)
2. `fetchChatbotContext()` - DB query for clinic context, FAQs, services, doctors
3. `createClient()` + `getUser()` - Auth verification
4. External AI API call (Cloudflare Workers AI or OpenAI)

```
Client -> Rate Limit (Supabase) -> Parse Body -> fetchChatbotContext (DB) 
       -> createClient + getUser (Auth) -> External AI API (Cloudflare/OpenAI)
```

**Impact**: 4-5 sequential network round-trips. The Cloudflare AI and OpenAI calls have no timeout configured, meaning a slow upstream can block the edge worker indefinitely.

**Recommendation**:
- Parallelize `fetchChatbotContext()` and auth verification (`getUser()`) since they are independent
- Add `AbortSignal.timeout()` to external AI fetch calls (e.g., 15s for Cloudflare, 30s for OpenAI)
- Cache chatbot context per clinic with a short TTL (e.g., 60s) to avoid repeated DB queries

### 2.2 HIGH: `/api/webhooks` (WhatsApp Incoming) - Sequential Per-Entry Processing

**File**: `src/app/api/webhooks/route.ts`

The webhook handler processes entries in a `for` loop with **3-4 sequential DB queries per entry**:
1. Clinic lookup by `whatsapp_phone_number_id`
2. Patient lookup by phone + clinic
3. Next appointment lookup
4. Appointment status update
5. `dispatchNotification()` (which itself does more DB + external API calls)

```typescript
for (const entry of entries) {
  // 1. DB: clinic lookup
  // 2. DB: patient lookup  
  // 3. DB: appointment lookup
  // 4. DB: appointment update
  // 5. dispatchNotification (DB + external API)
}
```

**Impact**: With multiple entries in a single webhook payload, this becomes O(N * 5) sequential DB calls. WhatsApp webhooks have a **20-second timeout** before retrying, which can cause duplicate processing.

**Recommendation**:
- Batch clinic/patient lookups across all entries before processing
- Use `Promise.allSettled()` to process entries in parallel (each entry is independent)
- Add idempotency checks (webhook message ID deduplication)

### 2.3 MEDIUM: `/api/booking/reschedule` - Sequential Validation Chain

**File**: `src/app/api/booking/reschedule/route.ts`

Sequential operations:
1. Fetch existing appointment (DB)
2. `getPublicAvailableSlots()` (DB query + slot computation)
3. Fetch service duration if `service_id` exists (conditional DB query)
4. Update appointment (DB)
5. Audit log (DB)

**Impact**: 4-5 sequential DB round-trips. Steps 1, 2, and 3 could be partially parallelized.

**Recommendation**:
- Fetch appointment and available slots in parallel via `Promise.all()`
- Combine the service duration fetch into the initial appointment query using a join

### 2.4 MEDIUM: `/api/notifications/trigger` - Sequential Recipient Dispatch

**File**: `src/app/api/notifications/trigger/route.ts`

```typescript
for (const recipient of recipients) {
  const results = await dispatchNotification(...);  // Sequential!
  allResults.push({ recipientId: recipient.id, results });
}
```

**Impact**: Each `dispatchNotification` call involves DB queries + potential external API calls (WhatsApp, email, SMS). With 10 recipients, this is 10x slower than necessary.

**Recommendation**:
- Use `Promise.allSettled()` to dispatch to all recipients in parallel
- Or batch in groups of 5-10 using the same pattern as cron jobs

### 2.5 MEDIUM: `/api/payments/cmi/callback` - Sequential Payment Processing

**File**: `src/app/api/payments/cmi/callback/route.ts`

Sequential operations for approved payments:
1. Find payment by order ID (DB)
2. Update payment status (DB)
3. Confirm appointment (DB)

**Impact**: 3 sequential DB calls. The callback handler should be fast since CMI expects a timely response.

**Recommendation**:
- Steps 2 and 3 (update payment + confirm appointment) can be run in parallel via `Promise.all()`

### 2.6 LOW: `/api/onboarding` - Multiple Sequential DB Queries

**File**: `src/app/api/onboarding/route.ts`

Sequential chain:
1. Check existing profile (DB)
2. Check orphaned clinic (DB)
3. Check existing admin (DB, conditional)
4. Create clinic (DB)
5. Create admin user (DB)
6. Potential rollback on failure (DB)

**Impact**: Up to 5-6 sequential DB calls in the worst case. However, this is a one-time operation per clinic, so the impact is low.

---

## 3. Blocking Operations

### 3.1 HIGH: No Timeout on External API Calls

**Affected files**:
- `src/lib/whatsapp.ts` - Meta API and Twilio API calls
- `src/app/api/chat/route.ts` - Cloudflare AI and OpenAI calls  
- `src/app/api/payments/create-checkout/route.ts` - Stripe API calls
- `src/lib/cmi.ts` - CMI payment gateway calls

None of these external `fetch()` calls use `AbortSignal.timeout()` or any timeout mechanism.

```typescript
// whatsapp.ts - No timeout
const response = await fetch(
  `${META_API_URL}/${config.metaPhoneNumberId}/messages`,
  { method: "POST", headers: {...}, body: JSON.stringify({...}) }
);

// chat/route.ts - No timeout on AI calls
const cfResponse = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/...`,
  { method: "POST", ... }
);
```

**Impact**: If any external service hangs, the edge worker will be blocked until the platform's global timeout kills it. This wastes edge worker capacity and can cascade into connection exhaustion under load.

**Recommendation**:
- Add `signal: AbortSignal.timeout(10000)` (10s) to all external fetch calls
- For AI endpoints, use a longer timeout (15-30s) but still enforce one
- Wrap with try/catch to return a graceful fallback on timeout

### 3.2 MEDIUM: File Upload Memory Buffering

**File**: `src/app/api/upload/route.ts`

```typescript
const buffer = Buffer.from(await file.arrayBuffer());  // Entire file in memory
```

The entire file (up to 10 MB) is buffered into memory before upload to R2. Under concurrent uploads, this can spike memory usage significantly.

**Impact**: With 10 concurrent 10MB uploads = 100MB of memory just for file buffers on a single edge worker.

**Recommendation**:
- Use streaming upload if R2 client supports it
- Consider reducing MAX_FILE_SIZE or adding a concurrent upload limit
- The pre-signed URL path (GET endpoint) is better - prefer directing clients there

### 3.3 MEDIUM: `dispatchNotification` Sequential Channel Processing

**File**: `src/lib/notifications.ts`

```typescript
// Channels processed sequentially
for (const channel of channels) {
  if (channel === "whatsapp") { ... await sendWhatsApp(...) }
  if (channel === "email") { ... await sendEmail(...) }
  if (channel === "sms") { ... await sendSms(...) }
  if (channel === "in_app") { ... await insertNotification(...) }
}
```

**Impact**: If a user has 3 channels enabled, each notification dispatch does 3 sequential external calls. WhatsApp alone can take 500ms-2s per message.

**Recommendation**:
- Process channels in parallel using `Promise.allSettled()`
- In-app notifications (DB insert) are fast and can remain sequential if needed

### 3.4 LOW: Dynamic Imports in Notification Dispatch

**File**: `src/lib/notifications.ts`

```typescript
const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
const { createClient } = await import("@/lib/supabase-server");
```

Each channel handler uses dynamic imports, which have a small overhead on first load (module parsing + execution).

**Impact**: Minor - typically <5ms per import after initial cold start. Edge runtime caches modules within the same worker.

---

## 4. Missing Protections

### 4.1 HIGH: No Request Body Size Limits on Most Endpoints

Most API routes parse `request.json()` without enforcing a body size limit. Only specific fields have length checks (e.g., `patientName.length > 200`).

**Affected endpoints**: All POST/PUT/PATCH routes that call `request.json()`

**Impact**: An attacker could send a 100MB JSON payload to exhaust edge worker memory. The Zod schemas validate structure but not total payload size.

**Recommendation**:
- Add a middleware-level body size check before route handlers
- Or check `request.headers.get('content-length')` at the start of each handler
- Suggested limit: 1MB for most endpoints, 10MB for file uploads

### 4.2 MEDIUM: `/api/custom-fields` GET is Unauthenticated

**File**: `src/app/api/custom-fields/route.ts`

```typescript
export async function GET(request: NextRequest) {  // No withAuth wrapper!
  const clinicTypeKey = request.nextUrl.searchParams.get("clinic_type_key");
  ...
}
```

The GET endpoint for custom field definitions is a plain exported function without the `withAuth` wrapper, while POST/PATCH/DELETE use `withAuth(... , ["super_admin"])`.

**Impact**: Anyone can enumerate custom field definitions for any clinic type. While this may be intentional for public-facing forms, it exposes internal field structure.

### 4.3 MEDIUM: `/api/branding` GET is Unauthenticated

**File**: `src/app/api/branding/route.ts`

```typescript
export async function GET() {  // No withAuth wrapper
  ...
}
```

**Impact**: Likely intentional (public branding info), but combined with no specific rate limit rule, it could be scraped aggressively.

### 4.4 MEDIUM: `/api/v1/*` Endpoints Lack Per-Route Rate Limiting

**Files**: `src/app/api/v1/appointments/route.ts`, `src/app/api/v1/patients/route.ts`

These public REST API endpoints use API key authentication but fall through to the generic `/api/` rate limit rule (30 req/60s). As external-facing APIs, they should have dedicated limits.

**Recommendation**:
- Add dedicated rate limit rules: e.g., `/api/v1/` at 60 req/60s (higher for legitimate API integrations, but still bounded)
- Consider per-API-key rate limiting instead of per-IP

---

## 5. Rate Limiting Coverage

### 5.1 Current Configuration

```typescript
// From rate-limit.ts
export const rateLimitRules: RateLimitRule[] = [
  { prefix: "/api/upload",        limiter: 10 req / 60s },
  { prefix: "/api/onboarding",    limiter: 5 req / 60s  },
  { prefix: "/api/chat",          limiter: 15 req / 60s },
  { prefix: "/api/webhooks",      limiter: 100 req / 60s },
  { prefix: "/api/notifications", limiter: 30 req / 60s },
  { prefix: "/api/",              limiter: 30 req / 60s },  // Catch-all
];
```

### 5.2 Endpoints Using Only Catch-All (30/60s)

These endpoints have no dedicated rate limit rule and rely on the generic catch-all:

| Endpoint | Risk Level | Suggested Dedicated Limit |
|----------|-----------|--------------------------|
| `/api/booking/*` (6 sub-routes) | MEDIUM | 20 req/60s (booking creation is expensive) |
| `/api/payments/*` (4 sub-routes) | HIGH | 10 req/60s (involves external payment APIs) |
| `/api/v1/*` (public API) | MEDIUM | 60 req/60s per API key |
| `/api/impersonate` | LOW | 5 req/60s (super_admin only) |
| `/api/branding` (POST/PUT) | LOW | 10 req/60s |
| `/api/lab/report-html` | LOW | 10 req/60s |
| `/api/radiology/report-pdf` | LOW | 10 req/60s |
| `/api/custom-fields` | LOW | 30 req/60s (current catch-all is fine) |
| `/api/clinic-features` | LOW | 30 req/60s (current catch-all is fine) |

### 5.3 Rate Limit Architecture Observations

**Good**: 
- Distributed rate limiting via Supabase RPC with in-memory fallback
- Rate limiting applied to ALL HTTP methods (GET included)
- IP extraction handles `x-forwarded-for`, `x-real-ip`, and Cloudflare headers

**Concerns**:
- Rate limit is **per-IP only** - a single IP behind a NAT or corporate proxy could be unfairly throttled while a distributed bot attack would bypass limits
- The Supabase RPC rate limit check adds a DB round-trip to every API request (typically 5-20ms)
- In-memory fallback (when Supabase is unavailable) doesn't share state across edge workers, making it ineffective in a multi-worker deployment

---

## 6. Cron Job Scalability

### 6.1 `/api/cron/billing` - Subscription Renewal

**File**: `src/app/api/cron/billing/route.ts`

```typescript
const { data: subscriptions } = await supabase
  .from("subscriptions")
  .select("clinic_id, plan, ...")
  .lte("current_period_end", now)
  .eq("status", "active");

// Process in batches of 10
const BATCH_SIZE = 10;
for (let i = 0; i < subs.length; i += BATCH_SIZE) {
  const batch = subs.slice(i, i + BATCH_SIZE);
  const settled = await Promise.allSettled(
    batch.map((sub) => processRenewal(sub.clinic_id)),
  );
}
```

**Scalability issues**:

| Issue | Severity | Detail |
|-------|----------|--------|
| No pagination on initial query | MEDIUM | Loads ALL due subscriptions into memory. At 10K+ clinics, this is a large payload |
| `processRenewal` calls Stripe API | HIGH | Each renewal may call Stripe (external API). With 1000 renewals, that's 100 batches * ~2s each = ~200s total. Cron timeout is typically 60s |
| No cursor/checkpoint | MEDIUM | If the cron times out mid-batch, already-processed renewals have no checkpoint. Next run re-fetches and re-processes everything |
| Batch size of 10 | LOW | Could be increased to 20-50 given that `Promise.allSettled` handles failures gracefully |

**Recommendation**:
- Add cursor-based pagination: process N subscriptions per cron invocation, store cursor in DB
- Add a `last_renewal_attempt` timestamp to prevent re-processing within the same day
- Increase batch size to 25-50 for better throughput
- Add total execution time guard: bail out after 50s and let the next invocation continue

### 6.2 `/api/cron/reminders` - Appointment Reminders

**File**: `src/app/api/cron/reminders/route.ts`

```typescript
// Batch idempotency check - GOOD
const appointmentIds = appointments.map((a) => a.id);
const { data: sentLogs } = await supabase
  .from("notification_log")
  .select("appointment_id, trigger")
  .in("appointment_id", appointmentIds)
  .eq("channel", "reminder")
  .eq("status", "sent");

const alreadySent = new Set(
  (sentLogs ?? []).map((l) => `${l.appointment_id}:${l.trigger}`),
);
```

**Already well-optimized**:
- Batch idempotency check avoids N+1 queries
- Parallel dispatch with `DISPATCH_BATCH_SIZE = 10`
- Single batch insert for notification logs
- Handles both legacy and new date/time fields

**Remaining scalability concerns**:

| Issue | Severity | Detail |
|-------|----------|--------|
| No pagination on appointment query | MEDIUM | Fetches all appointments in reminder window. At scale (1000+ daily appointments across all clinics), this query grows |
| `IN` clause limit | LOW | Supabase/PostgREST has practical limits on `.in()` array size (~1000 items). Beyond that, the query may fail |
| WhatsApp dispatch is external | MEDIUM | Each reminder that includes WhatsApp calls the Meta API. No timeout configured |

**Recommendation**:
- Add clinic-level pagination: process reminders per clinic or in chunks of 500 appointments
- Add timeout to WhatsApp dispatch calls within reminders

---

## 7. External Integration Bottlenecks

### 7.1 WhatsApp Integration (`src/lib/whatsapp.ts`)

| Issue | Severity | Impact |
|-------|----------|--------|
| No retry logic | HIGH | Transient Meta/Twilio API failures silently drop messages |
| No timeout on fetch | HIGH | Hung connection blocks the calling endpoint indefinitely |
| No request batching | MEDIUM | Each message is a separate HTTP request to Meta API |
| No exponential backoff | MEDIUM | On rate limit (429), the system doesn't back off and retry |
| Template variable substitution is synchronous | LOW | Fine for current scale |

**Recommendation**:
- Add `AbortSignal.timeout(10000)` to all WhatsApp fetch calls
- Implement 1-retry with 2s delay for transient failures (5xx, network errors)
- For bulk sends (reminders cron), consider Meta's batch messaging API

### 7.2 Stripe Integration

**Files**: `src/app/api/payments/create-checkout/route.ts`, `src/app/api/payments/webhook/route.ts`, `src/lib/subscription-billing.ts`

| Issue | Severity | Impact |
|-------|----------|--------|
| No timeout on Stripe API calls | HIGH | Stripe outage blocks checkout and billing flows |
| No retry on transient failures | MEDIUM | 503/timeout from Stripe drops the payment silently |
| Idempotency key used for charges (good) | -- | Already implemented in `subscription-billing.ts` |
| Webhook processes sequentially | LOW | Single event per webhook call, so sequential is fine |

**Recommendation**:
- Add `AbortSignal.timeout(15000)` to Stripe API calls
- Add 1-retry for 5xx/timeout responses from Stripe
- Consider using Stripe's official Node SDK for better retry/timeout handling (but note: edge runtime compatibility)

### 7.3 CMI Payment Gateway (`src/lib/cmi.ts`)

| Issue | Severity | Impact |
|-------|----------|--------|
| No timeout on CMI API calls | HIGH | Same as Stripe - blocks on hung connection |
| Callback handler is sequential | MEDIUM | 3 sequential DB calls in callback |

### 7.4 Cloudflare Workers AI / OpenAI (`src/app/api/chat/route.ts`)

| Issue | Severity | Impact |
|-------|----------|--------|
| No timeout on AI API calls | HIGH | AI inference can take 10-30s; no timeout means unbounded wait |
| No streaming timeout | MEDIUM | OpenAI streaming response has no read timeout between chunks |
| Fallback to basic mode on error (good) | -- | Already implemented |

---

## 8. Concurrency & Race Conditions

### 8.1 Already Handled (Good Patterns)

| Pattern | File | Detail |
|---------|------|--------|
| Post-insert maxPerSlot enforcement | `booking/route.ts:309-339` | TOCTOU race handled by post-insert count check |
| Atomic emergency slot claim | `booking/emergency-slot/route.ts:97-104` | `UPDATE ... WHERE is_booked = false` eliminates race |
| Idempotent webhook processing | `payments/webhook/route.ts:80-93` | Upsert on `reference` prevents duplicate payments |
| Idempotent CMI callback | `payments/cmi/callback/route.ts:41` | Checks `status !== COMPLETED` before updating |
| Batch idempotency in reminders cron | `cron/reminders/route.ts:77-90` | Set-based dedup prevents double sends |

### 8.2 Potential Race Conditions

| Issue | File | Severity | Detail |
|-------|------|----------|--------|
| Recurring booking conflict check | `booking/recurring/route.ts:139-168` | LOW | Conflict check and insert are not atomic. Two concurrent recurring booking requests for the same slots could both pass the check. However, this is staff-only and unlikely |
| Onboarding duplicate clinic | `onboarding/route.ts:81-137` | LOW | Orphan clinic check + insert is not atomic. Two concurrent onboarding requests could create duplicate clinics. Mitigated by the unique constraint on auth_id |
| Waiting list promotion on cancel | `booking/cancel/route.ts:81-97` | LOW | Two concurrent cancellations for the same doctor/date could promote the same waiting list entry twice |

---

## 9. Server Actions Performance

### 9.1 `super-admin-actions.ts` - Unbounded Queries

**File**: `src/lib/super-admin-actions.ts`

| Function | Issue | Severity |
|----------|-------|----------|
| `fetchClinics()` | `SELECT * FROM clinics` - no pagination | MEDIUM |
| `fetchClinicUsers(clinicId)` | `SELECT * FROM users WHERE clinic_id = ...` - no pagination | MEDIUM |
| `fetchDashboardStats()` | Fetches ALL completed payments to sum client-side | HIGH |
| `fetchBillingRecords()` | Fetches ALL payments + ALL clinics, joins client-side | HIGH |
| `fetchClientSubscriptions()` | Fetches ALL clinics + ALL payments | HIGH |

```typescript
// fetchDashboardStats - line 305-308
// Fetches EVERY completed payment row just to sum amounts
supabase
  .from("payments")
  .select("amount")
  .eq("status", "completed"),
```

**Impact**: As the platform scales, these unbounded queries will:
- Return increasingly large payloads over the network
- Consume increasing amounts of server memory for client-side joins/aggregations
- Slow down the super admin dashboard significantly

**Recommendation**:
- Add pagination (limit/offset) to all list queries
- Move the revenue sum to a DB-level `SUM()` via RPC (the comment even acknowledges this)
- Move billing record joins to a DB view or RPC function
- Add `limit(100)` as a safety net to all list queries

### 9.2 `data/server.ts` - Generic Query Helper

**File**: `src/lib/data/server.ts`

The generic `query()` helper is well-structured but has no default limit:

```typescript
async function query<T>(table, opts?) {
  // No default limit! Can return unbounded results
  if (opts?.limit) { q = q.limit(opts.limit); }
}
```

**Recommendation**: Add a default limit of 1000 to prevent accidental unbounded queries.

### 9.3 `auth.ts` - Double DB Query for Profile

**File**: `src/lib/auth.ts`

```typescript
export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();  // DB call 1
  if (!user) return null;
  const { data: profile } = await supabase                     // DB call 2
    .from("users")
    .select("*")
    .eq("auth_id", user.id)
    .single();
  return profile;
}
```

**Impact**: Every `requireAuth()` and `requireRole()` call makes 2 sequential DB queries. These are used in every server component page load.

**Note**: The middleware already does a similar profile lookup (`getProfile()` at line 359-374 in `middleware.ts`), so there may be redundant queries on authenticated page loads.

---

## 10. Middleware Performance

**File**: `src/middleware.ts`

### 10.1 Rate Limit DB Call on Every API Request

```typescript
if (pathname.startsWith("/api/")) {
  const rateLimitKey = extractClientIp(request);
  const rule = rateLimitRules.find((r) => pathname.startsWith(r.prefix));
  if (rule) {
    const allowed = await rule.limiter.check(rateLimitKey);  // DB call!
  }
}
```

**Impact**: Every API request incurs a Supabase RPC call for rate limiting. This adds 5-20ms of latency to every request.

**Recommendation**:
- For high-traffic read endpoints (`/api/health`, `/api/branding`), consider using the in-memory limiter exclusively
- Consider a two-tier approach: in-memory limiter as first check (fast), Supabase RPC as authoritative fallback

### 10.2 Auth Profile Query on Every Authenticated Page

```typescript
// Line 359-374 - Profile query on every authenticated request
const { data: profile } = await supabase
  .from("users")
  .select("id, role, clinic_id, name")
  .eq("auth_id", sessionUser.id)
  .single();
```

**Impact**: This runs on every page navigation for authenticated users. The profile data rarely changes.

**Recommendation**:
- Cache profile data in a short-lived cookie or session storage (e.g., 5-minute TTL)
- Or use Supabase's `getUser()` JWT claims to include role/clinic_id (requires custom JWT template)

### 10.3 Good Patterns Already in Place

- CSRF protection with proper exemptions for webhooks/cron
- Security headers applied globally
- Single profile query (not N+1)
- Efficient tenant resolution from subdomain

---

## 11. Recommendations Summary

### Priority 1 - Critical (Do First)

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| 1 | Add timeouts to ALL external API calls | `whatsapp.ts`, `chat/route.ts`, `payments/*` | Add `AbortSignal.timeout()` to every external `fetch()` |
| 2 | Add retry logic to WhatsApp sends | `whatsapp.ts` | 1-retry with 2s delay on 5xx/network errors |
| 3 | Add request body size validation | `middleware.ts` | Check `content-length` header, reject >1MB |
| 4 | Move revenue sum to DB-level RPC | `super-admin-actions.ts` | Create `sum_completed_payments` RPC function |

### Priority 2 - High (Do Soon)

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| 5 | Parallelize chat endpoint operations | `chat/route.ts` | `Promise.all([fetchChatbotContext(), getUser()])` |
| 6 | Parallelize webhook entry processing | `webhooks/route.ts` | Use `Promise.allSettled()` for independent entries |
| 7 | Parallelize notification channel dispatch | `notifications.ts` | `Promise.allSettled()` across channels |
| 8 | Parallelize notification trigger recipients | `notifications/trigger/route.ts` | `Promise.allSettled()` across recipients |
| 9 | Add cursor-based pagination to billing cron | `cron/billing/route.ts` | Process N subscriptions per run with cursor |
| 10 | Add dedicated rate limits for booking/payment routes | `rate-limit.ts` | Add rules for `/api/booking` and `/api/payments` |

### Priority 3 - Medium (Plan For)

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| 11 | Add pagination to super admin queries | `super-admin-actions.ts` | Add limit/offset to all list functions |
| 12 | Add default limit to generic query helper | `data/server.ts` | Default `limit(1000)` in `query()` function |
| 13 | Cache chatbot context per clinic | `chat/route.ts` | In-memory cache with 60s TTL |
| 14 | Add per-API-key rate limiting for v1 endpoints | `rate-limit.ts`, `v1/*` | Rate limit by API key, not just IP |
| 15 | Add appointment query pagination to reminders cron | `cron/reminders/route.ts` | Process in clinic-level chunks |
| 16 | Reduce profile query redundancy | `middleware.ts`, `auth.ts` | Cache profile in request headers or short-lived cookie |
| 17 | Add streaming timeout for OpenAI responses | `chat/route.ts` | Monitor time between chunks, abort after 10s idle |

### Quick Wins (Low Effort, Immediate Impact)

1. **Add `AbortSignal.timeout(10000)` to WhatsApp fetch calls** - 2 lines of code change per call
2. **Parallelize `fetchChatbotContext` + `getUser` in chat endpoint** - Wrap in `Promise.all()`
3. **Add `limit(1000)` default to `query()` helper** - 1 line change
4. **Increase billing cron batch size from 10 to 25** - 1 line change

---

*End of Backend & API Performance Analysis*
