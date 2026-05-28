# M-02: Client Component Audit

**Date:** 2026-05-28  
**Scope:** All 373 files with `"use client"` directive in `src/`

## Summary

| Category                                                         | Count | Action                   |
| ---------------------------------------------------------------- | ----- | ------------------------ |
| Legitimately client (hooks, events, browser APIs)                | 288   | Keep                     |
| Imported by client tree (no direct hooks but in client boundary) | 70    | Keep (no bundle savings) |
| Converted to server component                                    | 8     | ✅ Done                  |
| Error boundaries (must be client per Next.js)                    | 7     | Keep                     |

## Converted Components (this PR)

These components had `"use client"` but used zero React hooks, event handlers, or browser APIs:

| File                                                 | Reason                        |
| ---------------------------------------------------- | ----------------------------- |
| `src/components/ui/breadcrumb.tsx`                   | Pure rendering (Link + icons) |
| `src/components/marketing/comparison-table.tsx`      | Pure rendering (data display) |
| `src/components/polyclinic/department-dashboard.tsx` | Pure rendering (stats cards)  |
| `src/components/ivf/outcome-statistics.tsx`          | Pure rendering (stats cards)  |
| `src/components/dental/material-stock-alert.tsx`     | Pure rendering (stock alerts) |
| `src/components/demo-banner.tsx`                     | Pure rendering (alert banner) |
| `src/components/layouts/lab-layout-shell.tsx`        | Config wrapper (no hooks)     |
| `src/components/layouts/pharmacist-layout-shell.tsx` | Config wrapper (no hooks)     |

## Why Most Components Correctly Need `"use client"`

The audit found that the vast majority of `"use client"` directives are correct:

1. **Hooks** (useState, useEffect, useCallback, useContext, etc.): 288 files
2. **Event handlers** (onClick, onChange, onSubmit): Present in most interactive pages
3. **Browser APIs** (window, document, localStorage): Used for client-side state
4. **Client libraries** (@base-ui, recharts, framer-motion, react-hook-form): Require client context
5. **Error boundaries** (error.tsx): Next.js requires these to be client components
6. **Data fetching** (src/lib/data/client/\*): Use browser Supabase client

## Recommendations for Future Refactoring

To reduce client component count further, adopt the pattern already used in
`src/app/(admin)/admin/reports/page.tsx`:

```tsx
// page.tsx — server component (data fetching on server)
import dynamic from "next/dynamic";
const InteractivePart = dynamic(() => import("@/components/interactive-part"));

export default async function Page() {
  const data = await fetchDataOnServer();
  return <InteractivePart data={data} />;
}
```

**Priority candidates** for this refactor (pages that fetch client-side but could use server actions):

- Patient appointment pages (13 files)
- Admin dashboard pages (20 files)
- Doctor specialty pages (15 files)

This would require migrating from `useEffect` + client Supabase calls to server actions,
which is a larger effort best done incrementally per feature area.
