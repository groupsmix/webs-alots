# Authentication Flow Analysis

> Scope: `auth.ts`, Supabase Auth (OTP flow), `middleware.ts` (auth checks), session handling (`@supabase/ssr`), auth callback (`/auth/callback`)

---

## 1. Step-by-Step Auth Flow

### 1.1 Login (Existing User)

| Step | What happens | File |
|------|-------------|------|
| 1 | User visits `/login`. The `(auth)` layout renders a centered card. | `src/app/(auth)/layout.tsx` |
| 2 | User enters phone number and submits. `handleSendOTP()` is called. | `src/app/(auth)/login/page.tsx:26-46` |
| 3 | Client calls the **server action** `signInWithOTP(phone)`. | `src/lib/auth.ts:40-52` |
| 4 | `signInWithOTP` creates a **server-side** Supabase client via `createClient()` (uses `@supabase/ssr` `createServerClient` with cookie-based session storage). | `src/lib/supabase-server.ts:13-37` |
| 5 | Calls `supabase.auth.signInWithOtp({ phone })`. Supabase sends an SMS OTP to the phone number. | `src/lib/auth.ts:43-45` |
| 6 | On success, the login page transitions to the OTP input step (`setStep("otp")`). | `src/app/(auth)/login/page.tsx:40` |
| 7 | User enters the 6-digit OTP code and submits. `handleVerifyOTP()` is called. | `src/app/(auth)/login/page.tsx:48-63` |
| 8 | Client calls the **server action** `verifyOTP(phone, token)`. | `src/lib/auth.ts:58-82` |
| 9 | `verifyOTP` calls `supabase.auth.verifyOtp({ phone, token, type: "sms" })`. Supabase validates the OTP and creates a session (JWT + refresh token stored in cookies via `@supabase/ssr`). | `src/lib/auth.ts:64-68` |
| 10 | On success, `getUserProfile()` is called to fetch the user's role from the `users` table. | `src/lib/auth.ts:75` |
| 11 | The user is redirected to their **role-specific dashboard** via `redirect(ROLE_DASHBOARD_MAP[profile.role])`. | `src/lib/auth.ts:77` |
| 12 | If no profile is found (edge case), fallback redirect goes to `/patient/dashboard`. | `src/lib/auth.ts:81` |

### 1.2 Registration (New Patient)

| Step | What happens | File |
|------|-------------|------|
| 1 | User visits `/register`. Fills in name, phone, email, age, gender, insurance. | `src/app/(auth)/register/page.tsx` |
| 2 | `handleRegister()` calls the **server action** `registerPatient(data)`. | `src/lib/auth.ts:89-119` |
| 3 | `registerPatient` calls `supabase.auth.signInWithOtp({ phone, options: { data: {...} } })`. The `options.data` object contains `name`, `phone`, `email`, `role: "patient"`, `age`, `gender`, `insurance`. This metadata is stored in `auth.users.raw_user_meta_data`. | `src/lib/auth.ts:99-112` |
| 4 | Supabase sends SMS OTP. Page transitions to OTP step. | `src/app/(auth)/register/page.tsx:60` |
| 5 | User enters OTP. `handleVerifyOTP()` calls `verifyOTP(phone, otp)` (same as login). | `src/app/(auth)/register/page.tsx:68-83` |
| 6 | On successful OTP verification, Supabase creates the `auth.users` row. The **database trigger** `on_auth_user_created` fires and auto-creates the `public.users` profile. | `supabase/migrations/00002_auth_rls_roles.sql:91-110` |
| 7 | The trigger reads `raw_user_meta_data` to populate: `role` (defaults to `'patient'`), `name`, `phone`, `email`, `clinic_id`. | `supabase/migrations/00002_auth_rls_roles.sql:94-102` |
| 8 | `verifyOTP` then calls `getUserProfile()` and redirects to the role-based dashboard. | `src/lib/auth.ts:75-81` |

### 1.3 Auth Callback (Code Exchange)

| Step | What happens | File |
|------|-------------|------|
| 1 | Supabase redirects to `/auth/callback?code=...&next=...` (used for OAuth/magic-link flows). | `src/app/auth/callback/route.ts` |
| 2 | The route handler calls `supabase.auth.exchangeCodeForSession(code)` to exchange the auth code for a session. | `src/app/auth/callback/route.ts:11` |
| 3 | On success, it calls `supabase.auth.getUser()` to get the authenticated user. | `src/app/auth/callback/route.ts:15-17` |
| 4 | Fetches the user's `role` from `public.users` via `auth_id`. | `src/app/auth/callback/route.ts:20-24` |
| 5 | Redirects to the role-based dashboard (or falls back to the `next` query param, defaulting to `/patient/dashboard`). | `src/app/auth/callback/route.ts:35-36` |

### 1.4 Sign Out

| Step | What happens | File |
|------|-------------|------|
| 1 | `signOut()` server action calls `supabase.auth.signOut()`, which clears the session cookies. | `src/lib/auth.ts:124-128` |
| 2 | Redirects to `/` (home page). | `src/lib/auth.ts:127` |

---

## 2. User Identity Storage

### 2.1 Supabase `auth.users` (Authentication Layer)

- **Primary identity table** managed by Supabase Auth.
- Stores: `id` (UUID), `phone`, `email`, `encrypted_password`, `raw_user_meta_data` (JSON with role, name, etc.), `raw_app_meta_data` (provider info).
- The `auth.identities` table stores provider-specific identity data (phone provider, with `phone_verified` flag).
- Created automatically when OTP is verified for a new phone number.

### 2.2 `public.users` (Application Layer)

- **Application profile table** linked to `auth.users` via the `auth_id` column (= `auth.users.id`).
- Schema (from `UserProfile` type):

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Internal user ID (primary key) |
| `auth_id` | UUID | FK to `auth.users.id` |
| `clinic_id` | UUID or null | FK to `clinics.id` |
| `role` | enum | `super_admin`, `clinic_admin`, `receptionist`, `doctor`, `patient` |
| `name` | string | Display name |
| `phone` | string or null | Phone number |
| `email` | string or null | Email address |
| `avatar_url` | string or null | Profile picture URL |
| `is_active` | boolean | Account active flag |
| `metadata` | JSON | Arbitrary extra data |

- **Auto-created** by the `handle_new_auth_user()` trigger on `auth.users` INSERT.

---

## 3. Session Validation

### 3.1 Server-Side (Middleware — Every Request)

**File:** `src/middleware.ts`

1. A Supabase server client is created using `createServerClient` from `@supabase/ssr` with cookie-based storage (lines 301-325).
2. The cookie handlers (`getAll` / `setAll`) read from `request.cookies` and write to `supabaseResponse.cookies`, ensuring the session token is refreshed on every request.
3. **`supabase.auth.getUser()` is called** (line 355-357) — this validates the JWT with the Supabase server (NOT just reading cookies). A comment explicitly warns against using `getSession()` because it can be tampered with.
4. If the user is authenticated and visiting a protected route, the middleware fetches the `role` from `public.users` (lines 367-371) to enforce route-level access control.

### 3.2 Server-Side (Server Components & Server Actions)

**File:** `src/lib/supabase-server.ts`

- `createClient()` creates a `createServerClient` instance using `cookies()` from `next/headers`.
- The `setAll` callback has a try/catch that silently ignores errors when called from Server Components (cookies are read-only in RSC). The middleware handles session refresh.

### 3.3 Client-Side (Browser)

**File:** `src/lib/supabase-client.ts`

- `createClient()` creates a `createBrowserClient` instance from `@supabase/ssr`.
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- The browser client automatically manages session tokens via cookies (set by the server-side middleware).

### 3.4 API Route Auth (withAuth wrapper)

**File:** `src/lib/with-auth.ts`

- A reusable wrapper for API route handlers.
- Steps:
  1. Creates a server-side Supabase client.
  2. Calls `supabase.auth.getUser()` to validate the session (returns 401 if not authenticated).
  3. Fetches `id`, `role`, `clinic_id` from `public.users` where `auth_id = user.id` (returns 404 if no profile).
  4. Checks the user's role against the `allowedRoles` array (returns 403 if insufficient permissions). Passing `null` skips role checking.
  5. Passes an `AuthContext` object (`{ supabase, user, profile }`) to the wrapped handler.

### 3.5 API Key Auth (Public V1 Endpoints)

**File:** `src/lib/api-auth.ts`

- Separate auth path for public REST API endpoints.
- API keys are passed via `Authorization: Bearer <key>` header.
- Keys are stored as SHA-256 hashes in `clinic_api_keys` table with a prefix for fast lookup.
- Validates using timing-safe comparison. Returns `{ clinicId }` on success.

### 3.6 Cron Auth

**File:** `src/lib/cron-auth.ts`

- Cron endpoints use a `CRON_SECRET` bearer token.
- Validated with timing-safe comparison.

---

## 4. User Profile Fetching

### 4.1 `getUserProfile()` — Full Profile

**File:** `src/lib/auth.ts:138-154`

1. Calls `supabase.auth.getUser()` to get the Supabase auth user.
2. Queries `public.users` with `SELECT *` where `auth_id = user.id` (`.single()`).
3. Returns the full `UserProfile` object or `null`.
4. Used after OTP verification to determine redirect, and by `requireAuth()` / `requireRole()`.

### 4.2 Middleware Profile Fetch (Minimal)

**File:** `src/middleware.ts:367-371`

- Only fetches `role` from `public.users` (not the full profile).
- Only runs when the user is authenticated AND visiting `/login`, `/register`, or a protected route.
- Uses `.maybeSingle()` to avoid throwing on missing profiles.

### 4.3 `withAuth` Profile Fetch (API Routes)

**File:** `src/lib/with-auth.ts:63-67`

- Fetches `id`, `role`, `clinic_id` from `public.users`.
- Uses `.single()` (expects exactly one result).

---

## 5. Role System

### 5.1 Five Roles

| Role | Route Prefix | Dashboard Path |
|------|-------------|----------------|
| `super_admin` | `/super-admin` | `/super-admin/dashboard` |
| `clinic_admin` | `/admin` | `/admin/dashboard` |
| `receptionist` | `/receptionist` | `/receptionist/dashboard` |
| `doctor` | `/doctor` | `/doctor/dashboard` |
| `patient` | `/patient` | `/patient/dashboard` |

### 5.2 How Roles Are Attached to Users

1. **Registration (new patient):** The `registerPatient()` server action passes `role: "patient"` in `options.data` when calling `signInWithOtp()`. This is stored in `auth.users.raw_user_meta_data`.
2. **Database trigger (`handle_new_auth_user`):** When a new `auth.users` row is inserted, the trigger reads `raw_user_meta_data->>'role'` and falls back to `'patient'` if not set. It inserts this into `public.users.role`.
3. **Staff roles:** Staff accounts (admin, doctor, receptionist) are created by clinic admins or super admins through the application, with the role explicitly set. The seed migration (`00019`) pre-creates auth.users + identities for seed users with roles set in `raw_user_meta_data`.

### 5.3 How Role Is Retrieved After Login

1. **During OTP verification (`verifyOTP`):** Calls `getUserProfile()` which queries `public.users` by `auth_id`. The `role` field determines the redirect target via `ROLE_DASHBOARD_MAP`.
2. **During auth callback:** The `/auth/callback` route queries `public.users` for `role` by `auth_id` and redirects accordingly.
3. **On every request (middleware):** The middleware calls `getUser()` then queries `public.users` for `role` to enforce route access. `super_admin` bypasses all route restrictions. Other roles can only access their designated route prefix.
4. **In API routes (`withAuth`):** Queries `public.users` for `role` and checks against the handler's `allowedRoles` array.

### 5.4 Role Constants

**File:** `src/lib/auth-roles.ts`

- `STAFF_ROLES` array: `["super_admin", "clinic_admin", "receptionist", "doctor"]` — shared across 14+ API route files for authorization checks.

---

## 6. Session Lifecycle

```
 [1] OTP Request
      |
      |  signInWithOTP(phone)  →  Supabase sends SMS
      |
 [2] OTP Verification
      |
      |  verifyOTP(phone, token)  →  supabase.auth.verifyOtp()
      |  Supabase validates OTP, creates session (JWT + refresh token)
      |  @supabase/ssr stores tokens in HTTP-only cookies
      |
 [3] Session Created
      |
      |  Cookies set on response:
      |    - sb-<project>-auth-token (access token / JWT)
      |    - sb-<project>-auth-token-code-verifier (PKCE)
      |
 [4] Session Usage (every request)
      |
      |  middleware.ts runs:
      |    1. Creates Supabase client with cookie handlers
      |    2. supabase.auth.getUser() validates JWT with Supabase server
      |    3. Cookie handlers refresh tokens if needed (setAll callback)
      |    4. Refreshed cookies are set on the response
      |
 [5] Session in Server Components / Actions
      |
      |  supabase-server.ts createClient():
      |    - Reads cookies via next/headers cookies()
      |    - Calls getUser() for validation
      |    - setAll errors are silently caught (read-only in RSC)
      |    - Middleware already handles refresh
      |
 [6] Session in Client Components
      |
      |  supabase-client.ts createClient():
      |    - createBrowserClient from @supabase/ssr
      |    - Auto-manages cookies in the browser
      |    - Used for real-time subscriptions, client-side queries
      |
 [7] Session End (Sign Out)
      |
      |  signOut()  →  supabase.auth.signOut()
      |  Clears session cookies
      |  Redirects to /
```

---

## 7. Key Files Summary

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | Server actions: `signInWithOTP`, `verifyOTP`, `registerPatient`, `signOut`, `getUserProfile`, `requireAuth`, `requireRole` |
| `src/lib/supabase-server.ts` | Creates server-side Supabase client with cookie-based session (for Server Components, Actions, API Routes) |
| `src/lib/supabase-client.ts` | Creates browser-side Supabase client (for Client Components) |
| `src/middleware.ts` | Runs on every request: session validation via `getUser()`, role-based route enforcement, tenant resolution, CSRF protection |
| `src/app/auth/callback/route.ts` | Handles OAuth/magic-link code exchange, redirects to role-based dashboard |
| `src/app/(auth)/login/page.tsx` | Login UI: phone input + OTP verification (two-step form) |
| `src/app/(auth)/register/page.tsx` | Registration UI: patient info + OTP verification |
| `src/app/(auth)/layout.tsx` | Centered layout wrapper for auth pages |
| `src/lib/with-auth.ts` | Reusable API route wrapper: auth + role check, provides `AuthContext` |
| `src/lib/auth-roles.ts` | Shared `STAFF_ROLES` constant for API authorization |
| `src/lib/api-auth.ts` | API key authentication for public V1 REST endpoints |
| `src/lib/cron-auth.ts` | Cron endpoint authentication via `CRON_SECRET` bearer token |
| `supabase/migrations/00002_auth_rls_roles.sql` | DB trigger `handle_new_auth_user` (auto-creates profile on signup), RLS helper functions (`get_user_role`, `get_my_user_id`, `get_user_clinic_id`, etc.), RLS policies |

---

## 8. Middleware Auth Check Flow (Visual)

```
Request arrives
    │
    ├─ Static asset? ─────────────────────> SKIP (matcher excludes _next/static, images, etc.)
    │
    ├─ Supabase not configured? ──────────> Protected route? → Redirect /login
    │                                       Public route? → Pass through
    │
    ├─ Create Supabase client (cookies)
    │
    ├─ Resolve subdomain → lookup clinic → set tenant headers
    │
    ├─ supabase.auth.getUser() ───────────> Validates JWT with Supabase server
    │
    ├─ Is PUBLIC route?
    │   ├─ User logged in + on /login or /register?
    │   │   └─ Fetch role → Redirect to role dashboard
    │   └─ Otherwise → Pass through
    │
    ├─ Is PROTECTED route + NOT authenticated?
    │   └─ Redirect to /login?redirect=<path>
    │
    ├─ Is PROTECTED route + authenticated?
    │   ├─ Fetch role from public.users
    │   ├─ super_admin? → Pass through (access everything)
    │   ├─ Role prefix matches path? → Pass through
    │   └─ Role prefix doesn't match? → Redirect to own dashboard
    │
    └─ Pass through
```
