# System Scalability Analysis

**Load Assumptions:** 1,000 clinics | 10,000 daily users | High booking activity | Frequent notifications

---

## Executive Summary

| Area | Readiness | First Breaking Point |
|------|-----------|---------------------|
| Database & Connections | **LOW** | ~200 concurrent users |
| API Throughput | **MEDIUM** | ~500 concurrent requests |
| Notification System | **LOW** | ~50 notifications/min |
| File Storage (R2) | **MEDIUM** | ~100 concurrent uploads |
| Cron Jobs (Billing/Reminders) | **LOW** | ~300 clinics |
| Multi-Tenant Queries | **LOW** | ~500 clinics |
| Rate Limiting | **MEDIUM** | ~1,000 req/s |
| **Overall System Readiness** | **LOW** | **~200-300 concurrent users** |

The system will break at approximately **2-3% of target load**. The first failure will be Supabase connection exhaustion from the middleware + rate limiter creating 2-4 DB queries per request.

---

## 1. Load Bottlenecks

### 1.1 Database Connection Exhaustion (CRITICAL)

**The #1 breaking point.** Every request creates a new Supabase client via `createClient()` which establishes a new connection to Supabase.

**Connection cost per request type:**

| Request Type | DB Queries per Request | Source Files |
|---|---|---|
| Any authenticated page | 3-4 | middleware.ts (rate limit + clinic lookup + auth + profile) |
| Booking POST | 8-10 | middleware + validation + slot check + insert + count + audit |
| Chat POST | 4-5 | middleware + rate limit + auth + context fetch |
| Cron reminders | 3 + (2 × N appointments) | route.ts + dispatch per appointment |
| Cron billing | 2 + (3 × N clinics) | route.ts + renewal per clinic |

**Calculations at target load:**

```
10,000 daily users × ~20 requests/user = 200,000 requests/day
200,000 / 86,400 seconds = ~2.3 requests/second average
Peak hours (8am-6pm) = ~5.5 requests/second
Burst peak = ~20-50 requests/second

Each request = 3-4 DB connections (middleware alone)
Peak DB connections = 50 × 4 = 200 simultaneous connections
```

**Supabase free tier limit: 60 connections. Paid tier: 200-500.**

At just 15-50 concurrent users during peak, the connection pool will be exhausted.

**Evidence — middleware.ts lines 254-270, 329-333, 355-372:**
```
Every /api/* request:
  1. Rate limit check → Supabase RPC call (rate-limit.ts:105-116)
  2. Clinic resolution → Supabase query (middleware.ts:329-333)
  3. Auth validation → Supabase auth.getUser() (middleware.ts:355-357)
  4. Profile lookup → Supabase query (middleware.ts:367-371)
= 4 DB round-trips BEFORE the route handler even runs
```

### 1.2 Rate Limiter as a Shared Bottleneck (HIGH)

The distributed rate limiter (`rate-limit.ts`) uses Supabase as its backing store. Every single API request triggers a rate limit check that calls `supabase.rpc("rate_limit_increment", ...)`.

**Problem:** The rate limiter designed to protect the system is itself a bottleneck because it adds a DB query to every request.

**At 1,000 clinics:**
- Every API call = 1 extra Supabase RPC call just for rate limiting
- Rate limit table grows unboundedly (one row per key per window)
- No cleanup/TTL mechanism visible in the code
- In-memory fallback has `maxKeys: 10,000` — will evict entries prematurely at scale

**Evidence — rate-limit.ts lines 105-116:**
```typescript
const { data: rpcResult, error: rpcError } = await supabase
  .rpc("rate_limit_increment", {
    p_key: key,
    p_window_start: windowStart,
    p_reset_at: resetAt,
    p_now: new Date(now).toISOString(),
  });
```

### 1.3 No Connection Pooling (HIGH)

`supabase-server.ts` creates a new `createServerClient()` on every call with no connection pooling or reuse:

```typescript
// supabase-server.ts:13-37
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(...);
}
```

Every `createClient()` call creates a fresh HTTP connection to Supabase. At 50 req/s, that's 200+ simultaneous HTTP connections just from the middleware layer.

### 1.4 API Throughput Limits (MEDIUM)

**Booking endpoint (`/api/booking` POST)** — the heaviest endpoint:

| Step | DB Queries | Blocking? |
|---|---|---|
| Token verification | 0 (crypto only) | No |
| Schema validation | 0 | No |
| `validateBookingRequest()` | 4 (doctors, services, specialties, slots) | Yes — sequential |
| Doctor/service clinic check | 2 (parallel) | Yes |
| Find/create patient | 1-2 | Yes |
| Insert appointment | 1 | Yes |
| Post-insert slot count | 1 | Yes |
| Audit log | 1 | Yes |
| **Total** | **10-11 queries** | |

A single booking request makes 10-11 DB queries. At 1,000 clinics with "high booking activity" (say 50 bookings/hour across all clinics), that's 500-550 queries/hour just from bookings — manageable. But during peak (all clinics booking at once): 1,000 × 3 bookings/hour = 3,000 queries/hour = ~1 query/second — still OK individually, but combined with all other traffic it compounds the connection issue.

---

## 2. Multi-Tenant Scaling

### 2.1 Single Database, No Sharding (CRITICAL)

All 1,000 clinics share a single Supabase database. Every table grows linearly with the number of clinics.

**Projected table sizes at 1,000 clinics:**

| Table | Rows per Clinic | Total Rows | Growth Rate |
|---|---|---|---|
| appointments | 5,000/year | 5,000,000 | ~14,000/day |
| users (patients) | 2,000 | 2,000,000 | ~500/day |
| notifications | 10,000/year | 10,000,000 | ~30,000/day |
| notification_log | 10,000/year | 10,000,000 | ~30,000/day |
| payments | 3,000/year | 3,000,000 | ~8,000/day |
| reviews | 500 | 500,000 | Slow |
| documents | 1,000 | 1,000,000 | ~3,000/day |

### 2.2 Unbounded Queries — No Pagination (CRITICAL)

Multiple data-fetching functions return **all rows** without any pagination:

**`data/server.ts` — unbounded queries:**
```typescript
getAppointments(clinicId)      // ALL appointments for a clinic, no limit
getPatients(clinicId)          // ALL patients, no limit
getClinicUsers(clinicId)       // ALL users, no limit
getPayments(clinicId)          // ALL payments, no limit
getReviews(clinicId)           // ALL reviews, no limit
getDocuments(clinicId)         // ALL documents, no limit
getProducts(clinicId)          // ALL products, no limit
getStock(clinicId)             // ALL stock entries, no limit
getSterilizationLog(clinicId)  // ALL sterilization logs, no limit
getLabOrders(clinicId)         // ALL lab orders, no limit
getWaitingList(clinicId)       // ALL waiting list entries, no limit
getPrescriptions(clinicId)     // ALL prescriptions, no limit
```

**Impact at scale:** A clinic with 5,000 appointments/year will fetch ALL 5,000 rows every time the appointments page loads. After 3 years: 15,000 rows per page load.

**Super admin dashboard (`super-admin-actions.ts:292-309`) is even worse:**
```typescript
// Fetches ALL clinics, ALL patients count, ALL appointments count,
// and ALL completed payments (with amounts) in parallel
const [clinicsRes, patientCountRes, appointmentCountRes, revenueRes] =
  await Promise.all([
    supabase.from("clinics").select("..."),        // ALL 1,000 clinics
    supabase.from("users").select("id", { count: "exact", head: true }), // All patients count
    supabase.from("appointments").select("id", { count: "exact", head: true }), // All appointments
    supabase.from("payments").select("amount").eq("status", "completed"),  // ALL payment amounts
  ]);
```

The `revenueRes` query fetches **every completed payment row** to sum amounts client-side. At 1,000 clinics × 3,000 payments/year = 3,000,000 rows transferred to compute a single number.

### 2.3 Missing Indexes for Multi-Tenant Queries (HIGH)

The `query()` helper in `data/server.ts` dynamically builds queries with `.eq("clinic_id", clinicId)`. Without composite indexes on `(clinic_id, ...)` for each table, these queries become full table scans as data grows.

**Critical missing indexes (likely):**
- `appointments(clinic_id, slot_start)` — used by `getTodayAppointments()`
- `appointments(clinic_id, doctor_id, appointment_date, start_time)` — used by booking slot count
- `notifications(user_id, sent_at)` — used by `getNotifications()`
- `notification_log(appointment_id, channel, status)` — used by reminder idempotency check
- `users(clinic_id, role)` — used everywhere

### 2.4 Tenant Isolation (MEDIUM)

Tenant isolation relies entirely on:
1. **RLS policies** in Supabase (good for security, but adds query overhead)
2. **Application-level `clinic_id` filtering** in every query

**Risk:** If any query misses the `clinic_id` filter, data leaks between clinics. The `getPrescriptions()` function in `data/server.ts:485-513` is suspicious — it queries prescriptions table without a `clinic_id` filter:
```typescript
export async function getPrescriptions(clinicId: string, doctorId?: string) {
  let q = supabase.from("prescriptions").select("*").order("created_at", { ascending: false });
  if (doctorId) { q = q.eq("doctor_id", doctorId); }
  // NOTE: clinicId parameter is received but never used in the query!
}
```

---

## 3. Notification System Scalability

### 3.1 Sequential Channel Processing (CRITICAL)

`notifications.ts` dispatches notifications to each channel **sequentially** within a for-loop:

```typescript
// notifications.ts lines 407-511 (simplified)
for (const channel of channels) {
  if (channel === "whatsapp") {
    const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
    result = await sendWhatsAppMessage(phone, message);
  }
  if (channel === "email") {
    const { sendNotificationEmail } = await import("@/lib/email");
    result = await sendNotificationEmail(email, subject, body);
  }
  if (channel === "sms") {
    const { sendSms } = await import("@/lib/sms");
    result = await sendSms(phone, message);
  }
  if (channel === "in_app") {
    const { insertInAppNotification } = await import("@/lib/notification-persist");
    result = await insertInAppNotification(params);
  }
}
```

**Each channel dispatch is sequential AND uses dynamic imports.** For a notification sent to all 4 channels:
- WhatsApp API call: ~200-500ms
- Email API call (Resend): ~100-300ms
- SMS API call (Twilio): ~200-500ms
- In-app DB insert: ~50-100ms
- Dynamic imports overhead: ~50ms each
- **Total per notification: 750-1,600ms**

### 3.2 No Fetch Timeouts (CRITICAL)

All external API calls (WhatsApp, SMS, email) use raw `fetch()` with **no timeout**:

```typescript
// whatsapp.ts:79-94
const response = await fetch(
  `${META_API_URL}/${config.metaPhoneNumberId}/messages`,
  { method: "POST", headers: {...}, body: JSON.stringify({...}) }
);
// NO AbortController, NO timeout
```

```typescript
// sms.ts:57-64
const response = await fetch(url, {
  method: "POST", headers: {...}, body: formData.toString()
});
// NO AbortController, NO timeout
```

```typescript
// email.ts:62-75
const response = await fetch(RESEND_API_URL, {
  method: "POST", headers: {...}, body: JSON.stringify({...})
});
// NO AbortController, NO timeout
```

**Impact:** If Meta's WhatsApp API goes down or responds slowly, the entire notification pipeline hangs indefinitely. Combined with the sequential processing, one slow channel blocks all subsequent channels.

### 3.3 WhatsApp API Rate Limits (HIGH)

Meta Business API limits:
- **Standard tier:** 250 messages/day (new business accounts)
- **Tier 1:** 1,000 messages/24h
- **Tier 2:** 10,000 messages/24h
- **Tier 3:** 100,000 messages/24h

**At 1,000 clinics with frequent notifications:**
- Appointment reminders: 2 per appointment (24h + 2h)
- Assume 50 appointments/day/clinic = 100 reminders/day/clinic
- Total: 1,000 × 100 = **100,000 WhatsApp messages/day**
- Required: Meta Tier 3 (requires months of gradual quality scaling)

**The code has no rate limiting on outbound WhatsApp messages** — it will hit Meta's rate limit and all subsequent messages will fail silently.

### 3.4 Notification Throughput Calculation

**Reminder cron job runs every 30 minutes:**

```
500 appointments fetched per run (limit in reminders/route.ts:66)
Dispatch batch size: 10 (parallel)
Per notification: ~1-1.6 seconds (3 channels: whatsapp + sms + in_app)
50 batches × 1.6 seconds = 80 seconds per cron run
```

With 1,000 clinics: appointments needing reminders could exceed 500/batch. The `limit(500)` cap means clinics added later may never receive reminders.

### 3.5 In-App Notification N+1 (MEDIUM)

`notification-persist.ts` makes 2 DB queries per in-app notification:
1. Look up user's `clinic_id` (line 36-40)
2. Insert the notification (line 47-60)

When sending bulk notifications (e.g., cron reminders for 500 appointments), that's 1,000 extra DB queries just for the in-app channel.

---

## 4. File Storage (Cloudflare R2)

### 4.1 Full File Buffering in Memory (HIGH)

Upload endpoint (`upload/route.ts:101`) buffers the entire file into memory before uploading to R2:

```typescript
const buffer = Buffer.from(await file.arrayBuffer());
```

**File size limit is 10MB** (line 32). With concurrent uploads:

| Concurrent Uploads | Memory Used |
|---|---|
| 10 | 100 MB |
| 50 | 500 MB |
| 100 | 1 GB |
| 200 | 2 GB (likely OOM on standard instances) |

During peak hours, if 50 clinic admins upload photos/documents simultaneously, the server consumes 500MB just for upload buffers — before accounting for Node.js overhead, other request processing, etc.

### 4.2 R2 API Rate Limits (MEDIUM)

Cloudflare R2 limits:
- **Class A operations (PUT):** 10 million/month free
- **Class B operations (GET):** 10 million/month free
- **Rate limit:** 1,000 requests/second per bucket

At 1,000 clinics:
- Uploads: ~5/day/clinic = 5,000/day = 150,000/month → well within limits
- Downloads (avatars, logos, documents): ~100/day/clinic = 100,000/day = 3,000,000/month → within limits

**R2 itself scales fine.** The bottleneck is the server-side memory buffering, not R2.

### 4.3 Singleton S3 Client (GOOD)

The R2 client (`r2.ts:40-63`) uses a singleton pattern with config hash validation. This is efficient — only one S3 client instance exists at any time, and it's recreated only when credentials change. This is one of the few well-scaled components.

### 4.4 No Streaming Upload Support (MEDIUM)

The `uploadToR2()` function accepts `Buffer | ReadableStream | Uint8Array` but the upload route always passes a Buffer. The magic byte validation (`validateFileContent`) requires the entire file in memory, preventing streaming.

**Fix:** Validate magic bytes from the first 16 bytes of the stream, then pipe the rest directly to R2.

---

## 5. Cron Job Scalability

### 5.1 Billing Cron (HIGH)

**`cron/billing/route.ts`** processes all due renewals:

```typescript
// Fetches ALL active/past_due subscriptions with expired periods
const { data: subscriptions } = await supabase
  .from("clinic_subscriptions")
  .select("clinic_id, current_period_end, status")
  .in("status", ["active", "past_due"])
  .lte("current_period_end", today);
// No limit!
```

**Per renewal (`processRenewal`):**
1. Fetch subscription details (1 query)
2. Stripe API call for payment (1 external call, ~1-3 seconds)
3. Update subscription period (1 query)
4. Log billing event (1 query)
= ~3 DB queries + 1 Stripe call per clinic

**Batch size is 10** (`BATCH_SIZE = 10`), processed with `Promise.allSettled`.

**At 1,000 clinics (worst case, all renewing same day):**
```
1,000 clinics / 10 per batch = 100 batches
Each batch: ~3 seconds (Stripe + DB)
Total: ~300 seconds = 5 minutes
```

This is manageable IF the cron timeout is long enough. However, **Cloudflare Workers have a 30-second CPU time limit** (mentioned in comments as the cron trigger). The billing cron would fail after processing ~100 clinics.

**No resume mechanism:** If the cron times out at clinic #100, the next run at 2am UTC will process clinics #1-100 again (already renewed, so `needsRenewal()` returns false — no harm) plus #101-200. But it takes 10 days to process all 1,000 clinics.

### 5.2 Reminders Cron (HIGH)

**`cron/reminders/route.ts`** runs every 30 minutes:

```typescript
// Hard limit of 500 appointments per run
.limit(500);
```

**Processing flow:**
1. Fetch up to 500 upcoming appointments (1 query with joins)
2. Batch idempotency check for all 500 (1 query)
3. For each qualifying appointment, dispatch notification (3 channels each)
4. Dispatch in batches of 10

**At 1,000 clinics, 50 appointments/day/clinic:**
- Total daily appointments: 50,000
- Appointments in next 24h window: ~50,000
- Appointments needing 2h reminder (within 1.5-2.5h window): ~2,000-3,000
- Appointments needing 24h reminder (within 22-25h window): ~6,000-8,000
- **Total per 30-min run: ~500-1,000 qualifying appointments**

The `limit(500)` cap means many clinics will miss reminders. And processing 500 notifications:
```
500 appointments × 3 channels × ~500ms per channel = ~750 seconds
Even with batch size 10: 50 batches × 1.5 seconds = ~75 seconds
```

This exceeds Cloudflare Worker timeout. **Reminders will fail silently for later clinics.**

### 5.3 No Dead Letter Queue (MEDIUM)

Failed cron operations are logged but not retried. If a billing renewal fails due to a transient Stripe error, it's marked `past_due` and the clinic loses service until the next daily run.

---

## 6. External API Integration Bottlenecks

### 6.1 Stripe Integration (HIGH)

**`subscription-billing.ts:390-405`** — Stripe payment call:
- No timeout on `fetch()` call
- Idempotency key is good (prevents duplicate charges)
- But no retry with exponential backoff
- One Stripe call per clinic renewal — not batched

**Stripe rate limits:** 100 read requests/second, 100 write requests/second. At 10 renewals/batch (parallel), this is fine. But if all 1,000 renewals happen in one cron run (5 min), that's ~3.3 writes/second — well within limits.

**The bottleneck is cron timeout, not Stripe rate limits.**

### 6.2 Cloudflare Workers AI (MEDIUM)

**`chat/route.ts:163-176`** — Chat endpoint calls Cloudflare AI:
- No timeout on the AI inference call
- AI inference can take 2-10 seconds for LLama 3.1 8B
- Rate limit: 15 requests/60s per IP (chatLimiter)
- But no global rate limit across all users hitting the AI endpoint

**Cloudflare Workers AI free tier:** 10,000 neurons/day. A single Llama 3.1 8B request uses ~1,000 neurons. So: **10 free AI chat messages/day total** — not per clinic.

At 1,000 clinics with "smart" intelligence enabled, the free tier would be exhausted in seconds.

### 6.3 OpenAI/Advanced Chat (MEDIUM)

**`chat/route.ts:213-226`** — Streaming OpenAI response:
- Uses streaming (good for responsiveness)
- No timeout on initial connection
- `max_tokens: 500` limits response size (good)
- Cost at scale: GPT-4o-mini at ~$0.15/1M input tokens. 1,000 clinics × 100 chats/day = 100,000 chats/day = ~$15/day.

---

## 7. Failure Point Cascade Order

Based on the analysis, here is the order in which components will fail as load increases:

### Stage 1: ~50-200 concurrent users (5-20% of target)

| # | Component | Failure Mode |
|---|---|---|
| 1 | **Supabase connections** | Connection pool exhausted from 4 queries/request in middleware |
| 2 | **Rate limiter DB** | Rate limit table grows, RPC calls add latency, connections compound |
| 3 | **Cron reminders** | Timeout before processing all appointments, clinics miss reminders |

### Stage 2: ~200-500 concurrent users (20-50% of target)

| # | Component | Failure Mode |
|---|---|---|
| 4 | **Unbounded queries** | Page loads for large clinics timeout (5,000+ rows per query) |
| 5 | **Cron billing** | Cannot process all renewals in one run, takes days to catch up |
| 6 | **Notification pipeline** | Sequential processing causes queue buildup, timeouts |

### Stage 3: ~500-2,000 concurrent users (50-100% of target)

| # | Component | Failure Mode |
|---|---|---|
| 7 | **Memory exhaustion** | Concurrent file uploads + unbounded query results exhaust RAM |
| 8 | **WhatsApp API limits** | Meta rate limits hit, all clinics' messages start failing |
| 9 | **Super admin dashboard** | Fetching all payments for revenue sum causes timeouts |

### Stage 4: 10,000+ daily users (target load)

| # | Component | Failure Mode |
|---|---|---|
| 10 | **Database performance** | 10M+ row tables with missing indexes, slow queries everywhere |
| 11 | **Cloudflare AI quota** | Free tier exhausted in minutes |
| 12 | **Complete system degradation** | Cascading timeouts as every component contends for DB connections |

---

## 8. High-Risk Components Summary

### CRITICAL (System will break)

| Component | Risk | Impact | Effort to Fix |
|---|---|---|---|
| Supabase connection exhaustion | 4 DB queries per request in middleware | System-wide failure | HIGH — need connection pooling, caching |
| Unbounded queries in data/server.ts | 12+ functions with no limit/pagination | OOM, timeouts | MEDIUM — add pagination |
| Sequential notification dispatch | 750-1,600ms per notification | Reminder cron timeouts | MEDIUM — parallelize channels |
| No fetch timeouts on external APIs | Indefinite hangs on WhatsApp/SMS/email/Stripe | Thread starvation | LOW — add AbortController |

### HIGH (System will degrade)

| Component | Risk | Impact | Effort to Fix |
|---|---|---|---|
| Rate limiter as DB bottleneck | Extra Supabase RPC per API request | Compounds connection exhaustion | MEDIUM — use Redis/in-memory |
| Cron job timeout limits | Cloudflare Worker 30s CPU limit | Billing/reminders incomplete | HIGH — need queue-based processing |
| File upload memory buffering | 10MB × concurrent uploads | OOM crashes | MEDIUM — streaming upload |
| Super admin revenue calculation | Fetches ALL payment rows | Dashboard unusable | LOW — use DB-level SUM |

### MEDIUM (Will cause issues at scale)

| Component | Risk | Impact | Effort to Fix |
|---|---|---|---|
| WhatsApp outbound rate limits | No outbound rate limiting | Messages silently fail | MEDIUM — add outbound queue |
| Dynamic imports in notifications | ~50ms overhead per channel | Adds latency | LOW — static imports |
| In-app notification N+1 | 2 queries per notification | Slow bulk notifications | LOW — batch insert |
| `getPrescriptions()` missing clinic filter | `clinicId` param unused | Data leak between clinics | LOW — add filter |

---

## 9. Recommendations — Priority Order

### P0 — Must fix before 100 clinics

1. **Add connection pooling / Supabase connection reuse**
   - Use Supabase connection pooler (PgBouncer) via the pooler URL
   - Cache Supabase client instances per request instead of creating 4+ per request
   - Move rate limiting to Redis or edge-level (Cloudflare) instead of Supabase

2. **Add pagination to all data queries**
   - Every function in `data/server.ts` that returns arrays needs `limit` + `offset`
   - Default page size: 50-100 rows
   - Super admin dashboard: use `SUM()` RPC for revenue instead of fetching all rows

3. **Add fetch timeouts to all external API calls**
   - WhatsApp, SMS, email, Stripe, Cloudflare AI, OpenAI
   - Use `AbortController` with 10-second timeout
   - Add retry with exponential backoff for transient failures

### P1 — Must fix before 500 clinics

4. **Parallelize notification channel dispatch**
   - Send WhatsApp, SMS, email, and in-app simultaneously with `Promise.allSettled()`
   - Reduces per-notification time from ~1.5s to ~500ms

5. **Replace cron jobs with queue-based processing**
   - Use a proper job queue (BullMQ, Cloudflare Queues, or Supabase Edge Functions)
   - Process billing renewals and reminders as individual queue items
   - Eliminates timeout issues and enables retry/dead-letter handling

6. **Add outbound rate limiting for WhatsApp/SMS**
   - Implement token bucket or leaky bucket for outbound messages
   - Respect Meta's tier limits (start at 1,000/day, scale gradually)
   - Queue messages that exceed rate limits for later delivery

### P2 — Must fix before 1,000 clinics

7. **Stream file uploads instead of buffering**
   - Validate magic bytes from first 16 bytes
   - Pipe remaining stream directly to R2
   - Reduces memory usage from 10MB to ~64KB per upload

8. **Add composite database indexes**
   - `appointments(clinic_id, slot_start)`
   - `appointments(clinic_id, doctor_id, appointment_date, start_time)`
   - `users(clinic_id, role)`
   - `notifications(user_id, sent_at DESC)`
   - `notification_log(appointment_id, channel, status)`
   - `payments(clinic_id, status)`

9. **Fix `getPrescriptions()` data leak**
   - Add `.eq("clinic_id", clinicId)` to the query
   - The `clinicId` parameter is received but never used

10. **Cache clinic resolution in middleware**
    - Subdomain → clinic_id mapping changes rarely
    - Cache for 5-10 minutes to eliminate 1 DB query per request
    - Use edge cache or in-memory Map with TTL

---

## 10. System Readiness Assessment

| Criteria | Status |
|---|---|
| Can handle 1,000 clinics? | **NO** — DB connections exhaust at ~200 concurrent users |
| Can handle 10,000 daily users? | **NO** — Unbounded queries will OOM/timeout for active clinics |
| Can handle high booking activity? | **PARTIAL** — Booking endpoint is well-designed with TOCTOU protection, but 10-11 DB queries per booking is expensive |
| Can handle frequent notifications? | **NO** — Sequential processing + no timeouts + cron limits = dropped notifications |
| Multi-tenant data isolation? | **MOSTLY** — RLS + clinic_id filtering, but `getPrescriptions()` has a data leak |
| External API resilience? | **NO** — No timeouts, no retries, no circuit breakers on any external call |

### Overall: **LOW READINESS**

The system is architected well for a single-clinic or small-scale deployment (10-50 clinics, ~500 users). The code quality is good — there's proper input validation, CSRF protection, idempotency keys, and reasonable security measures. However, the fundamental architecture (new DB connection per operation, unbounded queries, sequential external calls, cron-based batch processing) will not scale to the target of 1,000 clinics / 10,000 users without the P0 fixes above.

**Estimated effort to reach production readiness:** 3-4 weeks of focused backend work on P0 + P1 items.
