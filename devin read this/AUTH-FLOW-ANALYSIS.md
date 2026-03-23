# Authentication Flow Analysis

**Date:** 2026-03-23
**Scope:** auth.ts, Supabase Auth (OTP flow), middleware.ts (auth checks), session handling (@supabase/ssr), auth callback (/auth/callback)

---

## Table of Contents

1. [Key Files Involved](#1-key-files-involved)
2. [Step-by-Step Auth Flow](#2-step-by-step-auth-flow)
3. [User Identity Storage](#3-user-identity-storage)
4. [Session Lifecycle](#4-session-lifecycle)
5. [Session Validation (Server vs Client)](#5-session-validation-server-vs-client)
6. [User Profile Fetching](#6-user-profile-fetching)
7. [Role System](#7-role-system)

---

## 1. Key Files Involved

| File | Purpose |
|------|---------|
| `src/app/(auth)/login/page.tsx` | Login UI — phone input + OTP verification (client component) |
| `src/app/(auth)/register/page.tsx` | Registration UI — patient info + phone OTP (client component) |
| `src/lib/auth.ts` | Server actions: `signInWithOTP()`, `verifyOTP()`, `registerPatient()`, `signOut()`, `getUserProfile()`, `requireAuth()`, `requireRole()` |
| `src/lib/supabase-server.ts` | Creates server-side Supabase client using `@supabase/ssr` `createServerClient()` with cookie-based session |
| `src/lib/supabase-client.ts` | Creates browser-side Supabase client using `@supabase/ssr` `createBrowserClient()` |
| `src/middleware.ts` | Next.js middleware — session refresh, auth gating, role-based route enforcement, tenant resolution |
| `src/app/auth/callback/route.ts` | OAuth/magic-link callback — exchanges auth code for session, redirects by role |
| `src/lib/with-auth.ts` | API route wrapper — authenticates request, fetches profile, checks role |
| `src/lib/auth-roles.ts` | Shared role constants (`STAFF_ROLES`) |
| `src/lib/tenant.ts` | Reads tenant info from middleware-set headers |
| `supabase/migrations/00002_auth_rls_roles.sql` | Original auth trigger `handle_new_auth_user()` + RLS helper functions |
| `supabase/migrations/00028_security_hardening.sql` | Hardened auth trigger (role defaults to `patient`, reads invitation data from `raw_app_meta_data` only) |

---

## 2. Step-by-Step Auth Flow

### 2.1 Login Flow (Existing User)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Login Page  │────>│ signInWithOTP│────>│ Supabase Auth│────>│  SMS to User │
│  (client)    │     │ (server act) │     │  .signInOtp  │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                                                              │
       │  User enters 6-digit code                                    │
       ▼                                                              │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐           │
│  OTP Input   │────>│  verifyOTP   │────>│ Supabase Auth│<──────────┘
│  (client)    │     │ (server act) │     │ .verifyOtp   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                              ┌────────────────────┤
                              │ Session created     │
                              │ (JWT + refresh in   │
                              │  httpOnly cookies)   │
                              ▼                     │
                     ┌──────────────┐               │
                     │getUserProfile│               │
                     │ (server act) │               │
                     └──────┬───────┘               │
                            │                       │
                            │ SELECT * FROM users    │
                            │ WHERE auth_id = uid   │
                            ▼                       │
                     ┌──────────────┐               │
                     │   redirect   │               │
                     │ to dashboard │               │
                     │  by role     │               │
                     └──────────────┘
```

**Step-by-step:**

1. **User visits `/login`** — `src/app/(auth)/login/page.tsx` renders a phone number input form.

2. **User submits phone number** — Client calls server action `signInWithOTP(phone)` from `src/lib/auth.ts`.

3. **Server action calls Supabase** — `signInWithOTP()` creates a server-side Supabase client via `createClient()` (`src/lib/supabase-server.ts`), then calls `supabase.auth.signInWithOtp({ phone })`.

4. **Supabase sends SMS** — Supabase Auth generates a 6-digit OTP and sends it via the configured SMS provider (Twilio/MessageBird/etc.) to the provided phone number.

5. **UI switches to OTP step** — Login page sets `step = "otp"`, shows the 6-digit code input.

6. **User enters OTP** — Client calls server action `verifyOTP(phone, token)` from `src/lib/auth.ts`.

7. **Server action verifies OTP** — `verifyOTP()` creates a server-side Supabase client and calls `supabase.auth.verifyOtp({ phone, token, type: "sms" })`.

8. **Supabase creates session** — On successful verification, Supabase Auth:
   - If this phone number is new: creates a new row in `auth.users` and fires the `on_auth_user_created` trigger (see Section 7.1).
   - If existing: looks up the existing `auth.users` row.
   - Issues a JWT access token + refresh token.
   - The `@supabase/ssr` cookie handler in `createClient()` stores these tokens in httpOnly cookies via `setAll()`.

9. **Profile fetch + redirect** — `verifyOTP()` calls `getUserProfile()` which queries `SELECT * FROM users WHERE auth_id = user.id`. Based on the profile's `role`, it calls `redirect(ROLE_DASHBOARD_MAP[role])`:
   - `super_admin` → `/super-admin/dashboard`
   - `clinic_admin` → `/admin/dashboard`
   - `receptionist` → `/receptionist/dashboard`
   - `doctor` → `/doctor/dashboard`
   - `patient` → `/patient/dashboard`

10. **Fallback** — If no profile is found (e.g., trigger hasn't run yet), redirects to `/patient/dashboard`.

---

### 2.2 Registration Flow (New Patient)

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Register Page│────>│ registerPatient │────>│ Supabase Auth│
│  (client)    │     │  (server act)   │     │  .signInOtp  │
│  Collects:   │     │  Passes meta:   │     │  w/ options   │
│  - name      │     │  - name         │     │  .data = meta│
│  - phone     │     │  - role=patient │     └──────┬───────┘
│  - email     │     │  - email, etc   │            │
│  - age       │     └─────────────────┘            │
│  - gender    │                                    │
│  - insurance │            ┌───────────────────────┘
└──────────────┘            ▼
                    ┌──────────────┐
                    │  SMS to User │
                    └──────────────┘
                            │
                            ▼
                    (Same OTP verification flow as login)
                            │
                            ▼
                    ┌──────────────────────┐
                    │ Auth trigger fires:  │
                    │ handle_new_auth_user │
                    │ Creates users row    │
                    │ role = 'patient'     │
                    └──────────────────────┘
```

**Step-by-step:**

1. **User visits `/register`** — `src/app/(auth)/register/page.tsx` renders a form collecting: first name, last name, phone, email (optional), age, gender, insurance.

2. **User submits form** — Client calls server action `registerPatient(data)` from `src/lib/auth.ts`.

3. **Server action calls Supabase with metadata** — `registerPatient()` calls `supabase.auth.signInWithOtp({ phone, options: { data: { name, phone, email, role: "patient", age, gender, insurance } } })`. The `options.data` object is stored in `auth.users.raw_user_meta_data`.

4. **OTP sent + verified** — Same flow as login (steps 4-7 above). User enters OTP code, client calls `verifyOTP(phone, otp)`.

5. **Auth trigger creates profile** — When the `auth.users` row is created (first-time phone), the `on_auth_user_created` trigger fires `handle_new_auth_user()` (migration 00028 version):
   - Role is **always** set to `'patient'` (regardless of what `raw_user_meta_data` says).
   - `clinic_id` is only set if `raw_app_meta_data` contains `invited_to_clinic` (server-controlled invitation flow).
   - `name` is read from `raw_user_meta_data` (safe — display name only).
   - `phone` and `email` are read from the `auth.users` row directly.

6. **Redirect** — Same as login step 9-10. Since role is always `patient` for self-registration, redirects to `/patient/dashboard`.

---

### 2.3 Auth Callback Flow (OAuth / Magic Link)

**File:** `src/app/auth/callback/route.ts`

This route handles the redirect back from Supabase Auth for OAuth or magic link flows.

```
Browser ──GET /auth/callback?code=XYZ──> route.ts
                                            │
                                            ▼
                                   exchangeCodeForSession(code)
                                            │
                                            ▼
                                      getUser() → user
                                            │
                                            ▼
                                   SELECT role FROM users
                                   WHERE auth_id = user.id
                                            │
                                            ▼
                                   redirect(dashboard by role)
```

**Step-by-step:**

1. Supabase Auth redirects browser to `/auth/callback?code=XYZ&next=/patient/dashboard`.
2. Route handler calls `supabase.auth.exchangeCodeForSession(code)` — this exchanges the one-time code for session tokens (stored in cookies via `setAll`).
3. On success, calls `supabase.auth.getUser()` to get the authenticated user.
4. Queries `users` table for the profile: `SELECT role FROM users WHERE auth_id = user.id`.
5. Redirects to the role-appropriate dashboard. Falls back to the `next` query parameter (default: `/patient/dashboard`).
6. On error (no code or exchange fails), redirects to `/login?error=auth_callback_failed`.

---

## 3. User Identity Storage

Identity is stored in **two separate tables** at different layers:

### 3.1 Auth Layer: `auth.users` (Supabase-managed)

| Column | Content |
|--------|---------|
| `id` | UUID — the primary auth identity (referenced as `auth.uid()` in RLS) |
| `phone` | Phone number used for OTP login |
| `email` | Email (optional) |
| `raw_user_meta_data` | JSON — client-supplied metadata from `signUp({ data: {...} })`. Contains: name, phone, email, role (ignored by hardened trigger), age, gender, insurance |
| `raw_app_meta_data` | JSON — server-controlled metadata. Used for admin invitation flow: `invited_to_clinic`, `invited_role` |
| `created_at` | Timestamp |

### 3.2 Application Layer: `public.users` (App-managed)

| Column | Content |
|--------|---------|
| `id` | UUID — app-level user ID (referenced by all FK relationships: appointments, prescriptions, etc.) |
| `auth_id` | UUID FK → `auth.users.id` — links app user to auth identity |
| `clinic_id` | UUID FK → `clinics.id` — tenant association |
| `role` | TEXT — `super_admin`, `clinic_admin`, `receptionist`, `doctor`, `patient` |
| `name` | Display name |
| `phone` | Phone number |
| `email` | Email |
| `avatar_url` | Profile photo URL |
| `is_active` | Boolean — account status |
| `metadata` | JSONB — additional profile data |

### 3.3 Link Between the Two

The `auth_id` column in `public.users` links to `auth.users.id`. This link is established by the `handle_new_auth_user()` trigger which fires `AFTER INSERT ON auth.users` and creates a corresponding `public.users` row.

All RLS policies and profile lookups use `auth_id = auth.uid()` to resolve the app-level user from the Supabase auth context.

---

## 4. Session Lifecycle

### 4.1 Creation

Sessions are created when:
- `supabase.auth.verifyOtp()` succeeds (OTP login/registration)
- `supabase.auth.exchangeCodeForSession()` succeeds (OAuth/magic link callback)

Supabase Auth issues:
- **Access token (JWT):** Short-lived (default 1 hour), contains `sub` (user UUID), `role` (Supabase role, always `authenticated` for anon key), `aud`, `exp`.
- **Refresh token:** Long-lived, used to obtain new access tokens.

### 4.2 Storage

Tokens are stored in **httpOnly cookies** via `@supabase/ssr`. The cookie handler is configured in both:

**Server-side** (`src/lib/supabase-server.ts`):
```typescript
createServerClient(url, anonKey, {
  cookies: {
    getAll() { return cookieStore.getAll(); },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options)
      );
    },
  },
});
```

**Middleware** (`src/middleware.ts`):
```typescript
createServerClient(url, anonKey, {
  cookies: {
    getAll() { return request.cookies.getAll(); },
    setAll(cookiesToSet) {
      // Set on both request (for downstream handlers) and response (for browser)
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
      cookiesToSet.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(name, value, options)
      );
    },
  },
});
```

### 4.3 Refresh (Middleware)

On **every request** that matches the middleware matcher (all routes except static assets), the middleware:

1. Creates a Supabase server client with the request cookies.
2. Calls `supabase.auth.getUser()` — this internally checks if the access token is expired. If so, Supabase SDK automatically uses the refresh token to obtain a new access token.
3. The `setAll` cookie handler persists any updated tokens back to the response cookies.

This means sessions are **silently refreshed on every navigation** as long as the refresh token is still valid.

### 4.4 Usage

Once session cookies exist, any server-side code that creates a Supabase client (via `createClient()`) automatically picks up the session from cookies:

```
Request with cookies → createClient() → reads cookies → supabase.auth.getUser() → authenticated user
```

### 4.5 Destruction

`signOut()` in `src/lib/auth.ts` calls `supabase.auth.signOut()`, which:
1. Revokes the refresh token on the Supabase server.
2. Clears session cookies via the `setAll` handler.
3. Redirects to `/`.

---

## 5. Session Validation (Server vs Client)

### 5.1 Server-Side Validation

There are **three layers** of server-side session validation:

#### Layer 1: Middleware (`src/middleware.ts` lines 353-357)

```typescript
// IMPORTANT: Do NOT use getSession() here — it reads from cookies and
// can be tampered with. Use getUser() which validates with Supabase.
const { data: { user } } = await supabase.auth.getUser();
```

Key behavior:
- `getUser()` sends the access token to Supabase Auth server for validation — **not just cookie parsing**.
- If the token is expired, the SDK automatically tries to refresh it using the refresh token.
- If both tokens are invalid/expired, `user` is `null`.
- This runs on **every request** matching the middleware matcher.

#### Layer 2: API Route Auth (`src/lib/with-auth.ts` lines 51-53)

```typescript
const { data: { user } } = await supabase.auth.getUser();
```

Same `getUser()` call — validates the token with Supabase Auth on every API request. This is the second validation layer for API routes (middleware runs first, then the route handler).

#### Layer 3: Server Actions (`src/lib/auth.ts` lines 141-143)

```typescript
const { data: { user } } = await supabase.auth.getUser();
```

Same pattern for server actions called from Server Components via `getUserProfile()` / `requireAuth()` / `requireRole()`.

### 5.2 Client-Side

The browser-side Supabase client (`src/lib/supabase-client.ts`) uses `createBrowserClient()` from `@supabase/ssr`. It:
- Reads session tokens from cookies (set by the server via `Set-Cookie` headers).
- Can call `supabase.auth.getUser()` or `supabase.auth.getSession()` from the client.
- Client-side calls go directly to the Supabase API; no app server involvement.
- The client is created with the **anon key** — all data access is subject to RLS policies.

### 5.3 Summary

| Context | Method | Validates with Supabase server? |
|---------|--------|:-------------------------------:|
| Middleware | `getUser()` | Yes |
| API routes (`withAuth`) | `getUser()` | Yes |
| Server actions (`auth.ts`) | `getUser()` | Yes |
| Server Components (`requireAuth`) | `getUser()` | Yes |
| Client-side | `getUser()` / `getSession()` | `getUser()` = Yes, `getSession()` = No (cookie only) |

---

## 6. User Profile Fetching

After authentication confirms the auth identity (`auth.users.id`), the **application profile** must be fetched from `public.users` to determine the user's role, clinic, and permissions.

### 6.1 Where Profile Is Fetched

| Context | File | Query | Fields Selected |
|---------|------|-------|-----------------|
| After OTP verification | `src/lib/auth.ts` → `getUserProfile()` | `SELECT * FROM users WHERE auth_id = user.id` | All columns |
| Middleware (route gating) | `src/middleware.ts` line 367 | `SELECT role FROM users WHERE auth_id = user.id` | `role` only |
| API route auth | `src/lib/with-auth.ts` line 63 | `SELECT id, role, clinic_id FROM users WHERE auth_id = user.id` | `id`, `role`, `clinic_id` |
| Auth callback redirect | `src/app/auth/callback/route.ts` line 20 | `SELECT role FROM users WHERE auth_id = user.id` | `role` only |
| Server Components | `src/lib/auth.ts` → `requireAuth()` → `getUserProfile()` | `SELECT * FROM users WHERE auth_id = user.id` | All columns |

### 6.2 Profile Fetch Flow

```
auth.uid() (from JWT)
    │
    ▼
SELECT ... FROM public.users WHERE auth_id = auth.uid()
    │
    ▼
Returns: { id, auth_id, clinic_id, role, name, phone, email, avatar_url, is_active, metadata }
```

The profile is **always fetched from the database**, never from the JWT claims or cookies. This ensures:
- Role changes take effect immediately (no stale JWT claims).
- `clinic_id` is always the server-authoritative value.

---

## 7. Role System

### 7.1 How Roles Are Attached to Users

Roles are assigned at the `public.users` level (not in `auth.users`). There are three paths:

#### Path A: Self-Registration (patient)

1. User signs up via `/register` or `/login` (first-time phone).
2. `auth.users` row is created by Supabase Auth.
3. `on_auth_user_created` trigger fires `handle_new_auth_user()` (00028 hardened version).
4. Trigger **always** sets `role = 'patient'` regardless of any metadata the client sends.
5. `clinic_id` is set to `NULL` (no clinic association for self-registered patients, unless invited).

```sql
-- From 00028_security_hardening.sql
v_role TEXT := 'patient';  -- ALWAYS default to least-privileged role
```

#### Path B: Admin Invitation

1. An admin invites a user via the Supabase Admin API, setting `raw_app_meta_data`:
   ```json
   { "invited_to_clinic": "uuid-of-clinic", "invited_role": "doctor" }
   ```
2. When the invited user completes signup, the trigger reads from `raw_app_meta_data` (server-controlled, not user-controlled):
   ```sql
   IF NEW.raw_app_meta_data ? 'invited_to_clinic' THEN
     v_clinic_id := (NEW.raw_app_meta_data->>'invited_to_clinic')::UUID;
     v_role := COALESCE(NULLIF(NEW.raw_app_meta_data->>'invited_role', ''), 'patient');
     -- Only allow: receptionist, doctor, patient
     IF v_role NOT IN ('receptionist', 'doctor', 'patient') THEN
       v_role := 'patient';
     END IF;
   END IF;
   ```
3. The user is created with the invited role and clinic association.

#### Path C: Manual Assignment (super_admin / clinic_admin)

Roles like `super_admin` and `clinic_admin` **cannot** be set via the auth trigger. They must be assigned by:
- Direct database update by a super_admin.
- The `admin_users_all` RLS policy allows a `clinic_admin` to manage users within their clinic (but cannot set role to `super_admin`).
- The `sa_users_all` RLS policy allows `super_admin` to manage all users.

### 7.2 How Role Is Retrieved After Login

After successful OTP verification, the role retrieval chain is:

```
verifyOTP() succeeds
    │
    ▼
getUserProfile() called
    │
    ▼
supabase.auth.getUser() → gets auth user (id, phone, email)
    │
    ▼
SELECT * FROM public.users WHERE auth_id = user.id
    │
    ▼
profile.role → used for redirect:
  "super_admin"   → /super-admin/dashboard
  "clinic_admin"  → /admin/dashboard
  "receptionist"  → /receptionist/dashboard
  "doctor"        → /doctor/dashboard
  "patient"       → /patient/dashboard
```

### 7.3 Role Enforcement Points

| Where | How | Enforcement |
|-------|-----|-------------|
| **Middleware** (every request) | Fetches `role` from `users` table. Checks `pathname` against `ROLE_ROUTE_MAP`. | A `patient` cannot access `/admin/*`. A `doctor` cannot access `/receptionist/*`. `super_admin` can access everything. Unauthorized → redirect to own dashboard. |
| **API routes** (`withAuth`) | Fetches `role` from `users` table. Compares against `allowedRoles` parameter. | Returns 403 if role not in allowed list. Example: `withAuth(handler, ["super_admin", "clinic_admin"])`. |
| **Server Components** (`requireRole`) | Fetches full profile. Checks role against allowed list. | Redirects to own dashboard if role mismatch. |
| **RLS policies** (database) | Helper functions `get_user_role()`, `is_super_admin()`, `is_clinic_admin()`, `is_clinic_staff()` query `users` table via `auth.uid()`. | Row-level access control at the database layer. |

### 7.4 Available Roles

| Role | Dashboard Path | Route Prefix | Can Be Set Via |
|------|---------------|-------------|----------------|
| `super_admin` | `/super-admin/dashboard` | `/super-admin` | Manual DB update only |
| `clinic_admin` | `/admin/dashboard` | `/admin` | Manual DB update only |
| `receptionist` | `/receptionist/dashboard` | `/receptionist` | Admin invitation or manual |
| `doctor` | `/doctor/dashboard` | `/doctor` | Admin invitation or manual |
| `patient` | `/patient/dashboard` | `/patient` | Self-registration (default), admin invitation, or manual |

### 7.5 RLS Helper Functions for Role Checks

Defined in `00002_auth_rls_roles.sql`, all `SECURITY DEFINER`:

```sql
-- Returns the current user's app-level UUID
get_my_user_id()    → SELECT id FROM users WHERE auth_id = auth.uid()

-- Returns the current user's clinic UUID
get_user_clinic_id() → SELECT clinic_id FROM users WHERE auth_id = auth.uid()

-- Returns the current user's role string
get_user_role()      → SELECT role FROM users WHERE auth_id = auth.uid()

-- Boolean checks
is_super_admin()     → EXISTS(... role = 'super_admin')
is_clinic_admin(id)  → EXISTS(... role = 'clinic_admin' AND clinic_id = id)
is_clinic_staff()    → EXISTS(... role IN ('clinic_admin', 'receptionist', 'doctor'))
```

These functions bypass RLS on the `users` table (via `SECURITY DEFINER`) so they can always resolve the current user's identity, even when `users` table policies would otherwise restrict access.

---

*End of analysis. This document explains how auth works — no vulnerability analysis or suggestions included.*
