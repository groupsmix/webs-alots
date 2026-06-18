# Runbook — Super-Admin AI Builder + admin write-layer

**Scope:** Two operational questions that recur for the super-admin surface:

1. How to bring the **AI Builder / CopilotKit** endpoints online (they ship as
   intentional `501` stubs in the main app).
2. How to confirm the **admin write-layer persists** (Add Doctor/Service,
   bulk clinic actions) when a live test suggests it does not.

This is an ops/diagnostic runbook. The application code for both is already in
place; what is described here is configuration and verification.

---

## 1. Architecture reality (read this first)

- The super-admin in-layout assistant is **`AgentWidget`**
  (`src/components/ai/AgentWidgetMount.tsx`), **not** CopilotKit. The earlier
  in-app CopilotKit provider/sidebar (`CopilotShell`) was retired after PR #976
  because wrapping the layout in the provider made the whole super-admin tree
  depend on a live AI backend — a `501` from `/api/copilotkit` tripped the error
  boundary on every page. `AgentWidget` fails closed instead.
- The **CopilotKit runtime** and the **AI Builder sandbox** live in a separate
  Cloudflare Worker, **`webs-alots-ai`** (`workers/ai/`). They were split out to
  keep the main Worker bundle under Cloudflare's 10 MiB compressed limit.
- In the main app, `src/app/api/copilotkit/route.ts` and
  `src/app/api/builder/sandbox/route.ts` are **deliberate `501` stubs**.
  Cloudflare zone routes are supposed to send those paths to `webs-alots-ai`
  *before* the main Worker sees them. **If you get a `501` from `oltigo.com`,
  the zone routes are missing or misconfigured** (see step 2.2).
- The AI Builder page is gated to `super_admin` and lives at
  **`/super-admin/builder`** (`src/app/(super-admin)/super-admin/builder/`).

## 2. Bring the AI Builder / CopilotKit endpoints online

### 2.1 Provision secrets on the AI Worker

```bash
cd workers/ai
# Required:
wrangler secret put ANTHROPIC_API_KEY --env production
wrangler secret put E2B_API_KEY        --env production   # AI Builder sandbox
# Repeat for --env staging.
# Supabase service credentials the worker needs (see workers/ai/src/lib/supabase.ts
# and wrangler.toml [vars]/secrets for the exact names in use):
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
```

`E2B_API_KEY`: free tier at https://e2b.dev is 100 sandbox-hours/month.

### 2.2 Recreate the Cloudflare zone routes

The AI Worker must own these paths on the zone (see `workers/ai/wrangler.toml`):

```
oltigo.com/api/copilotkit         -> webs-alots-ai
oltigo.com/api/copilotkit/*       -> webs-alots-ai
oltigo.com/api/builder/sandbox    -> webs-alots-ai
oltigo.com/api/builder/sandbox/*  -> webs-alots-ai
```

Deploy the worker: `cd workers/ai && wrangler deploy --env production`.

### 2.3 Verify

```bash
# Should be answered by webs-alots-ai, NOT the 501 stub.
# The stub sets header "X-Route-Owner: webs-alots-ai" and status 501 — if you
# see status 501 from oltigo.com the route is still hitting the main app.
curl -i -X POST https://oltigo.com/api/copilotkit -H 'Content-Type: application/json' -d '{}'
```

Then log in as `super_admin`, open `/super-admin/builder`, and confirm the chat
streams. The relaxed CSP for sandbox previews is applied by `src/middleware.ts`
for paths under `/super-admin/builder` (`isBuilderRoute`).

> Reviving the in-app CopilotKit **sidebar** (vs. the current AgentWidget) would
> mean re-creating the removed `CopilotShell` component. Prefer extending
> `AgentWidget` instead.

---

## 3. Admin write-layer — how persistence works

The admin dashboards do **not** write to local state only. Each "Add" / "Edit" /
bulk action calls a server action or API route that performs a real,
tenant-scoped Supabase mutation and returns the persisted row:

| UI surface                         | Code path                                                        | DB effect |
| ---------------------------------- | ---------------------------------------------------------------- | --------- |
| `/admin/doctors`, `/admin/receptionists` | `createClinicUser` / `updateClinicUser` (`src/lib/admin-actions.ts`) | `users` insert/update |
| `/admin/services`                  | `createClinicService` (`src/lib/admin-actions.ts`)               | `services` insert |
| `/admin/beds`                      | `createClinicRoom` (`src/lib/admin-actions.ts`)                  | `rooms` + `beds` insert |
| `/admin/machines`                  | `createClinicDialysisMachine`                                    | `dialysis_machines` insert |
| `/admin/departments`               | `createClinicDepartment`                                         | `departments` insert |
| `/admin/lab-materials`             | `createClinicLabMaterial`                                        | `lab_materials` insert |
| `/admin/lab-invoices`              | `createClinicLabInvoice`                                         | `lab_invoices` insert |
| `/super-admin/clinics` bulk        | `POST /api/super-admin/clinics/bulk`                             | `clinics` update / `clinic_feature_overrides` upsert |

All write helpers **throw** (server action) or return a non-2xx (API route) on a
DB error, and the clients surface a **failure** toast — they cannot show a false
"success". Regression tests pin this down:

- `src/lib/__tests__/admin-actions-persistence.test.ts`
- `src/app/api/__tests__/super-admin-clinics-bulk.test.ts`

The "empty" inventory pages (`beds`, `machines`, `departments`, `lab-*`) read
real tables; they are empty only for a tenant with no rows yet.

## 4. If writes genuinely don't persist in prod — diagnose infra, not UI

The code persists, so a real "saved then gone" symptom points at infrastructure.
Run these **read-only** checks against the production DB (psql / Supabase SQL
editor), in order:

```sql
-- 4.1 Migrations actually applied (expect the latest 0018x entries present).
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 8;

-- 4.2 RLS is enabled AND write policies exist for the tables admins write to.
select c.relname as table,
       c.relrowsecurity as rls_enabled,
       count(p.polname) filter (where p.polcmd in ('a','w','*')) as write_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in ('users','services','rooms','beds','dialysis_machines',
                    'departments','lab_materials','lab_invoices','clinics',
                    'clinic_feature_overrides')
group by c.relname, c.relrowsecurity
order by c.relname;

-- 4.3 Did rows actually land? (replace the clinic_id) — proves write vs. read-back.
select id, role, name, clinic_id, created_at
from public.users
where clinic_id = '<CLINIC_UUID>'
  and name like 'ZZZ_TEST%'
order by created_at desc;
```

Then check the Worker env:

- `SUPABASE_SERVICE_ROLE_KEY` is set in the main Worker (the bulk/admin paths use
  `createAdminClient` to bypass RLS for cross-tenant super-admin ops).
- The request is reaching the right tenant subdomain (middleware derives tenant
  from the subdomain and strips client `x-clinic-id` headers).

If 4.1 shows missing migrations or 4.2 shows `rls_enabled = true` with
`write_policies = 0` for a table, that is the cause — fix the migration/policy,
not the UI.
