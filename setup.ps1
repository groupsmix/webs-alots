# 🚀 One-Click Setup Script for Oltigo Health + AI Revenue Agent (Windows)
# This script automates Supabase and Cloudflare setup

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting One-Click Setup..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Check if required tools are installed
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js first." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm is not installed. Please install npm first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Check if Supabase CLI is installed
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "📥 Installing Supabase CLI..." -ForegroundColor Yellow
    npm install -g supabase
}

# Check if Wrangler (Cloudflare CLI) is installed
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
    Write-Host "📥 Installing Wrangler (Cloudflare CLI)..." -ForegroundColor Yellow
    npm install -g wrangler
}

Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Setup environment variables
Write-Host "`n🔧 Setting up environment variables..." -ForegroundColor Yellow

if (-not (Test-Path .env.local)) {
    Copy-Item .env.example .env.local
    Write-Host "⚠️  Please edit .env.local with your credentials" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Required variables:"
    Write-Host "  - NEXT_PUBLIC_SUPABASE_URL"
    Write-Host "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    Write-Host "  - SUPABASE_SERVICE_ROLE_KEY"
    Write-Host "  - OPENAI_API_KEY or ANTHROPIC_API_KEY"
    Write-Host "  - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN"
    Write-Host "  - RESEND_API_KEY"
    Write-Host ""
    
    # Open .env.local in default editor
    Start-Process .env.local
    
    Read-Host "Press Enter after you've updated .env.local"
}

# Supabase Setup
Write-Host "`n🗄️  Setting up Supabase..." -ForegroundColor Yellow

$useExisting = Read-Host "Do you want to use an existing Supabase project? (y/n)"

if ($useExisting -eq "y") {
    Write-Host "Please provide your Supabase project details:"
    $supabaseUrl = Read-Host "Project URL (e.g., https://xxx.supabase.co)"
    $supabaseAnonKey = Read-Host "Anon Key"
    $supabaseServiceKey = Read-Host "Service Role Key" -AsSecureString
    $supabaseServiceKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($supabaseServiceKey)
    )
    
    # Update .env.local
    $envContent = Get-Content .env.local
    $envContent = $envContent -replace "NEXT_PUBLIC_SUPABASE_URL=.*", "NEXT_PUBLIC_SUPABASE_URL=$supabaseUrl"
    $envContent = $envContent -replace "NEXT_PUBLIC_SUPABASE_ANON_KEY=.*", "NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabaseAnonKey"
    $envContent = $envContent -replace "SUPABASE_SERVICE_ROLE_KEY=.*", "SUPABASE_SERVICE_ROLE_KEY=$supabaseServiceKeyPlain"
    $envContent | Set-Content .env.local
    
    Write-Host "✅ Supabase credentials configured" -ForegroundColor Green
} else {
    Write-Host "Creating new Supabase project..." -ForegroundColor Yellow
    Write-Host "⚠️  Please create a project at https://supabase.com/dashboard" -ForegroundColor Yellow
    Write-Host "Then run this script again with 'y' to use existing project."
    Start-Process "https://supabase.com/dashboard"
    exit 0
}

# Run database migrations
Write-Host "`n🔄 Running database migrations..." -ForegroundColor Yellow
$runMigrations = Read-Host "Do you want to run migrations now? (y/n)"

if ($runMigrations -eq "y") {
    Write-Host "Linking to Supabase project..."
    $projectRef = $supabaseUrl -replace "https://", "" -replace ".supabase.co", ""
    supabase link --project-ref $projectRef
    
    Write-Host "Pushing migrations..."
    supabase db push
    
    Write-Host "✅ Migrations completed" -ForegroundColor Green
}

# Cloudflare Setup
Write-Host "`n☁️  Setting up Cloudflare..." -ForegroundColor Yellow

$hasCloudflare = Read-Host "Do you have a Cloudflare account? (y/n)"

if ($hasCloudflare -eq "y") {
    Write-Host "Authenticating with Cloudflare..."
    wrangler login
    
    Write-Host "Creating Cloudflare Pages project..."
    $projectName = Read-Host "Enter your project name (e.g., oltigo-health)"
    
    # Create wrangler.toml if it doesn't exist
    if (-not (Test-Path wrangler.toml)) {
        @"
name = "$projectName"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".vercel/output/static"

[env.production]
vars = { NODE_ENV = "production" }

[env.preview]
vars = { NODE_ENV = "preview" }
"@ | Set-Content wrangler.toml
        Write-Host "✅ wrangler.toml created" -ForegroundColor Green
    }
    
    Write-Host "✅ Cloudflare configured" -ForegroundColor Green
} else {
    Write-Host "⚠️  Please create a Cloudflare account at https://dash.cloudflare.com" -ForegroundColor Yellow
    Write-Host "Then run: wrangler login"
    Start-Process "https://dash.cloudflare.com"
}

# Build the application
Write-Host "`n🔨 Building application..." -ForegroundColor Yellow
npm run build

Write-Host "✅ Build completed" -ForegroundColor Green

# Final summary
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next Steps:"
Write-Host ""
Write-Host "1. Verify .env.local has all required variables"
Write-Host "2. Test locally: npm run dev"
Write-Host "3. Deploy to Cloudflare: npm run deploy"
Write-Host ""
Write-Host "📚 Documentation:"
Write-Host "  - Setup Guide: AI_SETUP_GUIDE.md"
Write-Host "  - Deployment: DEPLOY_CHECKLIST_FINAL.md"
Write-Host "  - Quick Reference: AI_QUICK_REFERENCE.md"
Write-Host ""
Write-Host "✅ Your AI Revenue Agent is ready!" -ForegroundColor Green
