# Supabase SQL tests

SQL fixtures that pin database-side invariants which RLS alone cannot guard
(SECURITY DEFINER RPCs, trigger logic, grants, etc.).

These tests use [pgTAP](https://pgtap.org/). They are run automatically in CI
during the `rls` job to ensure the database layer behaves correctly before
any TypeScript code even hits it.

## Running locally

```bash
# 1. Start a local Supabase stack
supabase start

# 2. Run all database tests
npm run test:db
```

Each test file wraps its assertions in a transaction that rolls back, so
running them does not leave fixtures behind.

## Files

- `booking_atomic_insert.test.sql` — pins the cross-tenant validation in the
  `booking_atomic_insert` SECURITY DEFINER RPC. See audit finding A2-03.
- `no_force_rls.test.sql` — pins that no `public` table has `FORCE ROW LEVEL
  SECURITY` enabled, that RLS stays enabled on the core PHI tables, and that the
  tenant helpers stay SECURITY DEFINER. FORCE would break the booking RPC and
  the RLS-helper layer while closing no real bypass. See `docs/adr/0011-no-force-rls.md`.
