# Quick Fix - TypeScript Errors

## TL;DR

Run this command to fix all TypeScript errors:

```powershell
.\fix-types.ps1
```

Then commit and push:

```bash
git add package-lock.json src/lib/types/database.ts supabase/migrations/00073_production_features.sql
git commit -m "fix: Regenerate package-lock.json and database types"
git push origin main
```

## What It Does

1. ✅ Runs Supabase migrations (creates AI tables)
2. ✅ Regenerates TypeScript types from database
3. ✅ Verifies all TypeScript errors are fixed

## Requirements

- Supabase CLI installed (`npm install -g supabase`)
- Either:
  - Docker Desktop (for local Supabase), OR
  - Supabase project ref (for remote Supabase)

## Full Guide

See [FIX_TYPESCRIPT_ERRORS.md](./FIX_TYPESCRIPT_ERRORS.md) for detailed instructions.
