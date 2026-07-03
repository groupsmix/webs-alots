# Supabase Directory — Full Audit Report

**Scope:** `supabase/` (202 migrations, 3 edge functions, seed files, 8 test files, `config.toml`)
**Date:** 2026-07-02

---

## Legend

| Severity        | Meaning                                       |
| --------------- | --------------------------------------------- |
| 🔴 **Critical** | Breaks the app OR is a direct security breach |
| 🟠 **High**     | Significant risk / data correctness problem   |
| 🟡 **Medium**   | Latent bug or notable security gap            |
| 🟢 **Low**      | Code quality, consistency, minor risk         |

---

## 🔴 CRITICAL

### SEC-1 — `seed.sql` environment guard is bypassable

**File:** [`supabase/seed.sql`](file:///c:/webs-alots/supabase/seed.sql#L47-L57)  
**Lines:** 47–57  
**Problem:** The production guard only aborts when `app.environment` is **explicitly set** to `'production'` or `'staging'`. If the setting is absent (e.g. running `psql` directly without setting it), the guard passes and seed data — including 9 auth users with the **hardcoded password `seed-password-change-me`** — is written. A fresh `supabase db reset` followed by a manual `psql … -f supabase/seed.sql` against a staging project that didn't set the env var would silently seed production.  
**Why it's a problem:** The seed users have well-known credentials committed to git history. Any environment that runs this file becomes trivially compromised.  
**Fix:** Invert the logic to only run when the environment is **explicitly** `'local'`, `'development'`, or `'test'`:

```sql
IF current_setting('app.environment', true) NOT IN ('local', 'development', 'test') THEN
  RAISE EXCEPTION 'SEED ABORT: ...';
END IF;
```

---

### SEC-2 — `execute_admin_query` allows regex-bypassable DDL

**File:** [`supabase/migrations/00198_fix_execute_admin_query.sql`](file:///c:/webs-alots/supabase/migrations/00198_fix_execute_admin_query.sql#L50)  
**Lines:** 50  
**Problem:** The keyword blocklist uses a word-boundary regex (`\b`). A Unicode lookalike or comment injection such as `SELECT/*DELETE*/1` would not match `\bDELETE\b` in all Postgres regex flavours. More critically, a CTE like `WITH x AS (SELECT 1) SELECT ...` is accepted, but a CTE like `WITH x AS (TABLE payments) SELECT ...` is **not blocked** — `TABLE` is shorthand for `SELECT *` and is not in the blocklist.  
**Why it's a problem:** Super-admin analytics queries run via an authenticated user-scoped client. Any bypass lets an attacker dump arbitrary tables.  
**Fix:** Add `TABLE` to the keyword blocklist and consider using a Postgres parser-level restriction (e.g. wrap in a read-only transaction).

---

### SEC-3 — `notify-booking` / `send-appointment-reminders` edge functions: `verify_jwt = false` with no timeout

**File:** [`supabase/config.toml`](file:///c:/webs-alots/supabase/config.toml#L64-L68)  
**Lines:** 64–68  
**Problem:** Both `notify-booking` and `send-appointment-reminders` have `verify_jwt = false`. This means Supabase's platform-level JWT gate is disabled. The functions implement their own token check, but if `EDGE_FUNCTION_SECRET` or `CRON_SECRET` env vars are **empty strings**, both functions' guards evaluate to `false` and reject the request — but only _silently_ return a 403 without any alerting. More critically, if these env vars are **not set at all** in the Dashboard, the guard `timingSafeEqual(token, "")` will always return false (correct), but there is no startup check or alert that the secrets are missing. An operator deploying these functions without setting the secrets would have them permanently broken with no visible error.  
**Fix:** Add explicit env-var presence assertions at startup, and consider logging an error when secrets are empty.

---

### BUG-1 — `send-appointment-reminders`: Supabase client instantiated at module scope

**File:** [`supabase/functions/send-appointment-reminders/index.ts`](file:///c:/webs-alots/supabase/functions/send-appointment-reminders/index.ts#L60-L63)  
**Lines:** 60–63  
**Problem:** The Supabase client is created at **module initialization time** (outside `Deno.serve`), before the request is authenticated. This means:

1. If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing, the function throws at boot, but the error message is an unhandled exception rather than a clean 503.
2. The client is shared across all requests in a single isolate, which can cause unexpected behaviour with Supabase's realtime/session state in edge environments.  
   **Why it's a problem:** The sister functions (`notify-booking`, `parse-medical-document`) correctly instantiate the client **after** authentication inside the handler. This inconsistency is a bug pattern.  
   **Fix:** Move `createClient()` inside `Deno.serve` after auth validation, mirroring `notify-booking`.

---

### SEC-4 — Migration `00044` is missing — gap in sequential numbering

**Files:** `supabase/migrations/`  
**Problem:** Migration files jump from `00043_fix_booking_anon_rls.sql` directly to `00045_fix_auth_trigger_clinic_admin.sql`. **`00044` does not exist.** The Supabase CLI uses sequential numbers to order migration execution. A missing file can cause `supabase db pull` / migration history checks to report drift, and CI pipelines that assert a contiguous sequence will fail. Additionally, there is no stub no-op migration (unlike `00003` and `00046` which have been properly stubbed).  
**Why it's a problem:** This is a migration history gap; Supabase cloud will consider the local and remote sequences diverged.  
**Fix:** Create `supabase/migrations/00044_<description>.sql` as a no-op stub, matching the pattern used in `00003` and `00046`.

---

### SEC-5 — `seed.sql` demo clinic inserted without `subdomain` column; relies on later `UPDATE`

**File:** [`supabase/seed.sql`](file:///c:/webs-alots/supabase/seed.sql#L242-L257)  
**Lines:** 242–257, 471–474  
**Problem:** The demo clinic `c0000000-de00-0000-0000-000000000001` is inserted with `subdomain` buried inside `config` JSONB (`"subdomain": "demo"`) but not in the `subdomain` column. The actual column is set 230 lines later via an `UPDATE`. Between the `INSERT` and the `UPDATE`, the `trg_enforce_clinic_subdomain_guard` trigger fires on the `INSERT` (migration 00171) and passes because `subdomain IS NULL`. However, the `is_reserved_subdomain` function in 00171 does NOT reserve `'demo'` — so the trigger would pass even on INSERT. The real issue is that if the `UPDATE` fails (e.g. transaction rollback mid-seed), the demo clinic exists with no `subdomain` set, breaking tenant routing.  
**Fix:** Include `subdomain = 'demo'` in the initial `INSERT INTO clinics`.

---

## 🟠 HIGH

### SEC-6 — `handle_new_auth_user` hardening in `00068` references `updated_at` column that may not exist

**File:** [`supabase/migrations/00068_consolidated_audit_fixes.sql`](file:///c:/webs-alots/supabase/migrations/00068_consolidated_audit_fixes.sql#L391-L415)  
**Lines:** 391–415  
**Problem:** The hardened `handle_new_auth_user()` trigger function inserts into `public.users` with `updated_at = NOW()`, but `updated_at` is **not** defined in the initial `public.users` table in `00001`. It would have been added by a later migration. If the function runs via a database restore that applies migrations in order, and the trigger fires before `updated_at` is added to the column list, it will throw `ERROR: column "updated_at" of relation "users" does not exist`. This breaks new user registration.  
**Fix:** Add `IF NOT EXISTS updated_at` guard in `00001`, or update the trigger to use `ON CONFLICT DO UPDATE SET email = EXCLUDED.email` without referencing `updated_at`.

---

### SEC-7 — `get_request_clinic_id()` EXCEPTION handler silently eats UUID cast errors

**File:** [`supabase/migrations/00041_fix_rls_use_request_headers.sql`](file:///c:/webs-alots/supabase/migrations/00041_fix_rls_use_request_headers.sql#L59-L62)  
**Lines:** 59–62  
**Problem:** The `EXCEPTION WHEN OTHERS THEN RETURN NULL` swallows **all** exceptions, including malformed UUIDs. An attacker sending `x-clinic-id: ../../../etc/passwd` would not error — it silently returns NULL. While NULL causes the RLS policy to fail-closed (no access), this means legitimate users sending a malformed clinic ID get silently denied rather than a clear error. More importantly, the broad `WHEN OTHERS` mask makes debugging very difficult.  
**Fix:** Narrow the exception handler to only catch `invalid_text_representation` (UUID cast failure), and re-raise all other exceptions.

---

### SEC-8 — `audit_money_change()` trigger logs **full row data** including potentially sensitive fields

**File:** [`supabase/migrations/00077_audit_hardening_a250.sql`](file:///c:/webs-alots/supabase/migrations/00077_audit_hardening_a250.sql#L61-L88)  
**Lines:** 61–88  
**Problem:** `row_to_json(OLD)` and `row_to_json(NEW)` log the complete payment/invoice row — including potentially sensitive fields like `ref` (which may contain external payment gateway tokens or transaction IDs). There is no field filtering.  
**Why it's a problem:** The `audit_logs` table is not encrypted at rest (only the main database encryption applies). Storing unfiltered payment references in a separate audit log expands the PHI/PCI attack surface.  
**Fix:** Explicitly select only the fields that need auditing rather than using `row_to_json()` on the full row.

---

### BUG-2 — `notify-booking`: No clinic_id scoping when querying the appointments table

**File:** [`supabase/functions/notify-booking/index.ts`](file:///c:/webs-alots/supabase/functions/notify-booking/index.ts#L149-L155)  
**Lines:** 149–155  
**Problem:** The appointment is fetched by `id` only — no `.eq("clinic_id", ...)` filter is applied. The service role key bypasses RLS. A caller who knows a valid appointment UUID from another clinic can trigger notifications for it. This violates the AGENTS.md tenant isolation rule: **every DB query must include `.eq("clinic_id", clinicId)`**.  
**Why it's a problem:** Cross-tenant PHI disclosure via the WhatsApp notification body (patient name, doctor name, date/time).  
**Fix:** Fetch the appointment first to get `clinic_id`, then scope subsequent queries. At minimum, add a clinic_id to the webhook payload and validate it.

---

### BUG-3 — `send-appointment-reminders`: Language code hardcoded as `"fr"` for all clinics

**File:** [`supabase/functions/send-appointment-reminders/index.ts`](file:///c:/webs-alots/supabase/functions/send-appointment-reminders/index.ts#L86)  
**Line:** 86  
**Problem:** The WhatsApp template language is hardcoded to `{ code: "fr" }`. The system supports French, Arabic, and Darija (per AGENTS.md). A clinic configured for Arabic will send the wrong template variant, causing WhatsApp API errors or the wrong message being delivered.  
**Fix:** Read `locale` from the clinic's config JSONB and map to the correct WhatsApp language code.

---

### BUG-4 — `parse-medical-document`: `record.r2_key` path traversal not validated

**File:** [`supabase/functions/parse-medical-document/index.ts`](file:///c:/webs-alots/supabase/functions/parse-medical-document/index.ts#L271-L273)  
**Lines:** 271–273  
**Problem:** `record.r2_key` is only checked for presence (`typeof record.r2_key !== "string"`). There is no validation preventing path traversal characters (`..`, `//`, null bytes). The `buildUploadKey()` safeguard mentioned in AGENTS.md applies on the Next.js side, but the edge function receives `r2_key` from a DB webhook payload and doesn't re-validate the format.  
**Why it's a problem:** A malicious DB insert (e.g. via a compromised service-role token) could specify `r2_key: "../../secrets/config"` to exfiltrate arbitrary R2 objects.  
**Fix:** Validate `r2_key` with a regex (e.g. `^[a-zA-Z0-9/._-]+$`) and reject keys containing `..` or null bytes.

---

### BUG-5 — Missing `clinic_id` NOT NULL on `notifications` table in `00001`

**File:** [`supabase/migrations/00001_initial_schema.sql`](file:///c:/webs-alots/supabase/migrations/00001_initial_schema.sql#L83-L91)  
**Lines:** 83–91  
**Problem:** The `notifications` table was created without `clinic_id`. Migration `00005` added it, and `00081` added `NOT NULL`. However, the RLS policies in `00029` reference `clinic_id = get_user_clinic_id()` — if any legacy rows exist with `clinic_id IS NULL`, they become invisible to all users (the policy returns false for NULL = anything). Combined with `ON CONFLICT DO NOTHING` in seed data, this could silently drop notifications.  
**Fix:** This is already mitigated by 00081's NOT NULL constraint, but a backfill migration should verify and repair any orphaned rows.

---

### BUG-6 — `family_members` referenced by column `user_id` in `00068` but column is `primary_user_id`

**File:** [`supabase/migrations/00068_consolidated_audit_fixes.sql`](file:///c:/webs-alots/supabase/migrations/00068_consolidated_audit_fixes.sql#L204-L215)  
**Lines:** 204–215  
**Problem:** The D-11 backfill in `00068` joins `family_members fm` using `fm.user_id = u.id`. But the actual column name in `00001` is `primary_user_id`. This UPDATE silently updates zero rows (column doesn't exist → Postgres error, not silent update, so this would **fail the migration** if `family_members` already has rows). The correct backfill in `00029` uses `fm.primary_user_id = u.id`.  
**Why it's a problem:** The D-11 block in `00068` would throw `column "user_id" does not exist` if `family_members` already has rows (from seed data), blocking the entire migration.  
**Fix:** Change `fm.user_id` to `fm.primary_user_id` in the D-11 section of `00068`.

---

## 🟡 MEDIUM

### SEC-9 — `timingSafeEqual` in all three edge functions returns `false` on empty string, but CRON_SECRET can be empty

**Files:** All three edge function `index.ts` files  
**Problem:** `timingSafeEqual(a, b)` returns `false` when `ab.length === 0`. If `CRON_SECRET` is set to an empty string `""`, `isCronSecret` is `false` AND the early-out check `cronSecret !== ""` also returns false, so the double-negation logic correctly blocks the request. However, there is no explicit check that `CRON_SECRET` has a minimum length or entropy requirement. A very short secret (e.g. `"x"`) passes validation.  
**Fix:** Add a minimum-length assertion in the function startup or in the secret validation logic.

---

### SEC-10 — `clinics_select_active_public` RLS policy dropped in `00068` but `public_clinic_directory` view may expose `config` JSONB if joined

**File:** [`supabase/migrations/00068_consolidated_audit_fixes.sql`](file:///c:/webs-alots/supabase/migrations/00068_consolidated_audit_fixes.sql#L59-L65)  
**Lines:** 59–65  
**Problem:** The `public_clinic_directory` view correctly projects only `id, name, subdomain, type, status`. However, it is created with `GRANT SELECT ON public_clinic_directory TO anon` but without `SECURITY INVOKER` / `SECURITY DEFINER` being explicitly set. In Postgres, views are `SECURITY INVOKER` by default, so the underlying `clinics` table RLS still applies. But the view itself can be unioned with direct table queries — a user who crafts a query using the anon role against `clinics` directly may bypass the view restriction if `clinics_select_active_public` was the only guard.  
**Fix:** Confirm that the `clinics` table now has no anon SELECT policy (it appears to have been dropped), and add a comment documenting that `public_clinic_directory` is the sole anon access path.

---

### BUG-7 — `send-appointment-reminders`: `dateStr` missing timezone — may display wrong date

**File:** [`supabase/functions/send-appointment-reminders/index.ts`](file:///c:/webs-alots/supabase/functions/send-appointment-reminders/index.ts#L273)  
**Line:** 273  
**Problem:** `scheduled.toLocaleDateString("fr-MA")` is called **without** a `timeZone` option, so it uses the server's local timezone (which in a Deno edge runtime is UTC). The `timeStr` on line 277 correctly specifies `timeZone: "Africa/Casablanca"`, but the `dateStr` does not. For appointments at midnight UTC that are actually the next day in Casablanca (+1h), the displayed date will be one day off.  
**Fix:** Add `{ timeZone: "Africa/Casablanca" }` to the `toLocaleDateString` call on line 273.

---

### BUG-8 — `parse-medical-document`: Claude `anthropic-beta: pdfs-2024-09-25` header sent even for image requests

**File:** [`supabase/functions/parse-medical-document/index.ts`](file:///c:/webs-alots/supabase/functions/parse-medical-document/index.ts#L365-L379)  
**Lines:** 365–379  
**Problem:** The `anthropic-beta: pdfs-2024-09-25` header is always sent, even when the content is an image (not a PDF). This beta header enables PDF document processing. For image requests, it is harmless but adds unnecessary API surface. More importantly, the beta version `2024-09-25` may be deprecated; using a stale beta header can cause silent feature degradation as Anthropic rolls out new versions.  
**Fix:** Only include `anthropic-beta: pdfs-2024-09-25` when `isPDF === true`.

---

### PERF-1 — `retry_pending_document_extractions` has no `FOR UPDATE SKIP LOCKED`

**File:** [`supabase/migrations/00202_document_extraction_retry_cron.sql`](file:///c:/webs-alots/supabase/migrations/00202_document_extraction_retry_cron.sql#L57-L64)  
**Lines:** 57–64  
**Problem:** The cron function selects `pending` rows without `FOR UPDATE SKIP LOCKED`. If the cron fires twice in quick succession (e.g. a delayed job overlaps with the next 5-minute tick), both invocations will pick up the same batch of `pending` rows and double-invoke the edge function for each file. This causes double-billing on Anthropic API calls and duplicate `processing` → `pending` state flaps.  
**Fix:** Add `FOR UPDATE SKIP LOCKED` to the cursor query.

---

### PERF-2 — N+1 query in `send-appointment-reminders`: one credential lookup per clinic per appointment

**File:** [`supabase/functions/send-appointment-reminders/index.ts`](file:///c:/webs-alots/supabase/functions/send-appointment-reminders/index.ts#L236-L263)  
**Lines:** 236–263  
**Problem:** The per-invocation `tokenCache` (a `Map`) caches credentials correctly **within one reminder window**, but the cache is reset for each window iteration (line 236 is inside the `for (const window of REMINDER_WINDOWS)` loop). If the same clinic has appointments in multiple reminder windows (e.g. both 24h and 2h windows active simultaneously), `getClinicWhatsAppToken` is called once per window per clinic instead of once per clinic per invocation.  
**Fix:** Move `const tokenCache = new Map()` to outside the `for (const window of REMINDER_WINDOWS)` loop.

---

### QUAL-1 — `supabase/functions/deno.json` missing `importMap` and lock file reference

**File:** [`supabase/functions/deno.json`](file:///c:/webs-alots/supabase/functions/deno.json)  
**Problem:** Functions import `https://esm.sh/@supabase/supabase-js@2` (unpinned minor version in `notify-booking` and `parse-medical-document`) vs `@2.107.0` (pinned in `send-appointment-reminders`). Without a lock file or import map, the unpinned imports can silently resolve to a different version than tested. Deno 1.x+ uses `deno.lock` for reproducibility.  
**Fix:** Pin all imports to exact versions (e.g. `@2.107.0`) and add a `deno.lock` or import map.

---

### BUG-9 — `send-appointment-reminders`: `totalProcessed` counter increments even if the dedup insert fails

**File:** [`supabase/functions/send-appointment-reminders/index.ts`](file:///c:/webs-alots/supabase/functions/send-appointment-reminders/index.ts#L305-L319)  
**Lines:** 305–319  
**Problem:** `totalProcessed++` on line 319 runs regardless of whether the `appointment_reminders` insert succeeded. If the insert fails with an error other than `23505` (unique violation), the reminder is counted as processed but no dedup record was written — meaning it will be retried on the next cron tick.  
**Why it's a problem:** The `processed` count in the response becomes misleading, and duplicate WhatsApp messages are possible.  
**Fix:** Only increment `totalProcessed` if `insertErr` is `null`.

---

### SEC-11 — `block_seed_user_login` trigger also fires on `INSERT` into `auth.users` — blocks CI seeding

**File:** [`supabase/migrations/00059_seed_user_login_guard.sql`](file:///c:/webs-alots/supabase/migrations/00059_seed_user_login_guard.sql#L58-L63)  
**Lines:** 58–63  
**Problem:** The `trg_block_seed_user_insert` trigger fires on `BEFORE INSERT ON auth.users`. If `app.environment` is not set (the default), it defaults to **blocking**. The `seed.sql` sets `SET app.environment = 'local'` — but this is a session-local SET. If the migration is applied before `seed.sql` runs (which is always the case in `supabase db reset`), and the trigger fires during a fresh auth user creation in CI that doesn't set `app.environment`, CI pipelines will fail with `SEED-01: Seed user login is blocked`.  
**Why it's a problem:** The seed file's `SET app.environment = 'local'` is transaction-local, but the trigger evaluates `current_setting('app.environment', true)` against the current session, so the SET in seed.sql protects the seed run. However, test suites that create new auth users without setting `app.environment` in the same session will be blocked.  
**Fix:** The INSERT trigger guard should only apply to the specific seed UUIDs (`a0000000-...`), not to all inserts. New UUIDs should always be allowed.

---

### QUAL-2 — `00068` creates `processing_consents.user_id` as NOT NULL but clinic_id as nullable — inconsistent with PHI access model

**File:** [`supabase/migrations/00068_consolidated_audit_fixes.sql`](file:///c:/webs-alots/supabase/migrations/00068_consolidated_audit_fixes.sql#L457-L468)  
**Lines:** 457–468  
**Problem:** `processing_consents` has `user_id UUID NOT NULL` but `clinic_id UUID` (nullable). The RLS policy `processing_consents_tenant_scope` relies on `clinic_id IS NOT NULL` to scope clinic-staff access. But the `user_id NOT NULL` constraint means every consent requires a user even for anonymous/cookie consents. The comment says "cookie consent before login" but `user_id` is NOT NULL — this is contradictory.  
**Fix:** Either make `user_id` nullable (to support anonymous pre-login consents) or document clearly that anonymous consents should use a sentinel/anonymous user ID.

---

## 🟢 LOW

### QUAL-3 — `supabase/tests/` directory has no `no_force_rls` test for the `send-appointment-reminders` function

**File:** [`supabase/tests/no_force_rls.test.sql`](file:///c:/webs-alots/supabase/tests/no_force_rls.test.sql)  
**Problem:** The test asserts that no tables have `FORCE ROW LEVEL SECURITY` disabled for the service role. However, the edge function's service-role client explicitly bypasses RLS. While this is by design, there is no test verifying that the expected tables (like `clinic_whatsapp_credentials`) cannot be read by the `anon` role directly.

---

### QUAL-4 — `00066` search_path fix doesn't cover `get_my_user_id()`, `is_clinic_staff()`, `is_clinic_admin()`

**File:** [`supabase/migrations/00066_security_definer_search_path.sql`](file:///c:/webs-alots/supabase/migrations/00066_security_definer_search_path.sql#L12-L31)  
**Lines:** 12–31  
**Problem:** The list of SECURITY DEFINER functions that get `search_path = public, pg_temp` does **not** include `get_my_user_id()`, `is_clinic_staff()`, or `is_clinic_admin(check_clinic_id)`, all of which are SECURITY DEFINER functions defined in `00002`. Migration `00197` adds a followup pass, but these three are still missing from both lists.  
**Fix:** Add `'public.get_my_user_id()'`, `'public.is_clinic_staff()'`, and `'public.is_clinic_admin(uuid)'` to the `00066` list or the `00197` followup.

---

### QUAL-5 — `config.toml` session timeout settings are commented out with a Pro-plan note

**File:** [`supabase/config.toml`](file:///c:/webs-alots/supabase/config.toml#L41-L48)  
**Lines:** 41–48  
**Problem:** The 24h session timebox and 30m inactivity timeout are disabled with a comment saying "requires Supabase Pro plan". For a healthcare app handling PHI, session timeout is an OWASP ASVS V3 requirement. If the project is on Pro (which is likely for production), these settings are simply forgotten.  
**Fix:** Uncomment and enable `[auth.sessions] timebox = "24h"` and `inactivity_timeout = "30m"` for production. Add a CI check that asserts these are configured before launch.

---

### QUAL-6 — `seed.sql` demo clinic `config` JSONB contains `subdomain` field duplicating the column

**File:** [`supabase/seed.sql`](file:///c:/webs-alots/supabase/seed.sql#L248-L254)  
**Lines:** 248–254  
**Problem:** The clinic config JSONB stores `"subdomain": "demo"` — this data is also stored in the `clinics.subdomain` column. Having it in two places risks them diverging.  
**Fix:** Remove `subdomain` from the `config` JSONB to keep it in the canonical column only.

---

### QUAL-7 — `audit_money_change()` function does not set `search_path` in `00077`

**File:** [`supabase/migrations/00077_audit_hardening_a250.sql`](file:///c:/webs-alots/supabase/migrations/00077_audit_hardening_a250.sql#L88)  
**Line:** 88  
**Problem:** `audit_money_change()` is `SECURITY DEFINER SET search_path = public` (without `pg_temp`). Migration `00066` mandates `public, pg_temp` for all SECURITY DEFINER functions to prevent search_path injection via temporary table shadowing.  
**Fix:** Change to `SET search_path = public, pg_temp`.

---

### QUAL-8 — Dead code: `notify-booking` fetches `appointment_date` and `start_time` columns that may not exist in all schema versions

**File:** [`supabase/functions/notify-booking/index.ts`](file:///c:/webs-alots/supabase/functions/notify-booking/index.ts#L151-L153)  
**Lines:** 151–153  
**Problem:** The select query fetches `appointment_date, start_time` alongside `slot_start, slot_end`. These legacy date/time columns are a known schema artifact (see 00019), but selecting non-existent columns from Supabase returns `null` without an error. There is defensive code handling their absence (lines 174–188), so the fallback works. However, the select query lists columns that may be undefined, making the interface type (`AppointmentRow`) a partial lie about what the DB actually returns.  
**Fix:** This is a minor quality issue — remove the legacy columns from the select and rely entirely on `slot_start`/`slot_end`.

---

## Summary Table

| ID     | Severity    | Category    | File                                | Issue                                                                               |
| ------ | ----------- | ----------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| SEC-1  | 🔴 Critical | Security    | seed.sql                            | Production guard bypassable when env var not set                                    |
| SEC-2  | 🔴 Critical | Security    | 00198                               | `execute_admin_query` TABLE keyword not blocked                                     |
| SEC-3  | 🔴 Critical | Security    | config.toml                         | `verify_jwt = false` with no startup secret validation                              |
| BUG-1  | 🔴 Critical | Bug         | send-appointment-reminders/index.ts | Supabase client at module scope                                                     |
| SEC-4  | 🔴 Critical | Blocker     | migrations/                         | Migration 00044 missing (sequence gap)                                              |
| SEC-5  | 🔴 Critical | Bug         | seed.sql                            | Demo clinic subdomain column not set on INSERT                                      |
| SEC-6  | 🟠 High     | Bug         | 00068                               | `handle_new_auth_user` references `updated_at` before it exists                     |
| SEC-7  | 🟠 High     | Security    | 00041                               | `WHEN OTHERS` masks UUID cast errors in `get_request_clinic_id`                     |
| SEC-8  | 🟠 High     | Security    | 00077                               | Full row data logged in audit trigger (sensitive fields)                            |
| BUG-2  | 🟠 High     | Bug         | notify-booking/index.ts             | No clinic_id scope on appointment query                                             |
| BUG-3  | 🟠 High     | Bug         | send-appointment-reminders/index.ts | Language code hardcoded to `"fr"`                                                   |
| BUG-4  | 🟠 High     | Security    | parse-medical-document/index.ts     | `r2_key` path traversal not validated                                               |
| BUG-5  | 🟠 High     | Bug         | 00001                               | `notifications.clinic_id` originally missing                                        |
| BUG-6  | 🟠 High     | Bug         | 00068                               | `family_members` backfill uses wrong column name                                    |
| SEC-9  | 🟡 Medium   | Security    | All edge functions                  | No minimum entropy check on `CRON_SECRET`                                           |
| SEC-10 | 🟡 Medium   | Security    | 00068                               | `public_clinic_directory` view lacks explicit docs on sole anon path                |
| BUG-7  | 🟡 Medium   | Bug         | send-appointment-reminders/index.ts | `dateStr` missing timezone option                                                   |
| BUG-8  | 🟡 Medium   | Bug         | parse-medical-document/index.ts     | `anthropic-beta` header sent on image requests                                      |
| PERF-1 | 🟡 Medium   | Performance | 00202                               | `retry_pending_document_extractions` lacks `SKIP LOCKED`                            |
| PERF-2 | 🟡 Medium   | Performance | send-appointment-reminders/index.ts | Token cache resets between reminder windows                                         |
| QUAL-1 | 🟡 Medium   | Quality     | functions/deno.json                 | Mixed pinned/unpinned ESM import versions                                           |
| BUG-9  | 🟡 Medium   | Bug         | send-appointment-reminders/index.ts | `totalProcessed` increments on failed dedup insert                                  |
| SEC-11 | 🟡 Medium   | Security    | 00059                               | INSERT trigger may block CI when env var unset                                      |
| QUAL-2 | 🟡 Medium   | Quality     | 00068                               | `processing_consents.user_id` NOT NULL contradicts anon-consent comment             |
| QUAL-3 | 🟢 Low      | Quality     | tests/                              | No RLS test for `clinic_whatsapp_credentials` anon access                           |
| QUAL-4 | 🟢 Low      | Quality     | 00066/00197                         | `get_my_user_id`, `is_clinic_staff`, `is_clinic_admin` missing from search_path fix |
| QUAL-5 | 🟢 Low      | Quality     | config.toml                         | Session timeout commented out                                                       |
| QUAL-6 | 🟢 Low      | Quality     | seed.sql                            | `subdomain` duplicated in config JSONB                                              |
| QUAL-7 | 🟢 Low      | Quality     | 00077                               | `audit_money_change` uses `public` not `public, pg_temp`                            |
| QUAL-8 | 🟢 Low      | Quality     | notify-booking/index.ts             | Legacy `appointment_date`/`start_time` still in select                              |

---

> **Note:** No hardcoded API keys, tokens, or passwords were found in migration or function source files. The seed password (`seed-password-change-me`) is intentional and well-documented with warnings. The seed user blocklist in `00183` and the trigger in `00059` provide defense-in-depth against those accounts reaching production.
