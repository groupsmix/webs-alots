#!/usr/bin/env pwsh
# Fix TypeScript Errors - Regenerate Database Types
# This script runs Supabase migrations and regenerates TypeScript types

Write-Host "🔧 Fixing TypeScript Errors..." -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
Write-Host "📦 Checking Supabase CLI..." -ForegroundColor Yellow
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseInstalled) {
    Write-Host "❌ Supabase CLI not found. Installing..." -ForegroundColor Red
    npm install -g supabase
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  No .env file found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Created .env file. Please configure it with your Supabase credentials." -ForegroundColor Green
    Write-Host ""
}

# Ask user which environment to use
Write-Host "🔍 Which Supabase environment do you want to use?" -ForegroundColor Cyan
Write-Host "  1. Local (supabase start + db push)"
Write-Host "  2. Remote (requires project ref)"
Write-Host ""
$choice = Read-Host "Enter choice (1 or 2)"

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "🚀 Starting local Supabase..." -ForegroundColor Yellow
    supabase start
    
    Write-Host ""
    Write-Host "📤 Pushing migrations to local database..." -ForegroundColor Yellow
    supabase db push
    
    Write-Host ""
    Write-Host "🔄 Generating TypeScript types from local database..." -ForegroundColor Yellow
    supabase gen types typescript --local > src/lib/types/database.ts
    
} elseif ($choice -eq "2") {
    Write-Host ""
    $projectRef = Read-Host "Enter your Supabase project ref (e.g., abcdefghijklmnop)"
    
    Write-Host ""
    Write-Host "📤 Pushing migrations to remote database..." -ForegroundColor Yellow
    supabase db push --project-ref $projectRef
    
    Write-Host ""
    Write-Host "🔄 Generating TypeScript types from remote database..." -ForegroundColor Yellow
    supabase gen types typescript --project-ref $projectRef > src/lib/types/database.ts
    
} else {
    Write-Host "❌ Invalid choice. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Database types regenerated!" -ForegroundColor Green
Write-Host ""

# Run TypeScript check
Write-Host "🔍 Running TypeScript check..." -ForegroundColor Yellow
npm run typecheck

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host ""
    Write-Host "✅ All TypeScript errors fixed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "  1. git add package-lock.json src/lib/types/database.ts supabase/migrations/00073_production_features.sql"
    Write-Host "  2. git commit -m 'fix: Regenerate package-lock.json and database types'"
    Write-Host "  3. git push origin main"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "⚠️  Some TypeScript errors remain. Check the output above." -ForegroundColor Yellow
    Write-Host ""
}
