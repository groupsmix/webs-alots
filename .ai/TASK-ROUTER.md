# Oltigo Platform — AI Task Router

> **Read this file FIRST before touching any code.**
> It tells you exactly which files to edit for each task type, and which files to NEVER touch.

---

## Architecture Overview

```
Layer 1 (SEALED): Auth, RLS, multi-tenant → src/middleware.ts, src/lib/auth/, src/lib/tenant.ts
Layer 2 (SEALED): Booking, payments, notifications → src/app/api/booking/, src/app/api/payments/, src/lib/whatsapp.ts
Layer 3 (EDIT):   Config, features, niches → src/lib/config/, src/lib/features.ts, src/lib/hooks/use-clinic-features.tsx
Layer 4 (EDIT):   Templates, UI, pages → src/lib/templates.ts, src/components/, src/app/
Layer 5 (CREATE): New features → create new files, never modify layers 1-2
```

---

## Quick-Reference Table

| Task Type | Files to Edit | Files to NEVER Touch |
|---|---|---|
| Add new niche | `src/lib/config/clinic-types.ts`, `src/lib/features.ts`, `src/config/specialist-registry.ts`, `src/lib/config/default-services.ts`, `src/lib/hooks/use-clinic-features.tsx` | Everything else |
| Add new vertical | `src/lib/config/verticals.ts`, create new file in `src/lib/config/verticals/` | Core config files |
| Add new template | `src/lib/templates.ts`, create new CSS file in `src/styles/templates/` | Core layout files |
| Add new template preset | `src/lib/template-presets.ts` | Templates themselves |
| Add new feature flag | `src/lib/features.ts`, `src/lib/hooks/use-clinic-features.tsx` | Auth, RLS, middleware |
| Add new API route | Create under `src/app/api/[feature]/route.ts` | Existing API routes |
| Add new AI feature | Create under `src/app/api/ai/[feature]/route.ts`, add feature flag | Core AI chatbot |
| Add new dashboard page | Create under `src/app/(admin)/admin/[page]/page.tsx`, add nav entry in `src/components/layouts/admin-layout-shell.tsx` | Existing pages |
| Add new public page | Create under `src/app/(clinic-public)/[page]/page.tsx` | Existing pages |
| Add new payment gateway | Create under `src/app/api/payments/[gateway]/route.ts` | Existing payment routes |
| Add new language | `src/lib/i18n.ts` | Everything else |
| Add new component | Create under `src/components/[category]/` | Existing components |
| Fix a bug | Depends on bug location — read error trace | Unrelated files |

---

## DO NOT Rules

- Do **NOT** modify `src/middleware.ts` unless explicitly asked
- Do **NOT** modify `src/lib/auth/` or `src/lib/auth.ts` unless explicitly asked
- Do **NOT** modify RLS policies in `supabase/migrations/` unless explicitly asked
- Do **NOT** modify existing API route handlers (create new ones instead)
- Do **NOT** delete any existing feature flags
- Do **NOT** change database column names
- Do **NOT** run `git add .` — only add specific files
- Do **NOT** modify `src/lib/tenant.ts` or `src/lib/tenant-context.ts`
- Do **NOT** modify `src/lib/encryption.ts` or PHI-related files
- Do **NOT** modify `src/lib/seed-guard.ts`

---

## Testing Commands

```bash
npm run lint          # ESLint — must pass
npx tsc --noEmit     # TypeScript — must pass
npm run test          # Vitest unit tests (519+ tests) — must pass
npm run build         # Next.js build — must pass (needs env vars)
```

---

## Common Patterns

### How to Add a Feature Flag

```typescript
// 1. In src/lib/features.ts — add the key to ClinicFeatureKey union type:
export type ClinicFeatureKey =
  | "appointments"
  | "prescriptions"
  // ... existing keys ...
  | "your_new_feature";   // <-- add here

// 2. Optionally add default in DEFAULT_FEATURES:
export const DEFAULT_FEATURES: FeaturesConfig = {
  appointments: true,
  // ...
  your_new_feature: false,  // <-- disabled by default
};

// 3. In src/lib/hooks/use-clinic-features.tsx — add to SPECIALTY_FEATURES
//    if the flag is specialty-specific:
export const SPECIALTY_FEATURES: Record<string, ClinicFeatureKey[]> = {
  gp: ["appointments", ..., "your_new_feature"],
};
```

### How to Add a Nav Item (Admin Sidebar)

```typescript
// In src/components/layouts/admin-layout-shell.tsx:
const navItems: NavItem[] = [
  // ... existing items ...
  {
    href: "/admin/your-page",
    label: "Your Page",
    icon: SomeIcon,
    requiredFeature: "your_new_feature",  // optional: gate behind feature flag
  },
];
```

### How to Create a New API Route

```typescript
// Create: src/app/api/your-feature/route.ts
import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiUnauthorized } from "@/lib/api-response";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(
  async (req: NextRequest, { user, clinicId }) => {
    // Your logic here — always scope by clinicId
    return apiSuccess({ result: "ok" });
  },
  ["clinic_admin", "receptionist"],  // allowed roles
);
```

### How to Create a New Dashboard Page

```typescript
// Create: src/app/(admin)/admin/your-page/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function YourPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your Page Title</h1>
      <Card>
        <CardHeader>
          <CardTitle>Section Title</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Your content */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### How to Create a New Public Page

```typescript
// Create: src/app/(clinic-public)/your-page/page.tsx
// It automatically gets the branded header/footer from the (clinic-public) layout

export default function YourPublicPage() {
  return (
    <section className="container mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-6">Page Title</h1>
      {/* Content */}
    </section>
  );
}
```

---

## Key Files Reference

| Purpose | File |
|---|---|
| Clinic type definitions | `src/lib/config/clinic-types.ts` |
| Default services per type | `src/lib/config/default-services.ts` |
| Feature flags (server) | `src/lib/features.ts` |
| Feature flags (client hook) | `src/lib/hooks/use-clinic-features.tsx` |
| Template definitions | `src/lib/templates.ts` |
| Vertical definitions | `src/lib/config/verticals.ts` |
| Vertical registry | `src/lib/config/vertical-registry.ts` |
| Specialist dashboards | `src/config/specialist-registry.ts` |
| Public layout (header/footer) | `src/components/layouts/clinic-public-layout.tsx` |
| Public header | `src/components/public/header.tsx` |
| Public footer | `src/components/public/footer.tsx` |
| Public hero | `src/components/public/hero-section.tsx` |
| Admin sidebar nav | `src/components/layouts/admin-layout-shell.tsx` |
| Onboarding wizard | `src/app/(auth)/onboarding/page.tsx` |
| Branding data fetch | `src/lib/data/public.ts` |
| i18n translations | `src/lib/i18n.ts` |
| API response helpers | `src/lib/api-response.ts` |
| Auth wrapper | `src/lib/with-auth.ts` |
| Tenant context | `src/lib/tenant.ts` |
| Database types | `src/lib/types/database.ts` |
| Middleware | `src/middleware.ts` |

---

## Project Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Supabase (Auth, Database, Storage, Edge Functions) |
| Notifications | WhatsApp Business API (Meta Cloud API) |
| Hosting | Cloudflare Workers (via OpenNext) |
| Payments | CMI Payment Gateway (optional), Stripe |

## User Roles (order of privilege)

`super_admin` > `clinic_admin` > `receptionist` > `doctor` > `patient`

## Tenant Isolation

Every database query **must** be scoped by `clinic_id`. Use `requireTenant()` or `requireTenantWithConfig()` — never hardcode clinic IDs.
