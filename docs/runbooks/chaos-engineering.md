# Chaos Engineering Runbook

**Frequency:** Quarterly  
**Owner:** Backend Team  
**Duration:** ~2 hours  
**Purpose:** Test system resilience under failure conditions

---

## Prerequisites

- Access to staging environment
- Sentry access for monitoring
- Super-admin account

---

## Step 1: Enable Chaos Experiments

1. Navigate to `/super-admin/chaos` in staging
2. Click "Start Chaos" button
3. Verify `CHAOS_ENABLED=true` in environment variables

---

## Step 2: Run Smoke Tests

```bash
npm run test:e2e -- --grep 'smoke'
```

**Expected behavior:**
- Some tests will fail (chaos-induced)
- No unhandled exceptions or crashes
- Error boundaries catch chaos errors
- Graceful degradation is observed

---

## Step 3: Manual Testing

Test critical user flows with chaos enabled:

1. **Book an appointment** (expect occasional 503 errors)
2. **Cancel an appointment** (expect DB timeouts)
3. **Send WhatsApp notification** (expect external API failures)
4. **Generate invoice** (expect Stripe API timeouts)

**For each failure:**
- ✅ User sees a friendly error message (not a stack trace)
- ✅ System logs the error to Sentry
- ✅ User can retry the operation successfully

---

## Step 4: Review Sentry Logs

Go to Sentry and filter for:
- Tag: `chaos_experiment:*`
- Environment: `staging`

**What to look for:**
- ✅ All chaos errors are caught and logged
- ✅ No uncaught exceptions
- ❌ User-facing stack traces (if found, fix error boundaries)

---

## Step 5: Disable Chaos

1. Navigate to `/super-admin/chaos`
2. Click "Stop Chaos" button
3. Verify system recovers (run smoke tests again)

---

## Step 6: Document Findings

Create a report: `docs/chaos-reviews/YYYY-MM-DD-chaos-report.md`

### Template:

```markdown
# Chaos Engineering Report — {Date}

**Tested by:** {Your Name}  
**Duration:** {X} hours  

## Summary

- Experiments run: {X}
- Critical failures found: {X}
- Graceful degradation verified: {✅/❌}

## Findings

### Issue #1: Unhandled Stripe timeout
- **Severity:** High
- **Description:** Stripe timeout crashes booking flow
- **Fix:** Add try/catch in `createPaymentIntent()`
- **GitHub Issue:** #1234

## Recommendations

- Add retry logic for external API calls
- Improve error messages for users
- Consider circuit breaker pattern for Stripe
```

---

## Quarterly Review

In addition to chaos tests, review:

1. **Incident history:** Did any production outages match chaos scenarios?
2. **Monitoring coverage:** Are all chaos-induced errors captured?
3. **Recovery time:** How long does it take to recover from failures?

---

## Escalation

If you find:
- ❌ **Unhandled exceptions** — Fix immediately before production
- ❌ **Data corruption** — Escalate to principal engineer
- ❌ **Cascading failures** — Review circuit breaker implementation

---

## Resources

- [Chaos Engineering Principles](https://principlesofchaos.org/)
- [Netflix Chaos Monkey](https://netflix.github.io/chaosmonkey/)
- [AWS Fault Injection Simulator](https://aws.amazon.com/fis/)
