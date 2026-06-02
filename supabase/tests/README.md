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
