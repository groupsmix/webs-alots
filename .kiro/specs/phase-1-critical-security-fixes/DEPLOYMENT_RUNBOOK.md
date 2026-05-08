# Phase 1 Security Fixes - Deployment Runbook

**Version**: 1.0  
**Last Updated**: 2026-05-05  
**Estimated Duration**: 4 hours (Staging: 1h, Production: 2h, Post-Deploy: 1h)  

---

## Pre-Deployment Checklist

### Code Review
- [ ] All code changes reviewed and approved
- [ ] Unit tests passing locally
- [ ] Integration tests passing locally
- [ ] No merge conflicts with main branch
- [ ] CHANGELOG.md updated

### Database Review
- [ ] Migration 00073 (AI token budget) reviewed
- [ ] Migration 00074 (patient files) reviewed
- [ ] Backfill script tested in development
- [ ] Rollback procedures documented

### Documentation Review
- [ ] AGENTS.md updated
- [ ] IMPLEMENTATION_SUMMARY.md reviewed
- [ ] QUICK_REFERENCE.md reviewed
- [ ] API documentation updated (if needed)

### Team Coordination
- [ ] Deployment window scheduled (low-traffic period)
- [ ] DevOps team notified
- [ ] Support team briefed on new error messages
- [ ] Stakeholders informed of breaking changes

---

## Staging Deployment

### Step 1: Pre-Deployment Verification (10 min)

```bash
# 1. Verify staging environment is healthy
curl https://staging.oltigo.health/api/health
# Expected: 200 OK

# 2. Verify database connectivity
psql $STAGING_DATABASE_URL -c "SELECT version();"

# 3. Verify R2 connectivity
aws s3 ls s3://oltigo-staging-files/ --endpoint-url=$R2_ENDPOINT

# 4. Create backup
pg_dump $STAGING_DATABASE_URL > staging_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Deploy Database Migrations (15 min)

```bash
# 1. Connect to staging database
psql $STAGING_DATABASE_URL

# 2. Run migration 00073 (AI token budget)
\i supabase/migrations/00073_ai_token_budget.sql

# 3. Verify migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clinics' 
AND column_name IN ('ai_monthly_tokens', 'ai_tokens_reset_at');
# Expected: 2 rows

# 4. Verify RPC function
SELECT proname FROM pg_proc WHERE proname = 'increment_ai_tokens';
# Expected: 1 row

# 5. Run migration 00074 (patient files)
\i supabase/migrations/00074_patient_files_ownership.sql

# 6. Verify table creation
\d patient_files
# Expected: Table structure displayed

# 7. Verify RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'patient_files';
# Expected: 2 policies (select, insert)

# 8. Exit psql
\q
```

### Step 3: Run Backfill Script (20 min)

```bash
# 1. Set environment variables
export DATABASE_URL=$STAGING_DATABASE_URL
export R2_ENDPOINT=$STAGING_R2_ENDPOINT
export R2_ACCESS_KEY_ID=$STAGING_R2_ACCESS_KEY
export R2_SECRET_ACCESS_KEY=$STAGING_R2_SECRET_KEY

# 2. Run backfill in dry-run mode first
npm run backfill:patient-files -- --dry-run

# 3. Review output
# Expected: List of files to be backfilled, no errors

# 4. Run actual backfill
npm run backfill:patient-files

# 5. Verify backfill results
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM patient_files;"
# Expected: Number of backfilled files

# 6. Check for errors
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM patient_files WHERE patient_id IS NULL;"
# Expected: 0 (or small number for legacy files)
```

### Step 4: Deploy Code Changes (10 min)

```bash
# 1. Checkout staging branch
git checkout staging
git pull origin staging

# 2. Merge main branch
git merge main

# 3. Run tests
npm run test
npm run typecheck

# 4. Build application
npm run build

# 5. Deploy to staging
npm run deploy:staging
# Or use your deployment tool (Vercel, Cloudflare, etc.)

# 6. Wait for deployment to complete
# Expected: Deployment successful message
```

### Step 5: Smoke Tests (15 min)

```bash
# 1. Test AI endpoint with budget check
curl -X POST https://staging.oltigo.health/api/chat \
  -H "Authorization: Bearer $STAGING_TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
# Expected: 200 OK or 429 if budget exceeded

# 2. Test booking token generation
curl -X POST https://staging.oltigo.health/api/booking/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"+212600000000","clinicId":"test-clinic-id"}'
# Expected: 200 OK with new 4-part token

# 3. Test booking token verification
curl -X POST https://staging.oltigo.health/api/booking \
  -H "Content-Type: application/json" \
  -d '{"token":"<4-part-token>","appointmentData":{...}}'
# Expected: 200 OK or 403 if cross-tenant

# 4. Test file upload
curl -X POST https://staging.oltigo.health/api/upload \
  -H "Authorization: Bearer $STAGING_TEST_TOKEN" \
  -F "file=@test.pdf" \
  -F "category=documents"
# Expected: 200 OK

# 5. Test file download authorization
curl -X GET "https://staging.oltigo.health/api/files/download?key=<r2-key>" \
  -H "Authorization: Bearer $STAGING_TEST_TOKEN"
# Expected: 200 OK or 403 if unauthorized

# 6. Test webhook signature verification
curl -X POST https://staging.oltigo.health/api/webhooks \
  -H "X-Hub-Signature-256: sha256=<valid-signature>" \
  -H "Content-Type: application/json" \
  -d '{"entry":[]}'
# Expected: 200 OK
```

### Step 6: Run PII Log Audit (5 min)

```bash
# 1. Download staging logs
# (Method depends on your logging infrastructure)

# 2. Run audit script
npm run audit:pii-logs -- --log-dir ./staging-logs --days 1

# 3. Review results
# Expected: 0 PII violations
```

### Step 7: Staging Sign-Off (5 min)

- [ ] All smoke tests passed
- [ ] No errors in application logs
- [ ] No PII detected in logs
- [ ] Database migrations applied successfully
- [ ] Backfill completed successfully
- [ ] Performance metrics acceptable

**If any issues found**: Stop deployment, investigate, fix, and restart from Step 1.

---

## Production Deployment

### Step 1: Pre-Deployment Verification (10 min)

```bash
# 1. Verify production environment is healthy
curl https://app.oltigo.health/api/health
# Expected: 200 OK

# 2. Verify database connectivity
psql $PRODUCTION_DATABASE_URL -c "SELECT version();"

# 3. Verify R2 connectivity
aws s3 ls s3://oltigo-production-files/ --endpoint-url=$R2_ENDPOINT

# 4. Create backup
pg_dump $PRODUCTION_DATABASE_URL > production_backup_$(date +%Y%m%d_%H%M%S).sql

# 5. Verify backup integrity
pg_restore --list production_backup_*.sql | head -20
# Expected: Backup file structure displayed
```

### Step 2: Enable Maintenance Mode (5 min)

```bash
# 1. Enable maintenance mode
# (Method depends on your infrastructure)
# Example: Set environment variable
export MAINTENANCE_MODE=true

# 2. Verify maintenance page is displayed
curl https://app.oltigo.health
# Expected: Maintenance page

# 3. Wait for active requests to complete (30 seconds)
sleep 30
```

### Step 3: Deploy Database Migrations (15 min)

```bash
# 1. Connect to production database
psql $PRODUCTION_DATABASE_URL

# 2. Run migration 00073 (AI token budget)
\i supabase/migrations/00073_ai_token_budget.sql

# 3. Verify migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clinics' 
AND column_name IN ('ai_monthly_tokens', 'ai_tokens_reset_at');
# Expected: 2 rows

# 4. Verify RPC function
SELECT proname FROM pg_proc WHERE proname = 'increment_ai_tokens';
# Expected: 1 row

# 5. Run migration 00074 (patient files)
\i supabase/migrations/00074_patient_files_ownership.sql

# 6. Verify table creation
\d patient_files
# Expected: Table structure displayed

# 7. Verify RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'patient_files';
# Expected: 2 policies

# 8. Exit psql
\q
```

### Step 4: Run Backfill Script (30 min)

```bash
# 1. Set environment variables
export DATABASE_URL=$PRODUCTION_DATABASE_URL
export R2_ENDPOINT=$PRODUCTION_R2_ENDPOINT
export R2_ACCESS_KEY_ID=$PRODUCTION_R2_ACCESS_KEY
export R2_SECRET_ACCESS_KEY=$PRODUCTION_R2_SECRET_KEY

# 2. Run backfill in dry-run mode first
npm run backfill:patient-files -- --dry-run

# 3. Review output carefully
# Expected: List of files to be backfilled

# 4. Run actual backfill with progress logging
npm run backfill:patient-files -- --verbose

# 5. Verify backfill results
psql $PRODUCTION_DATABASE_URL -c "SELECT COUNT(*) FROM patient_files;"
# Expected: Number of backfilled files

# 6. Check for errors
psql $PRODUCTION_DATABASE_URL -c "SELECT COUNT(*) FROM patient_files WHERE patient_id IS NULL;"
# Expected: Small number for legacy files

# 7. Verify sample records
psql $PRODUCTION_DATABASE_URL -c "SELECT * FROM patient_files LIMIT 10;"
# Expected: Valid records with clinic_id, patient_id, r2_key
```

### Step 5: Deploy Code Changes (15 min)

```bash
# 1. Checkout production branch
git checkout production
git pull origin production

# 2. Merge main branch
git merge main

# 3. Tag release
git tag -a v1.0.0-security-fixes -m "Phase 1 Critical Security Fixes"
git push origin v1.0.0-security-fixes

# 4. Build application
npm run build

# 5. Deploy to production
npm run deploy:production

# 6. Wait for deployment to complete
# Expected: Deployment successful message
```

### Step 6: Disable Maintenance Mode (5 min)

```bash
# 1. Disable maintenance mode
export MAINTENANCE_MODE=false

# 2. Verify application is accessible
curl https://app.oltigo.health/api/health
# Expected: 200 OK

# 3. Verify homepage loads
curl https://app.oltigo.health
# Expected: HTML content (not maintenance page)
```

### Step 7: Monitor Error Rates (60 min)

```bash
# Monitor for 1 hour after deployment

# 1. Watch error logs
tail -f /var/log/application/error.log

# 2. Monitor error rate dashboard
# (Open monitoring dashboard in browser)

# 3. Check key metrics every 5 minutes:
# - Error rate (target: <1%)
# - Response time (target: <500ms)
# - AI budget exhaustion rate (target: <5%)
# - Booking token rejection rate (target: <2%)
# - File authorization failure rate (target: <1%)

# 4. Check for PII in logs
npm run audit:pii-logs -- --log-dir ./production-logs --days 1
# Expected: 0 PII violations

# 5. Verify webhook signature verification
# (Check webhook logs for signature rejections)
# Expected: Only invalid signatures rejected
```

### Step 8: Production Sign-Off (10 min)

- [ ] Application accessible and responsive
- [ ] Error rate within acceptable limits (<1%)
- [ ] No critical errors in logs
- [ ] AI endpoints working correctly
- [ ] Booking flow working correctly
- [ ] File uploads/downloads working correctly
- [ ] Webhook handlers working correctly
- [ ] No PII detected in logs
- [ ] Performance metrics acceptable

**If any issues found**: Execute rollback procedure immediately.

---

## Post-Deployment

### Step 1: Set Up Monitoring Dashboards (20 min)

```bash
# 1. Create AI Token Usage Dashboard
# - Token usage by clinic
# - Budget exhaustion events
# - Usage trends

# 2. Create Booking Token Metrics Dashboard
# - Token generation rate
# - Rejection rate
# - Cross-tenant attempt rate

# 3. Create File Authorization Dashboard
# - Download success/failure rate
# - Authorization denials by role
# - Legacy file access rate

# 4. Create PII Compliance Dashboard
# - Redaction count by field type
# - Log audit results
# - Compliance status
```

### Step 2: Configure Alerts (20 min)

```bash
# 1. CRITICAL: PII detected in logs
# Trigger: PII pattern detected in log audit
# Action: Immediate escalation to security team
# Notification: Email + SMS + PagerDuty

# 2. HIGH: AI budget exceeded
# Trigger: >10% of clinics exceed monthly budget
# Action: Review usage patterns
# Notification: Email + Slack

# 3. MEDIUM: Booking token rejection spike
# Trigger: Rejection rate >5%
# Action: Investigate for attack or misconfiguration
# Notification: Email + Slack

# 4. MEDIUM: File authorization failure spike
# Trigger: Authorization failures increase >50%
# Action: Check for attack or RLS policy issues
# Notification: Email + Slack
```

### Step 3: Schedule Weekly PII Audits (10 min)

```bash
# 1. Create cron job for weekly PII audit
crontab -e

# Add line:
# 0 2 * * 1 cd /path/to/app && npm run audit:pii-logs -- --days 7 --output /var/log/pii-audit/$(date +\%Y\%m\%d).json

# 2. Verify cron job
crontab -l

# 3. Test cron job
npm run audit:pii-logs -- --days 7 --output /tmp/test-audit.json
```

### Step 4: Update Documentation (10 min)

- [ ] Update deployment documentation
- [ ] Update API documentation
- [ ] Update support documentation
- [ ] Update security documentation
- [ ] Notify team of changes

---

## Rollback Procedure

### When to Rollback
- Critical errors affecting >10% of users
- Data corruption detected
- Security vulnerability introduced
- Performance degradation >50%
- PII leak detected

### Code Rollback (10 min)

```bash
# 1. Revert to previous deployment
git revert <commit-hash>

# 2. Build and deploy
npm run build
npm run deploy:production

# 3. Verify rollback
curl https://app.oltigo.health/api/health
# Expected: 200 OK
```

### Database Rollback (20 min)

**⚠️ WARNING**: Database rollback will lose tracking data. Only execute if critical issues arise.

```bash
# 1. Connect to database
psql $PRODUCTION_DATABASE_URL

# 2. Rollback patient_files table
DROP TABLE IF EXISTS patient_files CASCADE;

# 3. Rollback AI token budget
ALTER TABLE clinics DROP COLUMN IF EXISTS ai_monthly_tokens;
ALTER TABLE clinics DROP COLUMN IF EXISTS ai_tokens_reset_at;
DROP FUNCTION IF EXISTS increment_ai_tokens;

# 4. Verify rollback
\d clinics
# Expected: ai_monthly_tokens and ai_tokens_reset_at columns removed

# 5. Exit psql
\q

# 6. Restore from backup if needed
pg_restore -d $PRODUCTION_DATABASE_URL production_backup_*.sql
```

### Post-Rollback Actions

- [ ] Notify team of rollback
- [ ] Document rollback reason
- [ ] Create incident report
- [ ] Schedule post-mortem
- [ ] Plan fix and re-deployment

---

## Troubleshooting

### Issue: Migration Fails

**Symptoms**: Migration script returns error

**Diagnosis**:
```bash
# Check database logs
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Check for conflicting migrations
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 10;"
```

**Resolution**:
1. Review error message
2. Check for conflicting schema changes
3. Rollback partial migration if needed
4. Fix migration script
5. Re-run migration

### Issue: Backfill Script Fails

**Symptoms**: Backfill script exits with error

**Diagnosis**:
```bash
# Check R2 connectivity
aws s3 ls s3://bucket-name/ --endpoint-url=$R2_ENDPOINT

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check for duplicate keys
psql $DATABASE_URL -c "SELECT r2_key, COUNT(*) FROM patient_files GROUP BY r2_key HAVING COUNT(*) > 1;"
```

**Resolution**:
1. Review error logs
2. Fix connectivity issues
3. Remove duplicate records if any
4. Re-run backfill with --resume flag

### Issue: High Error Rate After Deployment

**Symptoms**: Error rate >5% after deployment

**Diagnosis**:
```bash
# Check application logs
tail -100 /var/log/application/error.log

# Check database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s https://app.oltigo.health/api/health
```

**Resolution**:
1. Identify error pattern
2. Check for database performance issues
3. Verify RLS policies are correct
4. Consider rollback if errors persist

### Issue: PII Detected in Logs

**Symptoms**: PII audit script reports violations

**Diagnosis**:
```bash
# Run detailed audit
npm run audit:pii-logs -- --days 1 --verbose --output pii-violations.json

# Review violations
cat pii-violations.json | jq '.violations'
```

**Resolution**:
1. Identify source of PII leak
2. Fix logging statements
3. Deploy hotfix
4. Purge PII from log systems
5. Notify affected users if required (GDPR)

---

## Success Criteria

### Deployment Success
- [ ] All migrations applied successfully
- [ ] Backfill completed without errors
- [ ] Code deployed successfully
- [ ] All smoke tests passed
- [ ] Error rate <1%
- [ ] No critical errors in logs

### Operational Success (24 hours)
- [ ] Zero PII leaks detected
- [ ] AI budget exhaustion <5%
- [ ] Booking token rejection <2%
- [ ] File authorization failures <1%
- [ ] No rollbacks required

### Long-Term Success (1 week)
- [ ] Monitoring dashboards operational
- [ ] Alerts configured and tested
- [ ] Weekly PII audits running
- [ ] No security incidents
- [ ] Performance metrics stable

---

## Contact Information

### Escalation Path
1. **DevOps Team**: devops@oltigo.health (Deployment issues)
2. **Security Team**: security@oltigo.health (Security issues, PII leaks)
3. **Development Team**: dev@oltigo.health (Application bugs)
4. **On-Call Engineer**: +212-XXX-XXXXXX (Critical issues)

### Emergency Contacts
- **CTO**: cto@oltigo.health
- **Security Lead**: security-lead@oltigo.health
- **Infrastructure Lead**: infra-lead@oltigo.health

---

**Runbook Version**: 1.0  
**Last Updated**: 2026-05-05  
**Next Review**: After First Production Deployment  
**Status**: Ready for Use