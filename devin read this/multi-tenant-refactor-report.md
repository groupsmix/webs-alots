# Multi-Tenant Architecture Refactor Report

## Problem

The system was designed as multi-tenant with subdomain-based tenant resolution, but business logic settings (timezone, workingHours, booking parameters, currency) were hardcoded in `src/config/clinic.config.ts` via static `clinicConfig`. This meant all tenants shared the same operational configuration regardless of their individual settings stored in the database.

Additionally, `clinicConfig.clinicId` was set to `"demo-clinic"` — a hardcoded value that should never be used for tenant identification.

## What Was Fixed

### 1. Removed Hardcoded `clinicId` from Static Config

**File:** `src/config/clinic.config.ts`
- Removed `clinicId: "demo-clinic"` from the config object
- Made `clinicId` field optional with `@deprecated` JSDoc warning
- Static config now only provides branding/UI defaults (name, colors, fonts, etc.)

### 2. Created Per-Tenant Config Resolution System

**File:** `src/lib/tenant.ts`
- Added `TenantClinicConfig` interface defining per-tenant operational settings (timezone, currency, workingHours, booking parameters)
- Added `getClinicConfig(clinicId)` function that fetches from the `clinics.config` JSONB column in the database, merging with static defaults as fallback
- Added `requireTenantWithConfig()` convenience function that resolves both tenant identity and config in one call
- Uses dynamic import for `supabase-server` to avoid circular dependencies

### 3. Refactored API Routes

All booking API routes now use `requireTenantWithConfig()` instead of importing `clinicConfig` for business logic:

| File | Changes |
|------|---------|
| `src/app/api/booking/route.ts` | Uses `tenantConfig` for timezone, workingHours, slotDuration, bufferTime, maxAdvanceDays, depositAmount, depositPercentage, maxPerSlot |
| `src/app/api/booking/cancel/route.ts` | Uses `tenantConfig` for timezone, cancellationHours |
| `src/app/api/booking/reschedule/route.ts` | Uses `tenantConfig` for timezone, workingHours, slotDuration |
| `src/app/api/booking/recurring/route.ts` | Uses `tenantConfig` for maxRecurringWeeks, slotDuration, workingHours |

### 4. Fixed Data Layer

| File | Changes |
|------|---------|
| `src/lib/data/public.ts` | Fetches tenant config for slot generation (slotDuration, bufferTime), availability (maxPerSlot), and currency in services/pharmacy/prescriptions |
| `src/lib/data/lab-public.ts` | Fetches tenant config for currency in lab test listings |
| `src/lib/data/client.ts` | Added `ClientBookingConfig` interface so client-side functions accept config as parameters instead of reading static config; falls back to static config as last resort |

### 5. Updated Timezone Utility

**File:** `src/lib/timezone.ts`
- `clinicDateTime()` now accepts an explicit `timezone` parameter
- Removed import of `clinicConfig`
- Falls back to `"Africa/Casablanca"` only if no timezone provided

## Verification

### All API Routes Use Request-Based Tenant

Every API route was verified to use one of these patterns:
- `requireTenant()` — resolves tenant from request headers (set by middleware)
- `requireTenantWithConfig()` — resolves tenant + per-tenant config from DB
- `withAuth()` + `profile.clinic_id` — resolves from authenticated user's profile
- `auth.clinicId` — resolves from API key authentication (v1 routes)

### No Hardcoded `clinic_id` Remains

- `clinicConfig.clinicId` — **zero usages** in the entire codebase
- `"demo-clinic"` — **zero occurrences** in the entire codebase

### Remaining Static Config Usage (Acceptable)

- `src/app/api/branding/route.ts` — Uses `clinicConfig.name` as UI fallback when DB fetch fails. This is acceptable per requirements (branding/UI defaults only).
- `src/lib/data/client.ts` — Client-side functions fall back to static `clinicConfig.booking.*` values when no `ClientBookingConfig` is passed. This is a backward-compatible bridge until all callers pass tenant config from the server.

### Cron Routes (System-Level, Not Tenant-Scoped)

Routes like `/api/cron/billing` and `/api/cron/reminders` iterate over all clinics by design. They read `clinic_id` from database rows, not from static config. This is correct behavior for system-level batch jobs.

## Flow Traces

### Booking Flow
```
Request → subdomain → middleware (sets x-tenant-clinic-id header)
  → POST /api/booking → requireTenantWithConfig()
    → tenant.clinicId from headers (NOT static config)
    → getClinicConfig(clinicId) fetches from clinics.config JSONB
    → validateBookingRequest() uses tenant timezone & workingHours
    → INSERT INTO appointments WHERE clinic_id = tenant.clinicId
```

### Cancellation Flow
```
Request → subdomain → middleware
  → POST /api/booking/cancel → requireTenantWithConfig()
    → tenant.clinicId from headers
    → tenantConfig.booking.cancellationHours from DB
    → clinicDateTime() called with tenantConfig.timezone
    → UPDATE appointments WHERE clinic_id = tenant.clinicId
```

### Payment Flow
```
Request → subdomain → middleware
  → POST /api/booking/payment/initiate → requireTenant()
    → tenant.clinicId from headers
    → All payment queries scoped to clinic_id = tenant.clinicId
  → POST /api/payments/webhook
    → clinic_id from Stripe session.metadata (set during checkout)
    → INSERT INTO payments WHERE clinic_id = metadata.clinic_id
```

## Files Modified

1. `src/config/clinic.config.ts` — Removed hardcoded clinicId
2. `src/lib/tenant.ts` — Added TenantClinicConfig, getClinicConfig(), requireTenantWithConfig()
3. `src/lib/timezone.ts` — Accept explicit timezone parameter
4. `src/app/api/booking/route.ts` — Use tenant-aware config
5. `src/app/api/booking/cancel/route.ts` — Use tenant-aware config
6. `src/app/api/booking/reschedule/route.ts` — Use tenant-aware config
7. `src/app/api/booking/recurring/route.ts` — Use tenant-aware config
8. `src/lib/data/public.ts` — Use tenant-aware config for slots, currency
9. `src/lib/data/lab-public.ts` — Use tenant-aware config for currency
10. `src/lib/data/client.ts` — Accept config as parameter, fallback to static

## Remaining Risks

1. **Client-side fallback**: `client.ts` functions still fall back to static `clinicConfig` when `ClientBookingConfig` is not passed. This should be addressed by updating all client-side callers to pass tenant config from server components or API responses.
2. **Config caching**: `getClinicConfig()` currently fetches from DB on every call. For high-traffic routes, consider adding a short-lived cache (e.g., 60s TTL) to reduce DB load.
3. **Missing DB config**: If a clinic has no `config` JSONB column populated, all values fall back to the static defaults in `clinic.config.ts`. This is safe but means new tenants get the same defaults until their config is set up.
