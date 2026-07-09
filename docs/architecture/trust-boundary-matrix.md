# Trust-Boundary Matrix

Oltigo Health employs a multi-layered trust boundary architecture. A request must successfully navigate through Edge, Auth, App Logic, and Database RLS boundaries to mutate or read data. This matrix documents the enforcement mechanisms at each boundary and explicitly maps out the "bypass" paths (Service Role).

## 1. The Matrix

| Boundary Layer             | Enforcement Mechanism         | What it Guards                                                                                   | Trust Assumption                                                                   |
| :------------------------- | :---------------------------- | :----------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| **Edge (Cloudflare / MW)** | `src/middleware.ts`           | Subdomain resolution, CSRF (Origin header checks), Role-based route prefixes (`ROLE_ROUTE_MAP`). | Assumes nothing. Strips incoming `x-clinic-id` headers. Evaluates JWT if present.  |
| **Auth (Supabase Auth)**   | `src/lib/auth.ts`, `withAuth` | Validates session signature. Resolves `UserRole`.                                                | Trusts Edge to pass the Authorization cookie. Validates token cryptographically.   |
| **App Logic (Next.js)**    | `requireTenant()`, `Zod`      | `clinic_id` scoping, payload shape validation, role authorization (`clinic_admin`, `doctor`).    | Trusts Auth for `UserRole`. Assumes client payload is hostile until Zod-parsed.    |
| **Database (RLS)**         | Row Level Security Policies   | Prevents forged `clinic_id` or `patient_id` data access at the Postgres level.                   | Trusts App Logic to pass the correct JWT to the Supabase client.                   |
| **Service-Role (Bypass)**  | `SUPABASE_SERVICE_ROLE_KEY`   | Bypasses all RLS. Used exclusively for Cron, Webhooks, and Super Admin actions.                  | Fully trusts the caller. Guarded strictly by internal API keys or HMAC signatures. |

## 2. Boundary Details & Failure Postures

### A. Edge Layer (Middleware)

- **Role:** First line of defense.
- **Action:** Strips malicious headers (`x-clinic-id`). Matches the requested route prefix (e.g. `/doctor/`) against the authenticated user's role.
- **Failure Posture:** Fail closed. Unknown roles or mismatched prefixes redirect to `/login` or `/unauthorized`.

### B. Auth Layer

- **Role:** Identity verification.
- **Action:** Uses Supabase's `getUser()` to verify the session cryptographically.
- **Failure Posture:** Any tampering invalidates the session immediately.

### C. App Logic Layer (Tenant Isolation)

- **Role:** Application-side tenant isolation.
- **Action:** `requireTenant()` is called in every server action and API route. It extracts the `clinic_id` from the Auth session. Every `.select()`, `.update()`, `.insert()`, or `.delete()` operation MUST append `.eq("clinic_id", clinicId)`.
- **Failure Posture:** If a user profile lacks a `clinic_id` (e.g. they are in an inconsistent state), operations throw an error and abort.

### D. RLS Layer (Database)

- **Role:** Final backstop against missing App Logic filters.
- **Action:** Even if a developer forgets `.eq("clinic_id", clinicId)`, Postgres RLS enforces `auth.uid() = user_id` OR `auth.jwt() ->> 'clinic_id' = clinic_id`.
- **Failure Posture:** Missing `.eq()` with a valid JWT simply returns 0 rows (silent fail-safe).

## 3. Service-Role Paths (The Danger Zone)

Certain operations must bypass RLS. These use `createScopedAdminClient` or `createClient` initialized with `SUPABASE_SERVICE_ROLE_KEY`.

| Subsystem             | Entry Point              | Enforcement                                                                                                         |
| :-------------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Cron Jobs**         | `worker-cron-handler.ts` | Validates `CRON_SECRET` header before dispatching to `/api/cron/*`.                                                 |
| **WhatsApp Webhooks** | `/api/webhooks/whatsapp` | Validates `X-Hub-Signature-256` (HMAC-SHA256) from Meta/Twilio.                                                     |
| **Stripe Webhooks**   | `/api/webhooks/stripe`   | Validates Stripe cryptographic signature.                                                                           |
| **Super Admin**       | `/super-admin/*`         | `requireRole('super_admin')`. Only Oltigo staff can reach these actions. Every mutation triggers `logAuditEvent()`. |

> **Security Rule:** Never instantiate a service-role client based on unvalidated user input. For Webhooks, always resolve the target `clinic_id` securely from the signed payload metadata, never from query parameters.
