# Weekly Database Performance Review

> Frequency: weekly, every Monday at 10:00 AM
> Owner: backend team
> Duration: about 30 minutes
> Purpose: identify slow queries, missing indexes, unused indexes, and table bloat before they become user-facing incidents

---

## Prerequisites

- Access to the Supabase SQL Editor for the production project
- Basic familiarity with PostgreSQL statistics views and index behavior
- GitHub access to open or update follow-up issues
- A staging environment available for validating any index changes before production rollout

---

## Review workflow

1. Run the four queries in this runbook against production statistics views.
2. Capture the top findings in a dated review note under `docs/database-reviews/`.
3. Open follow-up issues for any changes that require code, migrations, or operational action.
4. Validate proposed indexes or drops in staging before touching production.

---

## Step 1: Identify Slow Queries

### Query

```sql
SELECT
  substring(query, 1, 100) AS query_snippet,
  calls,
  round(total_exec_time::numeric, 2) AS total_time_ms,
  round(mean_exec_time::numeric, 2) AS avg_time_ms,
  round(max_exec_time::numeric, 2) AS max_time_ms,
  round((total_exec_time / sum(total_exec_time) OVER()) * 100, 2) AS pct_total
FROM pg_stat_statements
WHERE mean_exec_time > 100
  AND query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### What to look for

- `avg_time_ms > 500`: high-priority optimization candidates
- `avg_time_ms > 100`: medium-priority performance work
- High `calls` plus moderate latency: likely caching or query-shape candidates
- Queries touching PHI-heavy paths such as appointments, billing, files, or patient search

### Actions

1. Copy the query snippet and key metrics into the weekly review note.
2. Check whether the query is missing an index or using the wrong access path.
3. Decide whether the fix belongs in SQL, application code, or caching.
4. Create or update a GitHub issue labeled `performance`.

---

## Step 2: Find Missing Indexes

### Query

```sql
SELECT
  schemaname,
  tablename,
  seq_scan AS sequential_scans,
  seq_tup_read AS rows_read_sequentially,
  idx_scan AS index_scans,
  n_live_tup AS live_rows,
  round(seq_tup_read::numeric / NULLIF(seq_scan, 0), 0) AS avg_rows_per_seq_scan
FROM pg_stat_user_tables
WHERE seq_scan > 1000
  AND idx_scan < seq_scan
  AND n_live_tup > 1000
ORDER BY seq_scan DESC
LIMIT 20;
```

### What to look for

- Large tables where sequential scans dominate index scans
- Tables that are frequently filtered by columns not covered by existing indexes
- Repeated pain around tenant-scoped columns like `clinic_id`, time ranges, or status fields

### Actions

1. Review the queries hitting the flagged table.
2. Identify the most common filter and sort columns.
3. Propose a candidate index such as:

```sql
CREATE INDEX CONCURRENTLY idx_{table}_{column}
ON {table} ({column});
```

4. Test the change in staging before production.

---

## Step 3: Find Unused Indexes

### Query

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
  AND indexname NOT LIKE '%_fkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### What to look for

- Large indexes with zero scans
- Old one-off indexes that no longer match current query patterns
- Indexes created recently enough that statistics may still be misleading

### Actions

1. Verify the index is actually unused and not just recently created.
2. Check whether it backs an operational task, reporting job, or rare admin flow.
3. Test the drop in staging first:

```sql
DROP INDEX CONCURRENTLY idx_{name};
```

4. Monitor for one week before proposing the same drop in production.

---

## Step 4: Check Table Bloat

### Query

```sql
SELECT
  schemaname,
  tablename,
  n_live_tup AS live_tuples,
  n_dead_tup AS dead_tuples,
  round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC
LIMIT 20;
```

### What to look for

- `dead_pct > 20`: likely needs manual attention
- `last_autovacuum IS NULL`: autovacuum may not be keeping up
- Rapid growth on high-write tables like appointments, logs, notifications, or usage tables

### Actions

1. Record the affected table in the review note.
2. If needed, schedule:

```sql
VACUUM ANALYZE {table};
```

3. Investigate persistent churn patterns if bloat returns every week.

---

## Step 5: Document Findings

Create a dated file in `docs/database-reviews/YYYY-MM-DD-review.md`.

### Template

```markdown
# Database Review - YYYY-MM-DD

**Reviewed by:** Your Name
**Duration:** 30 minutes

## Summary

- Slow queries found: X
- Missing indexes proposed: X
- Unused indexes flagged: X
- Tables needing VACUUM: X

## Findings

### Slow Query #1
- Query: `SELECT ...`
- Avg Time: 250ms
- Proposed Fix: add index on `slot_start`
- GitHub Issue: #1234

## Action Items

- [ ] Create index on `appointments(slot_start)` in staging
- [ ] Measure the before/after plan with `EXPLAIN ANALYZE`
- [ ] Ship the migration if the staging result is positive
```

---

## Operational Notes

- Prefer `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` for production changes whenever PostgreSQL allows it.
- Do not run heavy maintenance during peak clinic hours.
- Treat tenant-heavy tables with extra care: indexes often need `clinic_id` leading columns to preserve isolation and performance together.
- Link every recommendation to evidence from `pg_stat_*` output or an execution plan.
