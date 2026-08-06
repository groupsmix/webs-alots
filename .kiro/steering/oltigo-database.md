---
inclusion: fileMatch
fileMatchPattern: ["supabase/migrations/**/*.sql"]
---

# Oltigo — Migrations (Kiro)

Builds on `AGENTS.md` §Database Migrations. **RLS policies are SEALED** (`.ai/TASK-ROUTER.md`) — don't modify existing ones without an explicit instruction; ask first.

## Every new migration

- `supabase/migrations/`, sequential 5-digit prefix (next is after the highest existing, e.g. `000NN_description.sql`).
- Guard every statement: `create table if not exists`, `add column if not exists`, `drop ... if exists`. Safe to re-run.
- Every tenant table has a `clinic_id` column, an index on it, and an RLS policy scoped to it. **`CREATE POLICY` has no `IF NOT EXISTS`**, so drop-then-create:

```sql
alter table <t> enable row level security;
drop policy if exists <t>_tenant_isolation on <t>;
create policy <t>_tenant_isolation on <t> using (clinic_id = /* the project's tenant helper */);
```

(Mirror an existing migration's RLS pattern — don't guess the helper.)

## PHI lifecycle (not in AGENTS.md yet)

- **Soft-delete only:** add/keep `deleted_at timestamptz`; never hard-delete PHI. Normal reads filter `deleted_at is null`.
- **Retention:** Law 09-08 governs how long PHI is kept. Confirm the window per record type with the team before adding any purge logic — don't assume.
- No destructive change (drop/rename column or table) without an explicit migration plan and approval. No credentials in committed SQL.
