# Database Rollback Constraints

> **Audience:** Platform operators, on-call engineers, agents shipping schema changes
> **Last updated:** April 2026
> **Related:** [`backup-recovery-runbook.md`](./backup-recovery-runbook.md), [`incident-response.md`](./incident-response.md), [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), [`scripts/staging-swap.sh`](../scripts/staging-swap.sh)

---

## TL;DR

- **Worker code is rolled back automatically** by the deploy pipeline (CI-11) when the post-deploy health check fails.
- **Database migrations are NOT rolled back automatically.** Migrations in `supabase/migrations/` are append-only and forward-only.
- A Worker rollback **may leave the previous Worker code running against a newer database schema**. The application contract therefore requires every migration to be backwards-compatible with the previous Worker version (expand → migrate → contract).
- If a release introduces a migration that is incompatible with the previous Worker, an automatic Worker rollback **will not restore service**; on-call must follow the manual procedures in this doc.

---

## 1. Why Migrations Are Forward-Only

The `supabase/migrations/` directory uses sequential, immutable filenames (`00060_…`, `00061_…`, …). The platform applies migrations through Supabase's standard migration tooling, which:

1. Tracks applied migrations in `supabase_migrations.schema_migrations`.
2. Has **no `down`/`revert` step** — there is no symmetric `00060_revert.sql`.
3. Relies on application-level coordination for compatibility, not transactional schema swaps.

Auto-generated reverse migrations are **not safe** in this codebase because:

- **PHI is encrypted column-by-column.** Reversing a column rename or type change can desynchronise ciphertext from the IV/key metadata stored alongside it.
- **RLS policies depend on column names and shapes.** Reversing a schema change without simultaneously reverting the corresponding RLS policy migration leaves rows either unreachable (over-restrictive) or globally readable (under-restrictive).
- **Multi-tenant data has no global rollback target.** Different clinics may have written tenant-scoped rows under the new schema before the rollback fires; reversing the schema would lose or corrupt those writes.
- **Cron and Worker bindings are versioned with the schema.** A `wrangler rollback` reverts only the Worker; the database remains on the new schema.

For these reasons, **every migration in this repo must be designed so that the previous Worker version continues to function against it**. This is enforced by code review and by the migration check workflow (`.github/workflows/migration-check.yml`).

---

## 2. What an Auto-Rollback Does and Does NOT Do

The deploy pipeline (`.github/workflows/deploy.yml`, CI-11) takes the following actions when the post-deploy health check fails:

| Action | Reverted? | Notes |
|---|---|---|
| Worker code (JS bundle from `npm run build:cf`) | ✅ Yes | `wrangler rollback` restores the immediately previous Worker version. |
| Worker bindings declared in `wrangler.toml` (R2, KV, Queues) | ✅ Yes | Rolled back as part of the Worker version. |
| Worker secrets (`wrangler secret put`) | ❌ **No** | Secrets are stored separately and persist across rollbacks. Re-running `update-secrets.yml` is required if a release changed secret values. |
| Cron triggers in `wrangler.toml` | ✅ Yes | Bound to the Worker version. |
| Cloudflare KV / R2 contents written during the bad release | ❌ **No** | Stored externally; not versioned with the Worker. |
| Supabase schema migrations applied during the release | ❌ **No** | Forward-only — see Section 3 for manual procedures. |
| Supabase row data written during the bad release | ❌ **No** | Restore from the nightly pg_dump (see [`backup-recovery-runbook.md`](./backup-recovery-runbook.md) §4.1) if corruption is suspected. |
| WhatsApp / Twilio template approvals | ❌ **No** | External provider state. |
| R2 lifecycle rules (`scripts/apply-r2-lifecycle.mjs`) | ❌ **No** | Applied imperatively, not versioned with the Worker. |

**Implication:** the auto-rollback is sufficient when a release contains only Worker code changes. As soon as a release also contains a schema migration, secret rotation, KV write, or R2 lifecycle change, the rollback is **partial** and on-call must finish the rollback by hand using the procedures below.

---

## 3. Required Migration Patterns (Expand → Migrate → Contract)

To keep auto-rollback safe, every migration that changes a published surface (table column, RLS policy, RPC, enum) must be split across **at least two releases**:

### 3.1 Adding a column

1. **Release N (expand):** add the column as `NULL`able with a default. Do not yet read it from the application.
2. **Release N+1 (migrate):** start writing to the column from the application. Backfill old rows in a separate, idempotent migration.
3. **Release N+2 (contract):** if the column should be `NOT NULL`, add the constraint only after the backfill is verified.

A rollback at any stage leaves the previous Worker reading either no data (stage 1 → 0) or the same data it always read (stage 2 → 1).

### 3.2 Renaming a column

1. **Release N:** add the new column. Write to **both** old and new columns from the application. Read from the old column.
2. **Release N+1:** backfill the new column. Switch reads to the new column. Continue dual-writing.
3. **Release N+2:** stop writing to the old column.
4. **Release N+3:** drop the old column.

A rollback from N+1 → N is safe because both columns still exist and the old column is still authoritative for the previous Worker.

### 3.3 Changing a column type

Treat as a rename: add a new column with the new type, dual-write, backfill, switch reads, drop the old column. Never `ALTER COLUMN … TYPE` in place — that is not reversible without data loss.

### 3.4 Modifying RLS policies

1. **Release N:** add the new policy alongside the old one (`CREATE POLICY` is additive — `OR` semantics apply).
2. **Release N+1:** drop the old policy.

Rolling back from N+1 → N restores the old policy automatically because it never moved. Rolling back from N → N-1 is safe because the new policy was strictly additive.

### 3.5 Dropping a table or column

Never drop in the same release that stops writing to the table/column. Always wait at least one full release cycle, and document the contract change in `CHANGELOG.md` under **Removed**.

### 3.6 Enums

`ALTER TYPE … ADD VALUE` is forward-only and **cannot be removed** in PostgreSQL without recreating the type. Adding enum values is therefore safe; removing them is not. If a value must be deprecated, retire it at the application layer first and leave the enum value in place indefinitely.

### 3.7 Tenant-scoped tables

Every new table must include `clinic_id` and an RLS policy in the **same** migration file (audit requirement). A rollback that reverts only the Worker leaves the table in place; this is acceptable because the RLS policy keeps it inaccessible across tenants.

---

## 4. Manual Recovery Procedures

When the auto-rollback fires but a migration in the failed release is incompatible with the previous Worker, the previous Worker will start serving but errors will continue (e.g. `column does not exist`, RLS denials, RPC `function not found`). Follow this decision tree:

### 4.1 Decision tree

```
post-deploy health check failed
        │
        ▼
auto-rollback ran  ──── no  ──▶  run scripts/staging-swap.sh --rollback manually
        │ yes
        ▼
verify rollback health
        │
        ▼
healthy?  ──── yes ──▶ investigate failed commit, fix forward, redeploy
        │ no
        ▼
did the failed release include a migration?
        │
        ▼
yes ──▶ §4.2 (forward-fix migration) — DO NOT pg_restore unless data corruption is confirmed
        │
no  ──▶ §4.3 (rollback target is also broken — pre-existing bug)
```

### 4.2 Forward-fix a broken migration

1. **Stop writes** if the schema is causing data corruption (toggle the maintenance flag in `FEATURE_FLAGS_KV` or scale Worker invocations to zero — see [`docs/incident-response.md`](./incident-response.md)).
2. **Diagnose** the incompatibility:
   ```bash
   # Inspect the most recent migrations applied to production
   psql "$SUPABASE_DB_URL" -c \
     "SELECT version, name, executed_at FROM supabase_migrations.schema_migrations
      ORDER BY executed_at DESC LIMIT 5;"
   ```
3. **Write a compensating migration** under a new, higher number (`00069_fix_<thing>.sql`). For example, if the bad migration renamed a column the previous Worker still reads, the fix is to **re-add** the old column as a generated/aliased column and backfill from the new column.
4. **Deploy the fix** through the normal pipeline. The auto-rollback will not fire again because the previous (now current) Worker is healthy against the patched schema.
5. **Never edit or delete the offending migration file.** Migration history is append-only — editing it desyncs `schema_migrations` across environments.

### 4.3 Restore from backup (data corruption only)

Use this only when you have confirmed that the failed release wrote corrupt or PII-leaking data that cannot be quarantined at the application layer. **Schema problems alone do not justify a restore — fix forward instead.**

Follow the procedure in [`backup-recovery-runbook.md`](./backup-recovery-runbook.md) §4.1 (R2 nightly dump) or §4.2 (Supabase PITR). Both procedures restore the **entire database to a point in time** — all writes after the restore point will be lost across **all clinics**, so this is a last resort.

### 4.4 Secret rotation rollback

`wrangler rollback` does not revert secrets. If the failed release also rotated a secret (e.g. PHI key, WhatsApp token, Stripe webhook secret), follow the SOP that owns that secret:

- PHI key: [`docs/SOP-PHI-KEY-ROTATION.md`](./SOP-PHI-KEY-ROTATION.md)
- General secrets: [`docs/SOP-SECRET-ROTATION.md`](./SOP-SECRET-ROTATION.md)
- VAPID (web push): [`docs/SOP-VAPID-ROTATION.md`](./SOP-VAPID-ROTATION.md)

Rotating back to the previous secret is usually possible only if the old secret value was preserved (it should be — see the SOPs).

---

## 5. Pre-Release Checklist for Schema Changes

Before merging a PR that touches `supabase/migrations/`, confirm:

- [ ] The migration is **additive** or follows the expand-migrate-contract pattern (§3).
- [ ] The previous Worker version (one commit behind `main` / `staging`) **continues to function** against the new schema.
- [ ] New tables include `clinic_id` and an RLS policy in the same migration.
- [ ] No `ALTER COLUMN … TYPE` in place; no `DROP COLUMN` in the same release that stops writing to it.
- [ ] No enum values are removed (only added).
- [ ] The `CHANGELOG.md` entry calls out any contract change so on-call knows the auto-rollback may be insufficient.
- [ ] If the change is destructive (`DROP TABLE`, `DROP COLUMN`), the PR description includes a **manual rollback plan** the on-call can execute.

---

## 6. Why We Don't Auto-Revert Migrations

Several alternatives were considered and rejected:

| Approach | Why it was rejected |
|---|---|
| Symmetric `down` migrations | Cannot reliably reverse PHI re-encryption, enum additions, RLS policy interactions, or tenant-scoped writes that occurred between the migration and the rollback. |
| Snapshot-and-restore on every deploy | Supabase Pro does not offer per-deploy snapshots; PITR is minute-granular at best and restoring drops cross-tenant data. |
| Blue/green schema (parallel databases) | Would require dual-writing all PHI, doubling encryption-key surface area and breaking single-source-of-truth audit logs. |
| `wrangler rollback` extended to drive Supabase | Cloudflare Workers cannot transactionally coordinate with Postgres; partial failures would leave the system in a worse state than a Worker-only rollback. |

The chosen contract — **forward-only migrations + Worker-only auto-rollback + expand-migrate-contract discipline** — keeps the rollback fast and side-effect-free in the common case, and pushes the rare incompatible-schema case to a documented manual procedure.
