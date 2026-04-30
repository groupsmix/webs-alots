# Supabase SQL tests

SQL fixtures that pin database-side invariants which RLS alone cannot guard
(SECURITY DEFINER RPCs, trigger logic, grants, etc.).

These tests use [pgTAP](https://pgtap.org/). They are not yet wired into CI;
they are intended to be run manually against a local Supabase instance and
will be added to the `migration-check` workflow once a runner is in place.

## Running locally

```bash
# 1. Start a local Supabase stack
supabase start

# 2. Install the pgtap extension (one-time, on the local DB)
psql "$(supabase status -o env | awk -F= '/DB_URL/ {print $2}' | tr -d '\"')" \
  -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

# 3. Run a test file
psql "$(supabase status -o env | awk -F= '/DB_URL/ {print $2}' | tr -d '\"')" \
  -f supabase/tests/booking_atomic_insert.test.sql
```

Each test file wraps its assertions in a transaction that rolls back, so
running them does not leave fixtures behind.

## Files

- `booking_atomic_insert.test.sql` — pins the cross-tenant validation in the
  `booking_atomic_insert` SECURITY DEFINER RPC. See audit finding A2-03.
