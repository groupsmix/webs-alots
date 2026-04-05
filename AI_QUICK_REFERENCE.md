# 🚀 AI Revenue Agent - Quick Reference

## File Structure

```
src/lib/ai/
├── types.ts                    # All type definitions
├── context-engine.ts           # Business intelligence
├── decision-engine.ts          # AI decision making
├── action-engine.ts            # Action execution
├── config.ts                   # Configuration management
├── safety-layer.ts             # Safety checks
├── approval-workflow.ts        # Approval system
└── rollback.ts                 # Rollback logic

src/components/admin/
├── ai-dashboard.tsx            # Main dashboard
└── ai-settings.tsx             # Settings UI

src/app/api/ai/
├── config/route.ts             # Config API
├── analyze/route.ts            # Analysis API
├── actions/route.ts            # Actions API
├── insights/route.ts           # Insights API
└── performance/route.ts        # Performance API

src/app/api/cron/
├── ai-analysis/route.ts        # Daily analysis
└── ai-actions/route.ts         # Action execution

src/app/(admin)/admin/
└── ai/page.tsx                 # AI management page

supabase/migrations/
└── 00069_ai_revenue_agent.sql  # Database schema
```

---

## Key Functions

### Context Engine

```typescript
import { buildAIContext } from '@/lib/ai/context-engine';

// Build complete business context
const context = await buildAIContext('clinic-id');

// Access data
console.log(context.business.metrics.total_revenue);
console.log(context.customers.filter(c => c.segment === 'vip'));
```

### Decision Engine

```typescript
import { generateDecisions, generateInsights } from '@/lib/ai/decision-engine';

// Generate decisions
const decision = await generateDecisions('clinic-id', context, 'revenue');

// Generate insights
const insights = await generateInsights('clinic-id', context);
```

### Action Engine

```typescript
import { executeAction, getActionStats } from '@/lib/ai/action-engine';
import { getAIConfig } from '@/lib/ai/config';

// Execute action
const config = await getAIConfig('clinic-id');
const result = await executeAction(action, config);

// Get statistics
const stats = await getActionStats('clinic-id', 30); // Last 30 days
```

### Configuration

```typescript
import { getAIConfig, updateAIConfig } from '@/lib/ai/config';

// Get config
const config = await getAIConfig('clinic-id');

// Update config
await updateAIConfig('clinic-id', {
  enabled: true,
  autonomy: {
    level: 'copilot',
    auto_approve: { low: true, medium: true, high: false }
  }
});
```

---

## API Endpoints

### Configuration

```bash
# Get AI config
GET /api/ai/config?businessId=clinic-id

# Update AI config
PUT /api/ai/config
Body: { businessId: 'clinic-id', config: {...} }
```

### Analysis

```bash
# Trigger analysis
POST /api/ai/analyze
Body: { businessId: 'clinic-id' }
```

### Actions

```bash
# List actions
GET /api/ai/actions?businessId=clinic-id&limit=50&status=pending

# Approve/reject action
POST /api/ai/actions
Body: { actionId: 'action-id', approve: true, userId: 'user-id' }
```

### Insights

```bash
# Get insights
GET /api/ai/insights?businessId=clinic-id&limit=10
```

### Performance

```bash
# Get performance metrics
GET /api/ai/performance?businessId=clinic-id&days=30
```

---

## Database Tables

### ai_decisions

```sql
SELECT * FROM ai_decisions 
WHERE business_id = 'clinic-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

### ai_actions

```sql
-- Get pending actions
SELECT * FROM ai_actions 
WHERE business_id = 'clinic-id' 
AND status = 'pending';

-- Get completed actions
SELECT * FROM ai_actions 
WHERE business_id = 'clinic-id' 
AND status = 'completed'
ORDER BY completed_at DESC;
```

### ai_insights

```sql
-- Get unacted insights
SELECT * FROM ai_insights 
WHERE business_id = 'clinic-id' 
AND NOT acted_upon
ORDER BY impact DESC, created_at DESC;
```

### ai_message_log

```sql
-- Get sent messages
SELECT * FROM ai_message_log 
WHERE business_id = 'clinic-id' 
AND status = 'sent'
ORDER BY sent_at DESC;
```

---

## Environment Variables

```bash
# Required for production
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
CRON_SECRET=your-secret-key

# Already configured
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Cron Jobs

### Manual Trigger

```bash
# Trigger analysis
curl -X GET https://your-domain.com/api/cron/ai-analysis \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Execute actions
curl -X GET https://your-domain.com/api/cron/ai-actions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Cloudflare Workers

```toml
# wrangler.toml
[triggers]
crons = [
  "0 2 * * *",  # 2 AM daily
  "0 3 * * *"   # 3 AM daily
]
```

---

## Action Types

| Type | Risk Level | Description |
|------|-----------|-------------|
| send_message | Low | Send WhatsApp/SMS/Email |
| create_appointment | Medium | Book appointment |
| reschedule_appointment | Medium | Reschedule appointment |
| cancel_appointment | Medium | Cancel appointment |
| adjust_pricing | High | Change service pricing |
| create_promotion | Medium | Create promotion |
| send_review_request | Low | Request review |
| create_upsell_offer | Low | Send upsell offer |
| update_availability | Medium | Update availability |
| predict_no_show | Low | Predict no-show |
| identify_opportunity | Low | Identify opportunity |

---

## Customer Segments

| Segment | Criteria |
|---------|----------|
| VIP | High spend + frequent visits |
| Regular | Normal behavior |
| At-Risk | High churn risk |
| Inactive | No visits in 180+ days |
| New | 1 appointment or less |

---

## Autonomy Levels

| Level | Behavior |
|-------|----------|
| Assistant | AI suggests, you approve everything |
| Copilot | AI executes low-risk actions automatically |
| Autopilot | AI executes all actions (except high-risk) |

---

## Safety Rules

1. Budget limit per action
2. Rate limiting (max actions per day)
3. Pricing change limits (max % change)
4. Customer protection (no spam)
5. Data validation
6. Rollback on failure
7. Approval for high-risk
8. Audit logging
9. Tenant isolation
10. Human review sampling

---

## Common Tasks

### Enable AI for a Business

```typescript
await updateAIConfig('clinic-id', {
  enabled: true,
  autonomy: { level: 'copilot' }
});
```

### Run Manual Analysis

```typescript
const response = await fetch('/api/ai/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ businessId: 'clinic-id' })
});
```

### Approve Pending Action

```typescript
const response = await fetch('/api/ai/actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    actionId: 'action-id',
    approve: true,
    userId: 'user-id'
  })
});
```

### Get Performance Metrics

```typescript
const stats = await getActionStats('clinic-id', 30);
console.log('Revenue generated:', stats.total_revenue_impact / 100, 'MAD');
console.log('Success rate:', stats.actions.success_rate * 100, '%');
```

---

## Debugging

### Check AI Config

```typescript
const config = await getAIConfig('clinic-id');
console.log('Enabled:', config.enabled);
console.log('Autonomy:', config.autonomy.level);
console.log('Auto-approve:', config.autonomy.auto_approve);
```

### Check Context

```typescript
const context = await buildAIContext('clinic-id');
console.log('Total revenue:', context.business.metrics.total_revenue);
console.log('Active customers:', context.business.metrics.active_customers);
console.log('Customer segments:', context.customers.map(c => c.segment));
```

### Check Actions

```sql
-- Get failed actions
SELECT * FROM ai_actions 
WHERE business_id = 'clinic-id' 
AND status = 'failed'
ORDER BY created_at DESC;

-- Get actions by type
SELECT type, COUNT(*) 
FROM ai_actions 
WHERE business_id = 'clinic-id' 
GROUP BY type;
```

### Check Logs

```bash
# Search logs for AI activity
grep "ai-action-engine" logs.txt
grep "ai-analysis-cron" logs.txt
grep "ai-safety-layer" logs.txt
```

---

## Performance Tips

1. **Context caching** - Cached for 5 minutes, adjust in `context-engine.ts`
2. **Batch actions** - Use `executeActionBatch()` for multiple actions
3. **Rate limiting** - Adjust delay between actions in `action-engine.ts`
4. **Database indexes** - Already optimized in migration
5. **LLM caching** - Consider caching LLM responses for similar contexts

---

## Security Checklist

- ✅ Tenant isolation enforced (RLS policies)
- ✅ Authentication required (all API routes)
- ✅ Safety checks before execution
- ✅ Approval workflow for high-risk
- ✅ Audit logging for all actions
- ✅ Rollback on failures
- ✅ Budget limits enforced
- ✅ Rate limiting enforced
- ✅ Input validation (Zod schemas)
- ✅ Cron secret protection

---

## Support

- **Documentation**: `AI_REVENUE_AGENT_COMPLETE.md`
- **Setup Guide**: `AI_SETUP_GUIDE.md`
- **Status**: `AI_REVENUE_AGENT_STATUS.md`
- **Safety**: `AI_SAFETY_LAYER_COMPLETE.md`

---

**Quick reference for developers working with the AI Revenue Agent. 🚀**
