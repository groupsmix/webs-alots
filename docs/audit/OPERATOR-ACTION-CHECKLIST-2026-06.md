# Operator Action Checklist — Audit Follow-Up (2026-06)

This checklist covers the **production/runtime actions that cannot be completed purely in the repository**.
Use it alongside:

- `docs/production-deployment-checklist.md`
- `docs/deployment.md`
- `docs/backup-recovery-runbook.md`
- `docs/SOP-SECRET-ROTATION.md`
- `docs/audit/COMPREHENSIVE-TECHNICAL-AUDIT-2026.md`

---

## 1. Cloudflare / Worker Runtime

- [ ] Set `SUPABASE_POOLER_URL` in production to the Supabase transaction pooler (`:6543`)
- [ ] Set `SUPABASE_POOLER_URL` in staging as well
- [ ] Confirm `GEO_RESTRICT_ADMIN=MA` (or the intended production allowlist) is set
- [ ] Verify the Cloudflare Workers plan is intentionally chosen (`Bundled` vs `Unbound`)
- [ ] Verify production routes match `oltigo.com/*` and `*.oltigo.com/*`
- [ ] Verify the staging KV namespace is separate from production
- [ ] Verify WAF / bot-management rules are enabled in Cloudflare dashboard

## 2. Supabase

- [ ] Confirm the connection pooler is enabled and the pooler URL is the one deployed to Workers
- [ ] Confirm backup schedule, retention, and PITR settings in Supabase dashboard
- [ ] Review `pg_stat_statements` for slow queries on a weekly cadence
- [ ] Validate that any new production migrations remain backward-compatible with the currently deployed Worker

## 3. Restore / Disaster Recovery

- [ ] Run a restore drill using the latest backup
- [ ] Record evidence of the restore outcome and elapsed recovery time
- [ ] Update `LAST_RESTORE_TEST_AT` in the Worker runtime after the drill
- [ ] Verify `/api/health/internal` now shows an acceptable restore-drill age
- [ ] Confirm key custody / recovery process for `PHI_ENCRYPTION_KEY` and `BACKUP_ENCRYPTION_KEY`

## 4. Secret Rotation Hygiene

After each rotation, update both the secret itself and its timestamp metadata:

- [ ] Rotate `CRON_SECRET` when due, then update `CRON_SECRET_ROTATED_AT`
- [ ] Rotate `PROFILE_HEADER_HMAC_KEY` when due, then update `PROFILE_HEADER_HMAC_KEY_ROTATED_AT`
- [ ] Rotate `PHI_ENCRYPTION_KEY` when due, then update `PHI_ENCRYPTION_KEY_ROTATED_AT`
- [ ] Verify `/api/health/internal` no longer reports overdue secret rotation age

## 5. Monitoring / Alerting

- [ ] Create a Sentry alert for elevated connection-pool utilization (recommended threshold: 70%)
- [ ] Create a Sentry alert for missed cron executions / restore-drill age thresholds
- [ ] Create an alert for elevated AI cost / token burn based on the current budget policy
- [ ] Review CSP violation reports periodically instead of only collecting them

## 6. Security / Compliance Evidence

- [ ] Keep the latest penetration-test report accessible to the engineering/security team
- [ ] Keep DPA / vendor-risk artifacts for Supabase, Cloudflare, Stripe, Meta, Twilio, Resend, Anthropic/OpenAI
- [ ] Maintain incident-response and restore-drill evidence with dates and owners
- [ ] Keep a record of developer security training / review cadence if targeting SOC 2 / ISO 27001 evidence

## 7. Validation Commands

Examples to run after config changes:

```bash
# public health
curl -s https://oltigo.com/api/health

# internal health (use the real cron secret)
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://oltigo.com/api/health/internal
```

Check specifically for:

- `checks.connectionPooling.status == "ok"`
- PostgreSQL version present
- restore-drill age present and below threshold
- secret-rotation age present and below threshold
