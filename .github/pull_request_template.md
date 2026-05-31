## Summary

<!-- Brief description of the changes. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Documentation
- [ ] Infrastructure / CI

## Security Impact

- [ ] This PR modifies authentication or authorization logic
- [ ] This PR changes RLS policies or database migrations
- [ ] This PR modifies encryption, audit logging, or PII handling
- [ ] This PR changes tenant isolation or multi-tenant scoping
- [ ] No security impact

## Migration Safety

- [ ] This PR includes database migrations
- [ ] Migrations are backward-compatible (no destructive changes)
- [ ] Migrations include `IF NOT EXISTS` / `IF EXISTS` guards
- [ ] New tables have RLS policies with `clinic_id` scoping
- [ ] N/A — no migrations

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] E2E tests pass locally

## Observability

- [ ] This PR adds/modifies logging (structured via `@/lib/logger`)
- [ ] This PR changes Sentry configuration or error handling
- [ ] N/A — no observability changes

## Rollback

<!-- How to revert this change if it causes issues in production.
     Example: "Revert this commit" or "Run migration 00XXX_undo.sql" -->

## SLO / Metrics Impact

- [ ] This PR introduces or modifies an SLO-tracked endpoint
- [ ] New metrics or alerts are needed
- [ ] N/A — no SLO/metrics impact

## Drive-by Refactors

<!-- List any unrelated cleanup included in this PR (keep minimal). -->

- None

## Checklist

- [ ] Code follows the project's style guide
- [ ] Self-review completed
- [ ] No secrets or PHI in the diff
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] Coverage thresholds still met (`npm run test:coverage`)
- [ ] New API endpoints have rate limiting (fail-closed for PHI endpoints)
