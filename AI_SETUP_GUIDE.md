# 🚀 AI Revenue Agent - Quick Setup Guide

## Prerequisites

- Supabase project set up
- OpenAI API key (or Anthropic API key)
- Cloudflare Workers deployment (for cron jobs)

---

## Step 1: Database Migration

Run the migration to create AI tables:

```bash
# If using Supabase CLI
supabase db push

# Or apply the migration manually in Supabase Dashboard
# SQL Editor → Run: supabase/migrations/00069_ai_revenue_agent.sql
```

This creates:
- `ai_decisions` - AI decisions and strategies
- `ai_actions` - Actions taken by AI
- `ai_insights` - Business insights
- `ai_message_log` - Message tracking
- `clinics.ai_config` - AI configuration column

---

## Step 2: Environment Variables

Add to your `.env` file:

```bash
# OpenAI (Primary LLM) - Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Anthropic (Fallback LLM) - Get from https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...

# Cron Secret (generate a random string)
CRON_SECRET=your-random-secret-key-here

# Supabase (should already exist)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Generate Cron Secret

```bash
# On Linux/Mac
openssl rand -base64 32

# Or use any random string generator
```

---

## Step 3: Deploy to Cloudflare Workers

### Option A: Using Wrangler

Add to `wrangler.toml`:

```toml
[triggers]
crons = [
  "0 2 * * *",  # AI Analysis at 2 AM (Africa/Casablanca)
  "0 3 * * *"   # Action Execution at 3 AM (Africa/Casablanca)
]

[vars]
CRON_SECRET = "your-random-secret-key-here"
```

Deploy:

```bash
npm run deploy
```

### Option B: Using Cloudflare Dashboard

1. Go to Workers & Pages → Your Worker → Triggers
2. Add Cron Triggers:
   - `0 2 * * *` (2 AM daily)
   - `0 3 * * *` (3 AM daily)
3. Add Environment Variable:
   - Name: `CRON_SECRET`
   - Value: Your secret key

### Option C: External Cron Service

Use any cron service (cron-job.org, EasyCron, etc.) to call:

```bash
# Daily at 2 AM
curl -X GET https://your-domain.com/api/cron/ai-analysis \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Daily at 3 AM
curl -X GET https://your-domain.com/api/cron/ai-actions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Step 4: Access the Dashboard

1. Navigate to: `https://your-domain.com/admin/ai`
2. You'll see the AI Dashboard with:
   - Revenue metrics
   - Action statistics
   - Activity feed
   - Insights

---

## Step 5: Configure AI Settings

1. Click the "Settings" tab
2. Configure:

### General Settings
- ✅ Enable AI Agent
- Choose autonomy level:
  - **Assistant**: AI suggests, you approve everything
  - **Copilot**: AI executes low-risk actions automatically
  - **Autopilot**: AI executes all actions automatically (except high-risk)
- Set max actions per day: `50` (recommended)
- Set max spend per action: `100 MAD` (recommended)

### Auto-Approval
- ✅ Low risk actions (reminders, follow-ups)
- ✅ Medium risk actions (rescheduling, promotions) - for copilot/autopilot
- ❌ High risk actions (pricing changes) - always require approval

### Capabilities
Enable the features you want:
- ✅ Customer re-engagement
- ✅ Intelligent scheduling
- ❌ Dynamic pricing (enable when ready)
- ✅ Upselling
- ✅ Customer service
- ✅ Marketing campaigns
- ✅ Analytics
- ✅ Predictions

### Goals
- Primary goal: **Revenue** (or Retention/Satisfaction/Efficiency)
- Target revenue increase: `50%`
- Target retention rate: `80%`

3. Click "Save Changes"

---

## Step 6: Run First Analysis

1. Click "Run Analysis" button
2. Wait for AI to analyze your business (30-60 seconds)
3. Review the results:
   - Decisions made
   - Actions created
   - Insights generated

---

## Step 7: Approve Actions (if needed)

If you have high-risk actions pending:

1. Go to Activity Feed
2. Find actions with "Pending" status
3. Review the reasoning
4. Click to approve or reject

---

## Verification Checklist

- [ ] Database migration applied successfully
- [ ] Environment variables set
- [ ] Cron jobs configured (or external cron service)
- [ ] AI Dashboard accessible at `/admin/ai`
- [ ] AI settings saved
- [ ] First analysis completed successfully
- [ ] Actions appear in activity feed
- [ ] Insights generated

---

## Testing Without API Keys

For development/testing without OpenAI/Anthropic API keys:

The system will use mock responses automatically. You'll see:
- Mock decisions
- Mock insights
- Mock action recommendations

This is perfect for:
- UI development
- Testing workflows
- Demo purposes

---

## Troubleshooting

### "AI is disabled for this business"

**Solution:** Go to Settings tab and toggle "Enable AI Agent" on.

### "Failed to get AI config"

**Solution:** Check that the `ai_config` column exists in `clinics` table.

### "Analysis failed"

**Solution:** 
1. Check environment variables are set
2. Check OpenAI/Anthropic API keys are valid
3. Check Supabase connection
4. Check browser console for errors

### Cron jobs not running

**Solution:**
1. Verify cron triggers are configured
2. Check `CRON_SECRET` environment variable
3. Test manually: `curl -X GET https://your-domain.com/api/cron/ai-analysis -H "Authorization: Bearer YOUR_CRON_SECRET"`
4. Check Cloudflare Workers logs

### Actions not executing

**Solution:**
1. Check action status (should be "approved")
2. Check autonomy level and auto-approval settings
3. Check cron job logs
4. Manually trigger: Go to dashboard → Run Analysis

---

## Performance Optimization

### Context Caching

The context engine caches business data for 5 minutes. To adjust:

```typescript
// src/lib/ai/context-engine.ts
const CACHE_TTL = 5 * 60 * 1000; // Change to desired milliseconds
```

### Rate Limiting

To avoid hitting LLM rate limits:

```typescript
// src/lib/ai/action-engine.ts
// Adjust delay between actions (default: 1000ms)
await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds
```

### Batch Size

To process more/fewer actions per cron run:

```typescript
// src/app/api/cron/ai-actions/route.ts
.limit(config.autonomy.max_actions_per_day); // Uses config setting
```

---

## Monitoring

### Key Metrics to Watch

1. **Revenue Generated**
   - Track daily/weekly/monthly
   - Compare to pre-AI baseline

2. **Action Success Rate**
   - Should be > 90%
   - If lower, review failed actions

3. **Actions Requiring Approval**
   - High volume = too conservative
   - Adjust auto-approval settings

4. **Time Saved**
   - Track hours saved per week
   - Calculate ROI

### Logs to Monitor

```bash
# Check AI analysis logs
grep "ai-analysis-cron" logs.txt

# Check action execution logs
grep "ai-action-engine" logs.txt

# Check safety layer logs
grep "ai-safety-layer" logs.txt
```

---

## Next Steps

1. **Week 1**: Monitor AI performance, adjust settings
2. **Week 2**: Enable more capabilities (dynamic pricing, etc.)
3. **Week 3**: Increase autonomy level (assistant → copilot → autopilot)
4. **Week 4**: Measure ROI and customer satisfaction

---

## Support

For issues or questions:
1. Check `AI_REVENUE_AGENT_COMPLETE.md` for detailed documentation
2. Review code comments in `src/lib/ai/`
3. Check logs for error messages

---

**You're all set! The AI Revenue Agent is now working to grow your business. 🚀**
