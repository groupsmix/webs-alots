# Fix TypeScript Errors - Complete Guide

## Problem

The TypeScript compiler is failing with 345 errors because:

1. **Database types are out of sync** - The `src/lib/types/database.ts` file doesn't include the new AI tables (`ai_actions`, `ai_decisions`, `ai_insights`, etc.) created in migrations 00069-00073
2. **Migration 00073 had a bug** - It referenced a non-existent `ai_agent_config` table (now fixed)
3. **package-lock.json was out of sync** - Already fixed with `npm install`

## Solution

You need to run the Supabase migrations and regenerate the TypeScript types from your database schema.

## Quick Fix (Automated)

### Windows (PowerShell)

```powershell
.\fix-types.ps1
```

### Mac/Linux (Bash)

```bash
chmod +x fix-types.sh
./fix-types.sh
```

The script will:
1. Check if Supabase CLI is installed
2. Ask if you want to use local or remote Supabase
3. Push migrations to database
4. Regenerate TypeScript types
5. Run typecheck to verify

## Manual Fix (Step-by-Step)

### Option 1: Local Supabase

```bash
# 1. Start local Supabase (requires Docker)
supabase start

# 2. Push migrations to local database
supabase db push

# 3. Generate TypeScript types from local database
supabase gen types typescript --local > src/lib/types/database.ts

# 4. Verify TypeScript errors are fixed
npm run typecheck
```

### Option 2: Remote Supabase

```bash
# 1. Get your project ref from Supabase dashboard
# URL format: https://app.supabase.com/project/YOUR_PROJECT_REF

# 2. Push migrations to remote database
supabase db push --project-ref YOUR_PROJECT_REF

# 3. Generate TypeScript types from remote database
supabase gen types typescript --project-ref YOUR_PROJECT_REF > src/lib/types/database.ts

# 4. Verify TypeScript errors are fixed
npm run typecheck
```

## What Gets Fixed

After running the migrations and regenerating types, the following tables will be added to `database.ts`:

### AI Revenue Agent Tables (Migration 00069)
- `ai_decisions` - AI-generated business decisions
- `ai_actions` - Actions taken by AI
- `ai_insights` - Business insights and recommendations
- `ai_message_log` - Messages sent to customers

### AI Advanced Features (Migration 00070)
- `ai_learning_outcomes` - Tracks action outcomes for learning
- `ai_learnings` - Patterns learned by AI
- `ai_campaigns` - Marketing campaigns
- `campaign_enrollments` - Customer enrollment in campaigns
- `ai_notifications` - Admin notifications
- `ai_analytics_cache` - Cached analytics data

### Schema Fixes (Migration 00071)
- `price_history` - Service price change tracking
- `time_slots` - Doctor availability slots
- Updates to `services`, `appointments`, `promotions` tables

### Promotions (Migration 00072)
- `promotions` - Promotional offers and discount codes

### Production Features (Migration 00073)
- `ai_scheduled_actions` - Scheduled AI actions
- `ai_idempotency_keys` - Prevent duplicate actions
- `ai_webhook_subscriptions` - External integrations
- `ai_webhook_logs` - Webhook delivery logs
- `ai_feature_flags` - Feature flag system

## Commit and Push

After fixing the TypeScript errors:

```bash
# Stage the fixed files
git add package-lock.json
git add src/lib/types/database.ts
git add supabase/migrations/00073_production_features.sql

# Commit
git commit -m "fix: Regenerate package-lock.json and database types"

# Push to GitHub
git push origin main
```

## Troubleshooting

### "Supabase CLI not found"

Install Supabase CLI:

```bash
npm install -g supabase
```

Or with Homebrew (Mac):

```bash
brew install supabase/tap/supabase
```

### "Docker not running" (Local Supabase)

Local Supabase requires Docker Desktop:
- Windows/Mac: Download from https://www.docker.com/products/docker-desktop
- Linux: Install Docker Engine

If you don't have Docker, use Option 2 (Remote Supabase) instead.

### "Project ref not found" (Remote Supabase)

1. Go to https://app.supabase.com
2. Select your project
3. The project ref is in the URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`
4. Or find it in Settings → General → Reference ID

### "Migration already applied"

This is normal - Supabase tracks which migrations have been applied. If you see this message, the migrations are already in your database and you just need to regenerate types:

```bash
# Local
supabase gen types typescript --local > src/lib/types/database.ts

# Remote
supabase gen types typescript --project-ref YOUR_PROJECT_REF > src/lib/types/database.ts
```

### TypeScript errors still remain

If you still see errors after regenerating types:

1. Check that `src/lib/types/database.ts` contains the AI tables (search for `ai_actions`)
2. Restart your IDE/editor to reload TypeScript
3. Clear TypeScript cache: `rm -rf node_modules/.cache`
4. Run `npm run typecheck` again

## Why This Happened

The AI Revenue Agent added 42 new files and 5 database migrations. The migrations create new tables, but the TypeScript types file (`database.ts`) is generated from the database schema, not from the migration files. 

When you clone a repo or switch branches, you get the migration files but not the updated types - you need to run the migrations and regenerate types yourself.

This is standard practice for Supabase projects to ensure type safety matches your actual database schema.
