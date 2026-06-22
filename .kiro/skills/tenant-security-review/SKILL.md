---
name: tenant-security-review
description: >
  Use when writing or reviewing Supabase queries, API routes under src/app/api/,
  database migrations, file-upload/PHI storage code, or webhook handlers
  (WhatsApp, Stripe, CMI) in the Oltigo Health codebase. Verifies clinic_id
  tenant scoping, mass-assignment safety, PHI encryption, audit logging, and
  webhook signature checks before the change is considered done. Also use when
  asked to "review for tenant isolation," "check PHI security," or "is this
  safe to ship."
license: MIT
metadata:
  category: security
  complexity: intermediate
  project: oltigo-health
---

# Tenant & PHI Security Review

This is multi-tenant healthcare SaaS. A missed `clinic_id` filter leaks one
clinic's patients into another clinic's view. Treat every gate below as a hard
requirement, not a suggestion — if a gate fails, the task is not done yet.

## When this applies

- New or modified Supabase query (`.from(...).select/insert/update/delete/upsert`)
- New or modified route under `src/app/api/`
- New file under `supabase/migrations/`
- Any code that stores, reads, or transmits a patient file or PHI field
- Any webhook handler (WhatsApp, Stripe, CMI)

## Step 1 — run the scanner

```
scripts/scan.sh <changed files>      # or with no args: scans `git diff` in the repo
```

This is a fast heuristic first pass (grep-based). It will produce **false
positives and false negatives** — it exists to surface the mechanical mistakes
quickly so your manual review below can focus on judgment calls.

## Step 2 — verify each hard gate manually

1. **Tenant scoping.** `clinicId` must come from `requireTenant()` /
   `requireTenantWithConfig()` — never from a request header or body.
   - Bad: `supabase.from("appointments").select("*")`
   - Good: `supabase.from("appointments").select("*").eq("clinic_id", clinicId)`

2. **Mass assignment.** Never spread an untyped body into a mutation.
   - Bad: `.insert({ ...body })`
   - Good: `.insert({ name: body.name, phone: body.phone, clinic_id: clinicId })`

3. **PHI encryption.** Any new patient-file write goes through
   `@/lib/encryption` (AES-256-GCM, unique IV per file) before it reaches R2.
   Never write patient files unencrypted, "temporarily," or "for now."

4. **Audit logging.** Every state-changing operation on a patient, appointment,
   payment, or file calls `logAuditEvent()` from `@/lib/audit-log`. If you
   added a new mutation and didn't add this call, the gate fails.

5. **Webhook trust.** WhatsApp payloads are verified via HMAC-SHA256
   (`X-Hub-Signature-256`); Stripe via `stripe-signature`. `clinic_id` is
   resolved *from the verified payload itself* (WABA phone-number ID / Stripe
   metadata) — if resolution fails, drop the event. Never query across
   tenants to "find" which clinic a webhook might belong to.

6. **Migrations.** Sequential 5-digit filename (`000NN_description.sql`),
   `IF NOT EXISTS` / `IF EXISTS` guards, and an RLS policy scoped to
   `clinic_id` for any new table. No `DROP COLUMN`/`DROP TABLE` without an
   explicit migration plan called out separately.

7. **Logging hygiene.** No `console.log` of PHI, tokens, or secrets — use
   `@/lib/logger`, which is structured and redaction-aware.

## Step 3 — pair with a real test

A passing test doesn't mean tenant-safe code. Per `AGENTS.md`'s test
conventions: don't just unit-test the Zod schema — write a route-handler test
that exercises the full auth → validation → mutation → response chain, and
assert that a request scoped to clinic A cannot read/write clinic B's row.

## If anything is ambiguous

Stop and ask rather than guessing — wrong guesses here are expensive to unwind.
See `references/checklist.md` for edge cases (super-admin cross-tenant reads,
cron jobs iterating per-clinic, soft deletes) and more worked examples.
