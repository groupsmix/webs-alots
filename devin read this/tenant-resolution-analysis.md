# Tenant Resolution & Propagation Flow Analysis

## Step-by-Step Tenant Flow

### Step 1: Browser Request Arrives

```
Browser → https://demo-clinic.example.com/services
                    ↑ subdomain
```

The middleware matcher intercepts ALL requests except static assets:
```
/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```

**File:** `src/middleware.ts:414-425`

---

### Step 2: Subdomain Extraction

**File:** `src/lib/subdomain.ts` → `extractSubdomain(hostname, rootDomain)`

The middleware reads the hostname and `ROOT_DOMAIN` env var:

```ts
const hostname = request.headers.get("host") ?? "";      // "demo-clinic.example.com"
const rootDomain = process.env.ROOT_DOMAIN;               // "example.com"
const subdomain = extractSubdomain(hostname, rootDomain); // "demo-clinic"
```

**Extraction logic (3 paths):**

| Hostname | ROOT_DOMAIN | Result | Path taken |
|----------|-------------|--------|------------|
| `demo.localhost:3000` | (any) | `"demo"` | Strips `.localhost`, ignores port |
| `demo.example.com` | `example.com` | `"demo"` | Strips `.example.com` suffix |
| `example.com` | `example.com` | `null` | Host equals root domain |
| `www.example.com` | `example.com` | `null` | `"www"` is explicitly filtered |
| `a.b.example.com` | `example.com` | `null` | Multi-level subdomains rejected (contains `.`) |
| `anything.com` | not set | `null` | No `ROOT_DOMAIN` → cannot extract |

**Key behaviors:**
- Port is stripped before comparison (`hostname.split(":")[0]`)
- `ROOT_DOMAIN` port is also stripped
- Only single-level subdomains are accepted
- `"www"` always returns `null`

---

### Step 3: Clinic Lookup in Database

**File:** `src/middleware.ts:327-351`

If `subdomain` is non-null, the middleware queries Supabase:

```ts
if (subdomain) {
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, type, tier, subdomain")
    .eq("subdomain", subdomain)
    .single();
```

**Two outcomes:**

**A) Clinic NOT found →** Redirect to root domain:
```ts
if (!clinic) {
  const rootUrl = rootDomain
    ? `${request.nextUrl.protocol}//${rootDomain}`
    : request.nextUrl.origin;
  return NextResponse.redirect(rootUrl);
}
```

**B) Clinic found →** Set tenant headers on the response:
```ts
setTenantHeaders(supabaseResponse, {
  id: clinic.id,
  name: clinic.name,
  subdomain: clinic.subdomain ?? subdomain,
  type: clinic.type,
  tier: clinic.tier,
});
```

---

### Step 4: Tenant Headers Injected into Response

**File:** `src/middleware.ts:88-97`

The `setTenantHeaders()` function sets 5 response headers:

```ts
function setTenantHeaders(response, clinic) {
  response.headers.set("x-tenant-clinic-id",   clinic.id);
  response.headers.set("x-tenant-clinic-name", clinic.name);
  response.headers.set("x-tenant-subdomain",   clinic.subdomain);
  response.headers.set("x-tenant-clinic-type",  clinic.type);
  response.headers.set("x-tenant-clinic-tier",  clinic.tier);
}
```

**Header names are defined as constants in:**

**File:** `src/lib/tenant.ts:20-26`

```ts
export const TENANT_HEADERS = {
  clinicId:   "x-tenant-clinic-id",
  clinicName: "x-tenant-clinic-name",
  subdomain:  "x-tenant-subdomain",
  clinicType: "x-tenant-clinic-type",
  clinicTier: "x-tenant-clinic-tier",
} as const;
```

**These headers are set on the `NextResponse`, NOT on the incoming `requestHeaders`.** This is critical — they travel on the *response* object that Next.js forwards to downstream rendering.

---

### Step 5: Server-Side Consumption (Server Components & Server Actions)

**File:** `src/lib/tenant.ts:34-47`

Server Components and Server Actions call `getTenant()` to read the headers:

```ts
export async function getTenant(): Promise<TenantInfo | null> {
  const h = await headers();                            // Next.js headers() API
  const clinicId = h.get(TENANT_HEADERS.clinicId);      // "x-tenant-clinic-id"

  if (!clinicId) return null;

  return {
    clinicId,
    clinicName: h.get(TENANT_HEADERS.clinicName) ?? "",
    subdomain:  h.get(TENANT_HEADERS.subdomain) ?? "",
    clinicType: h.get(TENANT_HEADERS.clinicType) ?? "",
    clinicTier: h.get(TENANT_HEADERS.clinicTier) ?? "",
  };
}
```

**Returns `null` when:**
- No subdomain was resolved (root domain visit)
- Super admin on root domain
- Middleware skipped (static assets)

**Consumers of `getTenant()` (found in codebase):**
1. `src/app/layout.tsx:57` — Root layout reads tenant and passes to `TenantProvider`
2. `src/middleware.ts` — Not a consumer (it's the producer)

---

### Step 6: Server → Client Bridge (Root Layout)

**File:** `src/app/layout.tsx:52-94`

The root layout is an **async Server Component** that bridges tenant data from server headers to the client React tree:

```tsx
export default async function RootLayout({ children }) {
  const tenant = await getTenant();   // Reads x-tenant-* headers

  return (
    <html>
      <body>
        <TenantProvider tenant={tenant}>   {/* Passes to client context */}
          {children}
          <Chatbot />
        </TenantProvider>
      </body>
    </html>
  );
}
```

**`tenant` is serialized from server to client as a prop to `TenantProvider`.** This is the ONLY bridge point — there is no other mechanism transferring tenant headers to client components.

---

### Step 7: Client-Side Consumption (Client Components)

**File:** `src/components/tenant-provider.tsx`

```tsx
"use client";

const TenantContext = createContext<ClientTenantInfo | null>(null);

export function useTenant(): ClientTenantInfo | null {
  return useContext(TenantContext);
}

export function TenantProvider({ tenant, children }) {
  return (
    <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
  );
}
```

**Client components call `useTenant()` to get:**
```ts
interface ClientTenantInfo {
  clinicId: string;
  clinicName: string;
  subdomain: string;
  clinicType: string;
  clinicTier: string;
}
```

**Returns `null` when on root domain (no subdomain resolved).**

**Consumers of `useTenant()` (found in codebase):**
1. `src/components/chatbot/index.tsx:13` — Reads `tenant.clinicId` to conditionally render chatbot and pass to `ChatbotProvider`
2. `src/components/chatbot/chatbot-widget.tsx` — Uses tenant context

---

## How clinic_id Is Determined (All Paths)

There are **3 distinct mechanisms** for determining clinic_id, used in different contexts:

### Mechanism 1: Subdomain → Middleware Headers (Primary)

```
subdomain.ts → middleware.ts → x-tenant-clinic-id header → getTenant() / useTenant()
```

**Used by:** Server Components via `getTenant()`, Client Components via `useTenant()`, the Chat API route.

**Database query:** `clinics WHERE subdomain = :extracted_subdomain`

### Mechanism 2: Static Config File (clinicConfig.clinicId)

**File:** `src/config/clinic.config.ts:128`

```ts
export const clinicConfig: ClinicConfig = {
  clinicId: "demo-clinic",   // Hardcoded per deployment
  ...
};
```

**Used by:**
- `src/lib/data/public.ts` — ALL public data fetching functions read `clinicConfig.clinicId` directly (NOT from headers)
- `src/app/api/booking/route.ts` — Booking API reads `clinicConfig.clinicId`
- `src/app/api/branding/route.ts` — Branding API reads `clinicConfig.clinicId`
- `src/lib/timezone.ts` — Reads `clinicConfig.timezone`
- `src/lib/data/public.ts:83-85` — `getClinicId()` helper returns `clinicConfig.clinicId`

This is a **build-time / deployment-time constant**. It does NOT come from the request.

### Mechanism 3: User Profile (clinic_id column)

**File:** `src/lib/with-auth.ts:63-67`

```ts
const { data: profile } = await supabase
  .from("users")
  .select("id, role, clinic_id")
  .eq("auth_id", user.id)
  .single();
```

**Used by:** API routes wrapped with `withAuth()`. The `auth.profile.clinic_id` comes from the `users` table — each user has a `clinic_id` FK. This is used for:
- Notification routes (cross-clinic check: `recipient.clinic_id !== profile.clinic_id`)
- Any authenticated API that needs to scope data to the user's clinic

---

## Where Tenant Context Is Stored

| Storage | What | Set by | Read by |
|---------|------|--------|---------|
| HTTP response headers (`x-tenant-*`) | clinicId, clinicName, subdomain, clinicType, clinicTier | `middleware.ts` via `setTenantHeaders()` | Server Components via `getTenant()` using Next.js `headers()` API |
| React Context (`TenantContext`) | Same 5 fields | `layout.tsx` passes `getTenant()` result to `TenantProvider` | Client Components via `useTenant()` hook |
| Static config (`clinicConfig`) | clinicId (hardcoded) | Build-time configuration in `clinic.config.ts` | `data/public.ts`, `booking/route.ts`, `branding/route.ts`, `timezone.ts` |
| User profile (`users.clinic_id`) | clinic_id FK | Set on user creation (auth trigger or admin action) | `with-auth.ts`, notification routes, middleware role check |

---

## How Tenant Context Is Injected Into Each Request Type

### Page Requests (Server Components)

```
Browser → middleware (extract subdomain → DB lookup → set x-tenant-* headers)
  → Next.js renders Server Component → calls getTenant() → reads headers
  → Root Layout passes tenant to TenantProvider → client components use useTenant()
```

### API Route Requests

API routes have **three different patterns** for obtaining clinic_id:

**Pattern A: From tenant headers (only chat route does this)**
```ts
// src/app/api/chat/route.ts:76
const tenantClinicId = request.headers.get(TENANT_HEADERS.clinicId);
```

**Pattern B: From static config (booking, branding routes)**
```ts
// src/app/api/booking/route.ts
clinicConfig.clinicId   // build-time constant
```

**Pattern C: From authenticated user's profile (notification, custom-field routes)**
```ts
// via withAuth() wrapper
auth.profile.clinic_id  // from users table
```

### Cron Job Requests

Cron routes (`/api/cron/reminders`, `/api/cron/billing`) do NOT use tenant context. They iterate across ALL clinics by querying the `clinics` table directly.

### Public V1 API Requests

V1 routes (`/api/v1/appointments`, `/api/v1/patients`) use API key auth (`src/lib/api-auth.ts`). The API key lookup returns the clinic_id associated with that key from the `api_keys` table.

---

## Where Tenant Context Could Break or Be Missing

### 1. No Subdomain Resolved → `getTenant()` Returns `null`

**When this happens:**
- Request to root domain (`example.com`) — no subdomain to extract
- `ROOT_DOMAIN` env var not set — `extractSubdomain()` returns `null` for non-localhost hosts
- `"www"` subdomain — explicitly filtered to `null`
- Multi-level subdomain (`a.b.example.com`) — rejected

**Effect:** `getTenant()` returns `null`. `useTenant()` returns `null`. Components that call `tenant.clinicId` without a null check would throw.

**Current handling:** The `Chatbot` component checks `if (!tenant?.clinicId) return null`. Other consumers of `useTenant()` may or may not have null guards.

### 2. Subdomain Exists but No Matching Clinic in DB

**When this happens:** Someone visits `nonexistent.example.com`.

**Effect:** Middleware redirects to root domain. No tenant headers are set. Downstream code never executes for this request.

### 3. Static `clinicConfig.clinicId` Disagrees with Subdomain-Resolved Clinic

**The core tension:** There are two independent sources of clinic_id:
- **Dynamic:** Subdomain → middleware → `x-tenant-clinic-id` header
- **Static:** `clinicConfig.clinicId` (hardcoded to `"demo-clinic"`)

The `data/public.ts` layer, `booking/route.ts`, and `branding/route.ts` all use `clinicConfig.clinicId` — they ignore the subdomain-resolved tenant entirely. Meanwhile, `getTenant()` and `useTenant()` return the subdomain-resolved tenant.

**This means:** If clinic A is visited via subdomain, the client-side `useTenant()` returns clinic A's ID, but `data/public.ts` fetches data for whichever clinic is hardcoded in `clinicConfig.clinicId`.

**In a single-tenant deployment** (one build per clinic), this is consistent because both values point to the same clinic. **In a true multi-tenant deployment** (single build serving all clinics via subdomains), these two values would diverge.

### 4. Middleware Skipped (Static Assets)

The middleware matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and image file extensions. These requests never have tenant headers set. This is expected — static assets don't need tenant context.

### 5. Supabase Not Configured

**File:** `src/middleware.ts:274-292`

If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing:
- Middleware skips the entire clinic lookup
- No tenant headers are set
- `getTenant()` returns `null`
- Protected routes redirect to login

### 6. API Routes Using `clinicConfig` Instead of Request Headers

The following API routes use the static `clinicConfig.clinicId` rather than the request's tenant headers:

| Route | Uses |
|-------|------|
| `api/booking/route.ts` | `clinicConfig.clinicId` |
| `api/branding/route.ts` | `clinicConfig.clinicId` |

This means these routes always operate on the build-time configured clinic, regardless of which subdomain the request arrived on.

### 7. Chat Route's Fallback to Request Body

**File:** `src/app/api/chat/route.ts:76-83`

```ts
const tenantClinicId = request.headers.get(TENANT_HEADERS.clinicId);
const clinicId = tenantClinicId || body.clinicId;
```

The chat route reads from tenant headers first, then falls back to `body.clinicId` from the request payload. If neither is present, it returns 400.

### 8. `getTenant()` on Root Domain Pages

Any Server Component that calls `getTenant()` on a root domain request (no subdomain) will get `null`. If the component uses `tenant!.clinicId` (non-null assertion) or `tenant.clinicId` without checking for null, it would throw a runtime error.

### 9. The Header Bridge Requires Root Layout

Tenant context reaches client components ONLY through the `TenantProvider` in `src/app/layout.tsx`. If a route group defines its own layout that does NOT wrap children in `TenantProvider`, client components in that group would get `null` from `useTenant()` even if tenant headers exist on the response.

---

## Key Files Summary

| File | Role in Tenant Flow |
|------|---------------------|
| `src/lib/subdomain.ts` | Pure function: hostname → subdomain string (or null) |
| `src/middleware.ts` | Orchestrator: calls `extractSubdomain()`, queries DB, sets `x-tenant-*` response headers |
| `src/lib/tenant.ts` | Defines header constants (`TENANT_HEADERS`) and server-side reader (`getTenant()`) |
| `src/components/tenant-provider.tsx` | Client-side React context: receives tenant from server, exposes `useTenant()` hook |
| `src/app/layout.tsx` | Bridge: calls `getTenant()` server-side, passes result as prop to `TenantProvider` |
| `src/config/clinic.config.ts` | Static config: hardcoded `clinicId` used by `data/public.ts` and some API routes |
| `src/lib/with-auth.ts` | Authenticated user's `clinic_id` from `users` table (independent of subdomain) |

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER REQUEST: https://demo.example.com/services                     │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  middleware.ts                                                           │
│                                                                          │
│  1. hostname = "demo.example.com"                                        │
│  2. rootDomain = process.env.ROOT_DOMAIN  ("example.com")                │
│  3. subdomain = extractSubdomain(hostname, rootDomain)  → "demo"         │
│                                                                          │
│  4. IF subdomain:                                                        │
│     │  query: clinics WHERE subdomain = "demo"                           │
│     │                                                                    │
│     ├─ NOT FOUND → redirect to root domain                               │
│     │                                                                    │
│     └─ FOUND (id, name, type, tier, subdomain) →                         │
│        setTenantHeaders(response, clinic)                                │
│        → response.headers.set("x-tenant-clinic-id", clinic.id)           │
│        → response.headers.set("x-tenant-clinic-name", clinic.name)       │
│        → response.headers.set("x-tenant-subdomain", clinic.subdomain)    │
│        → response.headers.set("x-tenant-clinic-type", clinic.type)       │
│        → response.headers.set("x-tenant-clinic-tier", clinic.tier)       │
│                                                                          │
│  5. Continue to Next.js routing (return supabaseResponse)                │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  layout.tsx (Root Layout — Server Component)                             │
│                                                                          │
│  const tenant = await getTenant();                                       │
│    → headers().get("x-tenant-clinic-id")   // from middleware response   │
│    → returns TenantInfo { clinicId, clinicName, subdomain, ... }          │
│    → or null if no header present                                        │
│                                                                          │
│  <TenantProvider tenant={tenant}>                                        │
│    {children}                                                            │
│    <Chatbot />                                                           │
│  </TenantProvider>                                                       │
└──────────┬───────────────────────┬──────────────────────────────────────┘
           │                       │
     ┌─────┘                       └─────┐
     ▼                                   ▼
┌────────────────────┐     ┌─────────────────────────────┐
│  Server Components │     │  Client Components          │
│                    │     │                             │
│  getTenant()       │     │  useTenant()                │
│  reads headers()   │     │  reads React Context        │
│  directly          │     │  (set by TenantProvider)    │
└────────────────────┘     └─────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  PARALLEL PATH: Static clinicConfig                                      │
│                                                                          │
│  clinicConfig.clinicId ("demo-clinic") — hardcoded, NOT from request     │
│                                                                          │
│  Used by:                                                                │
│    data/public.ts (all public data fetching)                             │
│    api/booking/route.ts                                                  │
│    api/branding/route.ts                                                 │
│    timezone.ts                                                           │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  PARALLEL PATH: User Profile clinic_id                                   │
│                                                                          │
│  users.clinic_id — from DB, set on user creation                        │
│                                                                          │
│  Used by:                                                                │
│    with-auth.ts (API route auth wrapper)                                 │
│    notification routes (cross-clinic validation)                         │
│    middleware.ts role enforcement (profile lookup)                        │
└──────────────────────────────────────────────────────────────────────────┘
```
