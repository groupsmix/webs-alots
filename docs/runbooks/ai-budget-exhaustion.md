# Runbook: AI Token Budget Exhaustion

## Overview

This runbook provides procedures for responding to AI token budget exhaustion events in the Oltigo Health platform.

**Related Vulnerability:** A1-01 (Unbounded AI Input)  
**Fix Deployed:** Phase 1 Critical Security Fixes  
**Alert:** `ai_budget_exceeded_widespread`

---

## Background

### What is AI Token Budget?

The AI token budget system enforces per-tenant monthly limits on AI API usage to prevent:
- Unlimited OpenAI API costs
- Resource exhaustion
- Abuse of AI features

### Token Limits by Role

| Role | Monthly Limit | Typical Usage |
|------|---------------|---------------|
| Patient | 10,000 tokens | ~25 chat sessions |
| Receptionist | 20,000 tokens | ~50 auto-suggestions |
| Doctor | 50,000 tokens | ~125 prescriptions |
| Clinic Admin | 100,000 tokens | ~250 manager queries |
| Super Admin | 1,000,000 tokens | Platform management |

### Token Estimation

Rough heuristic: **1 token ≈ 4 characters**

Examples:
- Chat message (500 chars) ≈ 125 tokens
- Prescription request (1000 chars) ≈ 250 tokens
- Patient summary (2000 chars) ≈ 500 tokens

---

## Alert Triggers

### Alert 1: Widespread Budget Exhaustion

**Condition:** > 10% of active clinics exceeded budget  
**Severity:** HIGH  
**Notification:** Slack (#ops-alerts), Email (ops@oltigo.com)

### Alert 2: Individual Clinic Exhaustion

**Condition:** Single clinic hits 90% of budget  
**Severity:** MEDIUM  
**Notification:** Slack (#ops-alerts)

---

## Diagnosis Procedures

### Step 1: Identify Affected Clinics

```sql
-- List clinics that exceeded budget
SELECT 
  c.id as clinic_id,
  c.name as clinic_name,
  c.ai_monthly_tokens as tokens_used,
  c.ai_tokens_reset_at as reset_date,
  COUNT(DISTINCT u.id) as user_count,
  MAX(u.role) as highest_role
FROM clinics c
JOIN users u ON u.clinic_id = c.id
WHERE c.ai_monthly_tokens >= (
  CASE 
    WHEN u.role = 'patient' THEN 10000
    WHEN u.role = 'doctor' THEN 50000
    WHEN u.role = 'receptionist' THEN 20000
    WHEN u.role = 'clinic_admin' THEN 100000
    ELSE 1000000
  END
)
GROUP BY c.id, c.name, c.ai_monthly_tokens, c.ai_tokens_reset_at
ORDER BY c.ai_monthly_tokens DESC;
```

### Step 2: Analyze Usage Patterns

```sql
-- Get AI request history for a clinic
SELECT 
  DATE_TRUNC('day', timestamp) as day,
  endpoint,
  COUNT(*) as request_count,
  AVG(tokens_used) as avg_tokens,
  SUM(tokens_used) as total_tokens
FROM ai_request_log
WHERE clinic_id = '<clinic-id>'
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY day, endpoint
ORDER BY day DESC, total_tokens DESC;
```

### Step 3: Check for Abuse Patterns

```sql
-- Identify users with excessive AI usage
SELECT 
  u.id as user_id,
  u.email,
  u.role,
  COUNT(*) as request_count,
  SUM(arl.tokens_used) as total_tokens
FROM users u
JOIN ai_request_log arl ON arl.user_id = u.id
WHERE u.clinic_id = '<clinic-id>'
  AND arl.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email, u.role
ORDER BY total_tokens DESC
LIMIT 10;
```

### Step 4: Review Error Logs

```bash
# Check for budget exhaustion errors
cloudflare-logs fetch --filter "AI_BUDGET_EXCEEDED" --limit 100 | \
  jq -r '[.timestamp, .clinicId, .role, .estimatedTokens] | @tsv' | \
  sort | uniq -c
```

---

## Resolution Procedures

### Scenario 1: Legitimate High Usage

**Symptoms:**
- Clinic has high patient volume
- Multiple doctors using AI features
- Usage pattern is consistent and reasonable

**Resolution:**

1. **Temporarily increase budget:**
   ```sql
   -- Reset token counter for specific clinic
   UPDATE clinics
   SET ai_monthly_tokens = 0,
       ai_tokens_reset_at = NOW()
   WHERE id = '<clinic-id>';
   ```

2. **Communicate with clinic:**
   ```
   Subject: AI Token Budget Increased

   Dear [Clinic Name],

   We've noticed your clinic is actively using our AI features. 
   We've temporarily increased your monthly token budget to support 
   your usage.

   Current usage: [X] tokens
   New limit: [Y] tokens

   If you continue to need higher limits, please contact us to 
   discuss a custom plan.

   Best regards,
   Oltigo Health Team
   ```

3. **Consider permanent limit increase:**
   - Review clinic's subscription tier
   - Offer upgrade to higher tier with more tokens
   - Document decision in CRM

---

### Scenario 2: Abuse or Misconfiguration

**Symptoms:**
- Single user making excessive requests
- Unusual request patterns (e.g., 1000 requests in 1 hour)
- Requests with maximum content length

**Resolution:**

1. **Investigate user activity:**
   ```sql
   -- Get detailed request log for suspicious user
   SELECT 
     timestamp,
     endpoint,
     tokens_used,
     request_body_length,
     response_status
   FROM ai_request_log
   WHERE user_id = '<user-id>'
     AND timestamp >= NOW() - INTERVAL '7 days'
   ORDER BY timestamp DESC
   LIMIT 100;
   ```

2. **Temporarily suspend user if abuse confirmed:**
   ```sql
   -- Disable user account
   UPDATE users
   SET is_active = false,
       suspended_reason = 'AI abuse - excessive token usage',
       suspended_at = NOW()
   WHERE id = '<user-id>';
   ```

3. **Contact clinic admin:**
   ```
   Subject: Unusual AI Usage Detected

   Dear [Clinic Admin],

   We've detected unusual AI usage patterns from user [email].
   
   Details:
   - Requests: [X] in [Y] hours
   - Tokens used: [Z]
   
   We've temporarily suspended this account to prevent further 
   charges. Please contact us to discuss.

   Best regards,
   Oltigo Health Team
   ```

4. **Review and adjust limits if needed:**
   - Consider lowering per-request token limits
   - Implement rate limiting per user
   - Add CAPTCHA for high-frequency users

---

### Scenario 3: System-Wide Exhaustion (> 10% clinics)

**Symptoms:**
- Multiple clinics hitting limits simultaneously
- Limits may be too restrictive
- Legitimate usage being blocked

**Resolution:**

1. **Analyze overall usage trends:**
   ```sql
   -- Get distribution of token usage across all clinics
   SELECT 
     CASE 
       WHEN ai_monthly_tokens < 5000 THEN '0-5k'
       WHEN ai_monthly_tokens < 10000 THEN '5k-10k'
       WHEN ai_monthly_tokens < 25000 THEN '10k-25k'
       WHEN ai_monthly_tokens < 50000 THEN '25k-50k'
       WHEN ai_monthly_tokens < 100000 THEN '50k-100k'
       ELSE '100k+'
     END as usage_bucket,
     COUNT(*) as clinic_count
   FROM clinics
   WHERE ai_tokens_reset_at >= date_trunc('month', NOW())
   GROUP BY usage_bucket
   ORDER BY usage_bucket;
   ```

2. **Consider adjusting role-based limits:**
   ```typescript
   // src/lib/ai-budget.ts
   
   export const AI_TOKEN_LIMITS = {
     patient: 15_000,        // Increased from 10k
     doctor: 75_000,         // Increased from 50k
     receptionist: 30_000,   // Increased from 20k
     clinic_admin: 150_000,  // Increased from 100k
     super_admin: 1_000_000,
   } as const;
   ```

3. **Deploy limit increase:**
   ```bash
   # Update code
   git commit -m "Increase AI token limits based on usage analysis"
   git push

   # Deploy to production
   npm run deploy:production
   ```

4. **Communicate with all users:**
   ```
   Subject: AI Token Limits Increased

   Dear Oltigo Health Users,

   Based on usage patterns, we've increased AI token limits:
   
   - Patients: 10k → 15k tokens/month
   - Doctors: 50k → 75k tokens/month
   - Receptionists: 20k → 30k tokens/month
   - Admins: 100k → 150k tokens/month

   This allows for more AI-powered features without interruption.

   Best regards,
   Oltigo Health Team
   ```

---

## Preventive Measures

### 1. Proactive Monitoring

Set up alerts for clinics approaching 80% of budget:

```sql
-- Query for clinics at 80% budget
SELECT 
  c.id,
  c.name,
  c.ai_monthly_tokens,
  (c.ai_monthly_tokens * 100.0 / 
    CASE 
      WHEN u.role = 'patient' THEN 10000
      WHEN u.role = 'doctor' THEN 50000
      WHEN u.role = 'receptionist' THEN 20000
      WHEN u.role = 'clinic_admin' THEN 100000
      ELSE 1000000
    END
  ) as usage_percentage
FROM clinics c
JOIN users u ON u.clinic_id = c.id
WHERE (c.ai_monthly_tokens * 100.0 / 
  CASE 
    WHEN u.role = 'patient' THEN 10000
    WHEN u.role = 'doctor' THEN 50000
    WHEN u.role = 'receptionist' THEN 20000
    WHEN u.role = 'clinic_admin' THEN 100000
    ELSE 1000000
  END
) >= 80
ORDER BY usage_percentage DESC;
```

### 2. User Education

Add in-app notifications when users reach 80% of budget:

```typescript
// src/app/api/chat/route.ts

if (remaining < limit * 0.2) {
  // User has < 20% budget remaining
  return apiSuccess({
    response,
    warning: `You've used ${Math.round((1 - remaining/limit) * 100)}% of your monthly AI budget. ${remaining} tokens remaining.`
  });
}
```

### 3. Usage Analytics Dashboard

Create dashboard for clinic admins to view their AI usage:

- Current month usage
- Historical trends
- Top users by token consumption
- Projected end-of-month usage

### 4. Automatic Budget Reset

Ensure monthly reset is working correctly:

```sql
-- Verify reset logic
SELECT 
  id,
  name,
  ai_monthly_tokens,
  ai_tokens_reset_at,
  CASE 
    WHEN ai_tokens_reset_at < date_trunc('month', NOW()) THEN 'NEEDS RESET'
    ELSE 'OK'
  END as reset_status
FROM clinics
WHERE ai_tokens_reset_at < date_trunc('month', NOW());
```

If clinics need reset:

```sql
-- Reset all clinics that crossed month boundary
UPDATE clinics
SET ai_monthly_tokens = 0,
    ai_tokens_reset_at = date_trunc('month', NOW())
WHERE ai_tokens_reset_at < date_trunc('month', NOW());
```

---

## Escalation Path

### Level 1: On-Call Engineer (Immediate)
- Review alert
- Run diagnosis queries
- Apply temporary fixes (reset budget)
- Document actions

### Level 2: Engineering Manager (< 30 min)
- Review for system-wide issues
- Approve limit increases
- Coordinate with product team

### Level 3: CTO (Critical Issues)
- Approve significant limit changes
- Review cost implications
- Make policy decisions

### Level 4: Finance Team (Cost Concerns)
- Review OpenAI API costs
- Approve budget increases
- Adjust pricing tiers

---

## Post-Incident Review

After resolving budget exhaustion incident:

1. **Document incident:**
   - Date/time of alert
   - Affected clinics
   - Root cause
   - Resolution steps
   - Time to resolution

2. **Analyze trends:**
   - Is this a recurring issue?
   - Are limits too restrictive?
   - Is abuse a pattern?

3. **Update procedures:**
   - Improve monitoring
   - Adjust limits if needed
   - Enhance user education

4. **Communicate learnings:**
   - Share with engineering team
   - Update runbook
   - Improve alerting

---

## Related Documentation

- [Deployment Guide](../deployment-phase1-security-fixes.md)
- [Monitoring Guide](../monitoring-phase1-security-fixes.md)
- [AGENTS.md](../../AGENTS.md) - AI token limits section
- [Design Document](.kiro/specs/phase-1-critical-security-fixes/design.md)

---

## Appendix: SQL Queries

### Check Current Budget Status

```sql
SELECT 
  c.id,
  c.name,
  c.ai_monthly_tokens as current_usage,
  c.ai_tokens_reset_at as reset_date,
  CASE 
    WHEN MAX(u.role) = 'super_admin' THEN 1000000
    WHEN MAX(u.role) = 'clinic_admin' THEN 100000
    WHEN MAX(u.role) = 'doctor' THEN 50000
    WHEN MAX(u.role) = 'receptionist' THEN 20000
    ELSE 10000
  END as limit,
  ROUND((c.ai_monthly_tokens * 100.0 / 
    CASE 
      WHEN MAX(u.role) = 'super_admin' THEN 1000000
      WHEN MAX(u.role) = 'clinic_admin' THEN 100000
      WHEN MAX(u.role) = 'doctor' THEN 50000
      WHEN MAX(u.role) = 'receptionist' THEN 20000
      ELSE 10000
    END
  ), 2) as usage_percentage
FROM clinics c
JOIN users u ON u.clinic_id = c.id
GROUP BY c.id, c.name, c.ai_monthly_tokens, c.ai_tokens_reset_at
ORDER BY usage_percentage DESC;
```

### Reset Budget for Specific Clinic

```sql
UPDATE clinics
SET ai_monthly_tokens = 0,
    ai_tokens_reset_at = NOW()
WHERE id = '<clinic-id>';
```

### Get AI Usage History

```sql
SELECT 
  DATE_TRUNC('day', timestamp) as day,
  COUNT(*) as requests,
  SUM(tokens_used) as total_tokens,
  AVG(tokens_used) as avg_tokens,
  MAX(tokens_used) as max_tokens
FROM ai_request_log
WHERE clinic_id = '<clinic-id>'
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day DESC;
```

---

**Runbook Version:** 1.0  
**Last Updated:** 2026-05-01  
**Owner:** Engineering Team  
**Next Review:** After first month of production use
