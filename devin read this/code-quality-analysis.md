# Code Quality & Implementation Patterns Analysis

> **Scope**: `data/client.ts`, `data/server.ts`, `data/specialists.ts`, API routes (`src/app/api/`), shared utilities (`src/lib/`)
> **Date**: March 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Critical Code Smells](#2-critical-code-smells)
3. [Risky Patterns](#3-risky-patterns)
4. [Maintainability Issues](#4-maintainability-issues)
5. [Type Safety Issues](#5-type-safety-issues)
6. [Error Handling Analysis](#6-error-handling-analysis)
7. [Reuse vs Repetition](#7-reuse-vs-repetition)
8. [Inconsistent Coding Styles](#8-inconsistent-coding-styles)
9. [Hardcoded Values Inventory](#9-hardcoded-values-inventory)
10. [Summary & Risk Matrix](#10-summary--risk-matrix)

---

## 1. Executive Summary

The codebase contains **7,500+ lines** across three data-layer files (`client.ts`, `server.ts`, `specialists.ts`) that form the backbone of all database operations. While the code is functional and uses some good patterns (Zod validation on API routes, `withAuth` middleware, generic query helpers), there are systemic quality issues that compound as the codebase grows.

**Top 5 Findings by Severity:**

| # | Finding | Severity | Files Affected |
|---|---------|----------|---------------|
| 1 | Silent error swallowing in all fetch helpers | Critical | `client.ts`, `server.ts`, `specialists.ts` |
| 2 | `client.ts` is a 5,115-line monolith with massive duplication | High | `client.ts` |
| 3 | Triplicated `fetchRows()` helper across 3 files | High | `client.ts`, `server.ts`, `specialists.ts` |
| 4 | Inconsistent mutation return types | Medium | `client.ts`, `server.ts` |
| 5 | 50+ hardcoded magic values scattered throughout | Medium | `client.ts`, `server.ts`, API routes |

---

## 2. Critical Code Smells

### 2.1 Silent Error Swallowing in `fetchRows()` (Critical)

The foundational query helper in `client.ts` **silently discards all database errors** and returns an empty array:

```typescript
// src/lib/data/client.ts:69-96
function fetchRows<T>(
  table: TableName,
  options: { ... } = {},
): Promise<T[]> {
  const supabase = createClient();
  let query = supabase.from(table).select(options.select ?? "*");
  // ... filter application ...
  return query.then((res) => res.data ?? []);  // <-- res.error is NEVER checked
}
```

**Impact**: When a query fails (network error, RLS violation, invalid column), the UI silently shows "no data" instead of an error. This makes debugging production issues extremely difficult because failures look identical to "empty results."

**Contrast with `server.ts`**: The server-side `query<T>()` at least logs the error:

```typescript
// src/lib/data/server.ts:49-54
const { data, error } = await q;
if (error) {
  logger.warn("Query failed", { context: "data/server", error });
  return [];  // Still returns empty array, but at least logs
}
```

**The `specialists.ts` file** copies the `server.ts` approach (log + return empty):

```typescript
// src/lib/data/specialists.ts:35-40
const { data, error } = await q;
if (error) {
  logger.warn("Query failed", { context: "data/specialists", error });
  return [];
}
```

**Three files, three slightly different error handling strategies for the same pattern.**

### 2.2 Global Mutable State Without Error Handling (Critical)

`client.ts` uses module-level mutable variables as a shared cache:

```typescript
// src/lib/data/client.ts:11-12 (implicit), used at lines 164-184
let _userMap: Map<string, { id: string; name: string; phone: string; email: string }> | null = null;
let _serviceMap: Map<string, { id: string; name: string }> | null = null;
let _userCache: { clinicId: string; timestamp: number } | null = null;
```

The `ensureLookups()` function populates these globals:

```typescript
// src/lib/data/client.ts:164-184
async function ensureLookups(clinicId: string): Promise<void> {
  if (_userCache && _userCache.clinicId === clinicId && Date.now() - _userCache.timestamp < 5 * 60 * 1000) {
    return;
  }
  const [usersRes, servicesRes] = await Promise.all([
    supabase.from("users").select("id, name, phone, email").eq("clinic_id", clinicId),
    supabase.from("services").select("id, name").eq("clinic_id", clinicId),
  ]);
  _userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u]));
  _serviceMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s]));
  _userCache = { clinicId, timestamp: Date.now() };
}
```

**Problems:**
1. `usersRes.error` and `servicesRes.error` are never checked -- if either query fails, the maps get populated with empty data
2. Global state means **any tab/component sharing this module sees the same cache** -- switching between clinics could show stale data from the wrong clinic during the 5-minute window
3. No concurrency guard: if two components call `ensureLookups()` simultaneously, they race to overwrite globals
4. The hardcoded `5 * 60 * 1000` (5 minutes) cache TTL is a magic number with no configuration option

### 2.3 The 159-Line `fetchAnalytics()` Function (High)

```typescript
// src/lib/data/client.ts:2339-2497 (159 lines)
export async function fetchAnalytics(clinicId: string): Promise<AnalyticsData> {
  // Fetches 4 tables with SELECT *
  // Then does 159 lines of in-memory aggregation:
  // - Daily stats for last 20 days
  // - Monthly stats for last 6 months
  // - Service breakdown
  // - Day-of-week heatmap
  // - Hourly heatmap with hardcoded time slots
}
```

This function does **too many things**:
- Fetches raw data from 4 tables (appointments, payments, reviews, patients)
- Computes daily aggregations
- Computes monthly aggregations
- Computes service breakdowns
- Computes heatmaps (day-of-week x hour)
- Formats all results

Each of these could be a separate, testable function. The current monolithic structure makes it impossible to unit test individual aggregation logic.

### 2.4 The `fetchClinicCenterDashboardKPIs()` Indentation Smell (Medium)

```typescript
// src/lib/data/client.ts:5028-5114
export async function fetchClinicCenterDashboardKPIs(clinicId: string): Promise<ClinicCenterDashboardKPIs> {
  const supabase = createClient();

  const [deptRes, bedRes, admissionRes, paymentsRes] = await Promise.all([
  supabase.from("departments").select("...").eq("clinic_id", clinicId).eq("is_active", true),  // <-- wrong indentation
  supabase.from("beds").select("...").eq("clinic_id", clinicId),
  supabase.from("admissions").select("...").eq("clinic_id", clinicId),
  supabase.from("payments").select("...").eq("clinic_id", clinicId).eq("status", "completed"),
  ]);
```

The `Promise.all` array contents are at the wrong indentation level (aligned with the outer `const` instead of being indented inside the array). While not a runtime issue, it indicates this function was written hastily and never reviewed.

---

## 3. Risky Patterns

### 3.1 Inconsistent Status String Comparisons (High Risk)

The analytics function compares status strings using **both underscore and hyphen formats**:

```typescript
// src/lib/data/client.ts:2375-2377
if (a.status === "no_show" || a.status === "no-show") day.noShows++;
if (a.booking_source === "walk-in" || a.booking_source === "walk_in") day.walkIns++;
if (a.booking_source === "online" || a.booking_source === "website") day.onlineBookings++;
```

This reveals that **the database has inconsistent status values**. Instead of normalizing at the data layer, the code adds OR-checks that will inevitably miss new variants. Elsewhere in the codebase, `APPOINTMENT_STATUS` and `BOOKING_SOURCE` constants exist (`src/lib/types/database.ts`), but this function doesn't use them.

**Risk**: Any new status format added to the database will silently be excluded from analytics until someone manually adds another OR condition.

### 3.2 `SELECT *` on Large Tables (Medium Risk)

Several analytics and dashboard functions fetch entire tables with `SELECT *`:

```typescript
// src/lib/data/client.ts:2341-2346
const [apptsRes, paymentsRes, reviewsRes, patientsRes] = await Promise.all([
  supabase.from("appointments").select("*").eq("clinic_id", clinicId),
  supabase.from("payments").select("*").eq("clinic_id", clinicId).eq("status", "completed"),
  supabase.from("reviews").select("*").eq("clinic_id", clinicId),
  supabase.from("users").select("id, created_at").eq("clinic_id", clinicId).eq("role", "patient"),
]);
```

For appointments and payments, **all columns of every row** are fetched into memory. This includes columns like `notes`, `cancellation_reason`, and other text fields that aren't used in the aggregation. The patients query correctly selects only `id, created_at`, proving the developer knows how to do this -- the other queries just weren't optimized.

### 3.3 Date String Manipulation via `.split("T")[0]` (Medium Risk)

The pattern `.toISOString().split("T")[0]` appears **50+ times** across the codebase:

```typescript
// Examples from client.ts
const todayStr = new Date().toISOString().split("T")[0];              // line 230
const dateStr = d.toISOString().split("T")[0];                        // line 2367
const displayDate = apptDatetime.toISOString().split("T")[0];         // cron/reminders/route.ts:168
const appointment_date = startDate.toISOString().split("T")[0];       // server.ts:988
```

**Problems:**
- `toISOString()` always returns UTC. For a Moroccan clinic (Africa/Casablanca), a 23:30 local appointment on March 15 becomes March 16 in UTC. This silently produces wrong dates.
- No utility function exists for this operation despite 50+ usages.
- Some routes correctly use timezone-aware date formatting (`new Date().toLocaleDateString("en-CA", { timeZone: tz })` in `booking/route.ts:130`), proving the team knows the correct approach -- but most code uses the wrong one.

### 3.4 Proportional Revenue Distribution (Business Logic Risk)

```typescript
// src/lib/data/client.ts:5077-5093
// Distribute total revenue proportionally across departments based on active admissions
const totalActiveByDept = new Map<string, number>();
for (const adm of admissions) {
  const current = totalActiveByDept.get(adm.department_id) ?? 0;
  totalActiveByDept.set(adm.department_id, current + 1);
}
const totalAdmissions = admissions.length || 1;
const totalRevenue = payments.reduce((s, p) => s + (p.amount ?? 0), 0);

for (const [deptId, admCount] of totalActiveByDept) {
  const share = Math.round((admCount / totalAdmissions) * totalRevenue);
  // ...
}
```

Revenue is distributed **proportionally by admission count** rather than by actual department. This means a department with many short admissions gets more "revenue" than one with fewer but higher-value admissions. This is a business logic smell -- the comment even acknowledges it's an approximation rather than using actual payment-to-department linkage.

---

## 4. Maintainability Issues

### 4.1 The 5,115-Line `client.ts` Monolith

`client.ts` contains everything from basic CRUD operations to complex analytics, medical calculations, and domain-specific logic for 10+ medical specialties. A single file handles:

- General clinic operations (appointments, patients, doctors, services)
- Analytics and dashboard stats
- Lab test management
- Radiology management
- Obstetrics/gynecology (gestational age calculation, pregnancy tracking)
- Insurance management
- Custom fields
- Clinic center/hospital operations (beds, departments, admissions)

**Line count by domain (approximate):**

| Domain | Lines | % of File |
|--------|-------|-----------|
| General CRUD (appointments, patients, etc.) | ~1,200 | 23% |
| Type definitions & interfaces | ~800 | 16% |
| Analytics & dashboards | ~400 | 8% |
| Lab test operations | ~500 | 10% |
| Radiology operations | ~400 | 8% |
| OB/GYN operations | ~600 | 12% |
| Insurance operations | ~300 | 6% |
| Mutation functions | ~500 | 10% |
| Hospital/clinic center operations | ~200 | 4% |
| Miscellaneous | ~215 | 4% |

### 4.2 Deeply Nested Mapping Logic

Many functions have 3-4 levels of nesting in their mapping logic:

```typescript
// src/lib/data/client.ts (fetchAnalytics, simplified)
for (const appt of appointments) {
  const dateStr = new Date(appt.slot_start).toISOString().split("T")[0];
  const day = dailyMap.get(dateStr);
  if (day) {
    day.appointments++;
    if (a.status === "no_show" || a.status === "no-show") {
      day.noShows++;
    }
    if (a.booking_source === "walk-in" || a.booking_source === "walk_in") {
      day.walkIns++;
    }
    // ... more nested conditions
  }
}
```

### 4.3 Specialist Module Copy-Paste Pattern

`specialists.ts` (1,181 lines) follows an extremely rigid copy-paste template for every specialist type. Each specialist section has:
1. An interface definition
2. A fetch function
3. A create function
4. (Sometimes) an update function

The pattern is identical across all 7+ specialist types (dermatologist, cardiologist, ENT, orthopedist, psychiatrist, neurologist, etc.):

```typescript
// Pattern repeated 20+ times in specialists.ts:
export async function fetchXXX(clinicId: string, patientId?: string): Promise<XXXView[]> {
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (patientId) eq.push(["patient_id", patientId]);
  const rows = await fetchRows<{...}>("table_name", { eq, order: ["date_col", { ascending: false }] });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: "",  // <-- Always hardcoded to empty string!
    // ... field mapping
  }));
}
```

**Notable smell**: Every `fetchXXX` function sets `patientName: ""` (empty string), meaning the name is never populated from the database. This suggests the `patientName` field in all these view interfaces is dead code that was added "for future use" but never implemented.

### 4.4 `cron/reminders/route.ts` -- 225-Line GET Handler

The reminder cron job is a single 225-line function that:
1. Authenticates the cron secret
2. Queries appointments with complex joins
3. Batch-checks idempotency
4. Parses appointment datetimes with fallback logic
5. Determines reminder type (2h vs 24h)
6. Dispatches notifications in parallel batches
7. Batch-inserts notification logs

While each step is individually well-implemented, the function is too long to easily reason about. The datetime parsing logic alone (lines 119-134) has 3 branches with timezone implications.

---

## 5. Type Safety Issues

### 5.1 Unsafe Type Assertions with `as`

The codebase uses `as` type assertions extensively instead of proper type narrowing:

```typescript
// src/lib/data/server.ts:37
q = q.eq(col, val as string);  // val is `unknown`, cast to `string` without validation

// src/lib/data/server.ts:41
q = q.in(opts.inFilter[0], opts.inFilter[1] as string[]);  // unknown[] cast to string[]

// src/lib/data/server.ts:54
return (data ?? []) as T[];  // Supabase returns unknown, cast to T[] without validation

// src/lib/data/server.ts:886-887
const payments = (paymentsRes.data ?? []) as { amount: number }[];
const reviews = (reviewsRes.data ?? []) as { stars: number }[];

// src/lib/data/server.ts:929
const clinics = (clinicsRes.data ?? []) as ClinicRow[];

// src/lib/data/server.ts:931
(sum, p) => sum + ((p as { amount: number }).amount ?? 0),  // double assertion
```

**Total `as` assertions across data layer files: ~60+**

### 5.2 `Record<string, unknown>` for Dynamic Updates

Mutation functions build update payloads using `Record<string, unknown>`, bypassing TypeScript's type system entirely:

```typescript
// src/lib/data/server.ts:955
const updateData: Record<string, unknown> = { status };
if (status === "cancelled") {
  updateData.cancelled_at = new Date().toISOString();
  // ...
}

// src/lib/data/server.ts:1092
const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
```

This pattern means TypeScript cannot catch typos in column names or wrong value types.

### 5.3 Loose String Types for Status Fields

Status fields are typed as `string` instead of union types:

```typescript
// src/lib/data/server.ts:596
status: string;  // Could be "pending" | "active" | "completed" | ...

// src/lib/data/server.ts:652
status: string;  // Could be "pending" | "in_progress" | "completed" | ...

// src/lib/data/server.ts:677
status: string;  // Could be "paid" | "pending" | "overdue" | ...
```

While `APPOINTMENT_STATUS` and similar constants exist in `types/database.ts`, the row interfaces in `server.ts` don't use them. This means the type system doesn't catch invalid status transitions.

### 5.4 The `notifications.ts` Index Signature Escape Hatch

```typescript
// src/lib/notifications.ts:51
export interface TemplateVariables {
  patient_name?: string;
  doctor_name?: string;
  // ... 13 typed fields
  [key: string]: string | undefined;  // <-- Allows ANY key, defeating the purpose of listing fields
}
```

The index signature makes the explicit field list purely documentary. Any misspelled variable name (e.g., `patientName` instead of `patient_name`) would compile without error.

---

## 6. Error Handling Analysis

### 6.1 Three Inconsistent Patterns for Mutation Results

The codebase uses **three different return types** for mutation functions with no consistent pattern:

**Pattern A: `boolean` return** (most common in `server.ts`)
```typescript
// src/lib/data/server.ts:949-968
export async function updateAppointmentStatus(...): Promise<boolean> {
  // ...
  if (error) { logger.warn(...); return false; }
  return true;
}
```

**Pattern B: `T | null` return** (used when the caller needs the created entity)
```typescript
// src/lib/data/server.ts:970-1002
export async function createAppointment(...): Promise<AppointmentRow | null> {
  // ...
  if (error) { logger.warn(...); return null; }
  return row as AppointmentRow;
}
```

**Pattern C: `string | null` return** (used in `specialists.ts`)
```typescript
// src/lib/data/specialists.ts:80-90
export async function createSkinPhoto(...): Promise<string | null> {
  // ...
  if (error) { logger.warn(...); return null; }
  return result?.id ?? null;
}
```

**Pattern D: `MutationResult<T>` return** (used in some `client.ts` mutations)
```typescript
// client.ts uses this in some places (not shown in all mutations)
type MutationResult<T> = { success: true; data: T } | { success: false; error: string };
```

**The problem**: Callers must know which pattern each function uses. Boolean returns provide no error message. Null returns are ambiguous (was it "not found" or "server error"?). There's no way to distinguish error types without looking at the implementation.

### 6.2 API Route Error Handling -- Good but Verbose

API routes follow a consistent but verbose pattern:

```typescript
// Seen in booking/route.ts, notifications/route.ts, chat/route.ts, etc.
try {
  // ... business logic ...
} catch (err) {
  logger.warn("Operation failed", { context: "xxx", error: err });
  return NextResponse.json({ error: "Failed to ..." }, { status: 500 });
}
```

This is **good practice** but the `catch` blocks are identical across all routes. A shared error handler would reduce the 5-line catch block to a single function call.

### 6.3 `void` Operator to Suppress Error Use

```typescript
// src/app/api/onboarding/route.ts:130, 150, 169
void clinicError;   // Explicitly suppressing the error variable
void userError;
void deleteError;
```

The `void` operator is used to tell the linter "I know I'm not using this variable." While this avoids lint warnings, it also means the **error details are discarded** -- they're not logged, not returned to the user, and can't be debugged in production.

---

## 7. Reuse vs Repetition

### 7.1 Triplicated `fetchRows()` / `query()` Helper

The generic query helper is implemented **three times** with slight variations:

| File | Function | Error Handling | Extra Features |
|------|----------|---------------|----------------|
| `client.ts:69` | `fetchRows<T>()` | None (returns `[]`) | `inFilter`, `limit` |
| `server.ts:22` | `query<T>()` | Logs warning, returns `[]` | `filters` (unused?), `inFilter` |
| `specialists.ts:17` | `fetchRows<T>()` | Logs warning, returns `[]` | No `inFilter` |

All three could be a single shared utility.

### 7.2 Duplicated Lab Order Mapping (Exact Copy-Paste)

Two functions in `client.ts` are nearly identical except for one filter:

```typescript
// src/lib/data/client.ts:3030-3074
export async function fetchLabTestOrders(clinicId: string): Promise<LabTestOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LabTestOrderRaw>("lab_test_orders", {
    eq: [["clinic_id", clinicId]],               // <-- only difference
    order: ["created_at", { ascending: false }],
  });
  // ... 40 lines of identical mapping logic ...
}

// src/lib/data/client.ts:3076-3120
export async function fetchPatientLabOrders(clinicId: string, patientId: string): Promise<LabTestOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LabTestOrderRaw>("lab_test_orders", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],  // <-- adds patient filter
    order: ["created_at", { ascending: false }],
  });
  // ... 40 lines of identical mapping logic ...
}
```

The mapping from `LabTestOrderRaw` to `LabTestOrderView` (including the items sub-query and grouping logic at lines 3043-3048 / 3089-3094) is **completely duplicated**. A single function with an optional `patientId` parameter would eliminate ~45 lines.

### 7.3 Duplicated Cancellation Check Logic

`booking/cancel/route.ts` duplicates the "can this appointment be cancelled?" check between POST and GET handlers:

```typescript
// POST handler (lines 38-43)
if (appt.status === APPOINTMENT_STATUS.CANCELLED || appt.status === APPOINTMENT_STATUS.COMPLETED || appt.status === APPOINTMENT_STATUS.RESCHEDULED) {
  return NextResponse.json({ error: "Appointment cannot be cancelled..." }, { status: 400 });
}

// GET handler (lines 138-143) -- identical check
if (appt.status === APPOINTMENT_STATUS.CANCELLED || appt.status === APPOINTMENT_STATUS.COMPLETED || appt.status === APPOINTMENT_STATUS.RESCHEDULED) {
  return NextResponse.json({ canCancel: false, reason: "Appointment cannot be cancelled..." });
}
```

The cancellation window check (hours calculation) is also duplicated between POST (lines 53-54) and GET (lines 152-153).

### 7.4 Repeated `patientName: ""` in specialists.ts

Every fetch function in `specialists.ts` maps `patientName: ""` as a placeholder:

```
Line 70:  patientName: "",    // fetchSkinPhotos
Line 117: patientName: "",    // fetchSkinConditions
Line 178: patientName: "",    // fetchECGRecords
Line 317: patientName: "",    // fetchHearingTests
Line 362: patientName: "",    // fetchENTExams
// ... continues for all 20+ fetch functions
```

This means every view interface declares a `patientName: string` field that is **always empty**. Either the field should be removed from the interfaces, or it should be populated via a lookup (like `client.ts` does with `_userMap`).

### 7.5 Repeated Mutation Boilerplate

Every mutation in `specialists.ts` follows this exact template:

```typescript
export async function createXXX(data: { ... }): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from("table").insert(data).select("id").single();
  if (error) { logger.warn("Query failed", { context: "data/specialists", error }); return null; }
  return result?.id ?? null;
}
```

This exact 4-line body is repeated **20+ times**. A generic `insertRow<T>(table, data)` helper would eliminate all of them.

---

## 8. Inconsistent Coding Styles

### 8.1 `function` vs `const` for Route Handlers

API routes mix two styles for handler exports:

**Style A: Named function export** (used in `booking/route.ts`, `cron/reminders/route.ts`, `chat/route.ts`)
```typescript
export async function POST(request: NextRequest) { ... }
export async function GET(request: NextRequest) { ... }
```

**Style B: Const arrow with `withAuth` wrapper** (used in `notifications/route.ts`, `payments/cmi/route.ts`, `booking/cancel/route.ts`)
```typescript
export const POST = withAuth(async (request, { supabase, profile }) => { ... }, STAFF_ROLES);
```

This inconsistency isn't just stylistic -- it reflects that **some routes are authenticated and some aren't**. The pattern itself is fine, but it's not immediately clear from reading a route file which approach should be used.

### 8.2 Error Message Conventions

Error messages in API responses vary in format:

```typescript
// Sentence case with period (some routes)
{ error: "Appointment not found" }

// Instruction-style (booking/route.ts)
{ error: "Booking verification required. Call POST /api/booking/verify first." }

// Technical detail (onboarding/route.ts)
{ error: "Failed to create admin user. Please try again." }

// Single phrase (many routes)
{ error: "Failed to cancel appointment" }
```

### 8.3 Import Style for Supabase Client

```typescript
// client.ts -- imports from client module
import { createClient } from "@/lib/supabase-client";

// server.ts -- imports from server module
import { createClient } from "@/lib/supabase-server";

// specialists.ts -- imports from client module
import { createClient } from "@/lib/supabase-client";
```

Both `client.ts` and `specialists.ts` use the browser Supabase client, while `server.ts` uses the server-side one. The function names are identical (`createClient`), which makes it easy to accidentally import the wrong one.

### 8.4 Inconsistent Timestamp Generation

```typescript
// Pattern A: Inline ISO string
new Date().toISOString()                    // Used in server.ts mutations

// Pattern B: Date.now() for epoch comparison
Date.now() - _userCache.timestamp           // Used in client.ts cache

// Pattern C: Date.now().toString(36) for IDs
`RAD-${Date.now().toString(36).toUpperCase()}`  // server.ts:1070
`ord_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`  // payments/cmi/route.ts:68
```

Order/reference number generation uses different formats (`RAD-xxxx` vs `ord_xxxx_xxxx`) with no shared utility.

---

## 9. Hardcoded Values Inventory

### 9.1 Currency and Locale

| Value | Location | Count |
|-------|----------|-------|
| `"MAD"` | `client.ts` (lab tests, services) | 5+ |
| `"Africa/Casablanca"` | `booking/route.ts:129`, `reschedule/route.ts:29` | 2 |
| `"en-CA"` | `booking/route.ts:130`, `reschedule/route.ts:30` | 2 |
| `"Paiement"` | `payments/cmi/route.ts:60` | 1 |

### 9.2 Magic Numbers

| Value | Meaning | Location |
|-------|---------|----------|
| `5 * 60 * 1000` | 5-minute cache TTL | `client.ts:165` |
| `20` | Days of daily stats | `client.ts:2364` |
| `6` | Months of monthly stats | `client.ts:2394` |
| `90` | Days for new patient calculation | `client.ts:2411` |
| `[9, 10, 11, 12, 14, 15, 16, 17]` | Working hour time slots | `client.ts:2446` |
| `13`, `27` | Trimester week boundaries | `client.ts:4542` |
| `1000 * 60 * 60 * 24` | Milliseconds per day | `client.ts:4539` |
| `24` | Default turnaround hours | `client.ts:2962` |
| `500` | Max tokens for LLM | `chat/route.ts:173, 223` |
| `0.7` | LLM temperature | `chat/route.ts:224` |
| `10` | Dispatch batch size | `cron/reminders/route.ts:107` |
| `500` | Appointment query limit | `cron/reminders/route.ts:66` |
| `1.5`, `2.5`, `22`, `25` | Reminder hour windows | `cron/reminders/route.ts:143-146` |

### 9.3 Fallback Strings

| Value | Meaning | Location |
|-------|---------|----------|
| `"Patient"` | Fallback patient name | `client.ts:3052, 3098` |
| `"Doctor"` | Fallback doctor name | `client.ts` (multiple), `cron/reminders:189` |
| `"Clinic"` | Fallback clinic name | `cron/reminders:179` |
| `"Appointment"` | Fallback service name | `cron/reminders:193` |
| `"blood"` | Default sample type | `client.ts:2958` |
| `"sitting"` | Default BP position | `specialists.ts:228` |
| `"left"` | Default BP arm | `specialists.ts:229` |
| `"mild"` | Default severity | `specialists.ts:120` |
| `"General"` | Default test category | `client.ts:4951` |
| `"normal"` | Default priority | `client.ts:4953`, `server.ts:1076` |

---

## 10. Summary & Risk Matrix

### Risk Levels

| Category | Finding | Risk | Effort to Fix |
|----------|---------|------|--------------|
| **Error Handling** | Silent error swallowing in `fetchRows()` | Critical | Low |
| **Error Handling** | Global cache ignores query failures | Critical | Low |
| **Error Handling** | `void errorVar` discards error details | Medium | Low |
| **Duplication** | Triplicated query helper across 3 files | High | Medium |
| **Duplication** | Copy-pasted lab order mapping (80+ identical lines) | High | Low |
| **Duplication** | 20+ identical mutation functions in specialists.ts | High | Medium |
| **Duplication** | Duplicated cancellation check in cancel route | Medium | Low |
| **Maintainability** | 5,115-line client.ts monolith | High | High |
| **Maintainability** | 159-line fetchAnalytics() function | Medium | Medium |
| **Maintainability** | 225-line cron reminder handler | Medium | Medium |
| **Type Safety** | 60+ unsafe `as` type assertions | Medium | Medium |
| **Type Safety** | `Record<string, unknown>` for update payloads | Medium | Medium |
| **Type Safety** | Loose `string` types for status fields | Medium | Low |
| **Consistency** | Inconsistent status strings ("no_show" vs "no-show") | High | Low |
| **Consistency** | Mixed mutation return types (boolean/null/Result) | Medium | High |
| **Consistency** | 50+ `.split("T")[0]` instead of timezone-aware utility | Medium | Medium |
| **Hardcoding** | Magic numbers throughout analytics/medical logic | Medium | Low |
| **Hardcoding** | Hardcoded currency "MAD", locale strings | Low | Low |
| **Dead Code** | `patientName: ""` in all specialist views (20+ occurrences) | Low | Low |

### Top Recommendations (Effort vs Impact)

**Quick Wins (Low Effort, High Impact):**
1. Add error checking to `fetchRows()` in `client.ts` -- just check `res.error` and log it
2. Extract the lab order mapping into a shared function to eliminate 80+ duplicated lines
3. Create a `formatDate(date, timezone)` utility to replace 50+ `.split("T")[0]` calls
4. Add `usersRes.error` / `servicesRes.error` checks in `ensureLookups()`

**Medium Term:**
5. Unify the three `fetchRows()` / `query()` implementations into a single shared module
6. Create a generic `insertRow()` helper to eliminate 20+ identical mutation functions
7. Extract analytics sub-computations into separate testable functions
8. Define status union types and use them in row interfaces

**Longer Term:**
9. Split `client.ts` by domain into separate modules (this is an architecture change but directly impacts code quality)
10. Standardize mutation return types across the codebase to a single `Result<T>` pattern
