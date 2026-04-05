#!/bin/bash

# 🚀 One-Click Setup Script for Oltigo Health + AI Revenue Agent
# This script automates Supabase and Cloudflare setup

set -e  # Exit on error

echo "🚀 Starting One-Click Setup..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📥 Installing Supabase CLI..."
    npm install -g supabase
fi

# Check if Wrangler (Cloudflare CLI) is installed
if ! command -v wrangler &> /dev/null; then
    echo "📥 Installing Wrangler (Cloudflare CLI)..."
    npm install -g wrangler
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Setup environment variables
echo ""
echo "🔧 Setting up environment variables..."

if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo -e "${YELLOW}⚠️  Please edit .env.local with your credentials${NC}"
    echo ""
    echo "Required variables:"
    echo "  - NEXT_PUBLIC_SUPABASE_URL"
    echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    echo "  - OPENAI_API_KEY or ANTHROPIC_API_KEY"
    echo "  - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN"
    echo "  - RESEND_API_KEY"
    echo ""
    read -p "Press Enter after you've updated .env.local..."
fi

# Supabase Setup
echo ""
echo "🗄️  Setting up Supabase..."

read -p "Do you want to use an existing Supabase project? (y/n): " use_existing

if [ "$use_existing" = "y" ]; then
    echo "Please provide your Supabase project details:"
    read -p "Project URL (e.g., https://xxx.supabase.co): " supabase_url
    read -p "Anon Key: " supabase_anon_key
    read -sp "Service Role Key: " supabase_service_key
    echo ""
    
    # Update .env.local
    sed -i "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$supabase_url|" .env.local
    sed -i "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabase_anon_key|" .env.local
    sed -i "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$supabase_service_key|" .env.local
    
    echo -e "${GREEN}✅ Supabase credentials configured${NC}"
else
    echo "Creating new Supabase project..."
    echo -e "${YELLOW}⚠️  Please create a project at https://supabase.com/dashboard${NC}"
    echo "Then run this script again with 'y' to use existing project."
    exit 0
fi

# Run database migrations
echo ""
echo "🔄 Running database migrations..."
read -p "Do you want to run migrations now? (y/n): " run_migrations

if [ "$run_migrations" = "y" ]; then
    echo "Linking to Supabase project..."
    supabase link --project-ref $(echo $supabase_url | sed 's|https://||' | sed 's|.supabase.co||')
    
    echo "Pushing migrations..."
    supabase db push
    
    echo -e "${GREEN}✅ Migrations completed${NC}"
fi

# Cloudflare Setup
echo ""
echo "☁️  Setting up Cloudflare..."

read -p "Do you have a Cloudflare account? (y/n): " has_cloudflare

if [ "$has_cloudflare" = "y" ]; then
    echo "Authenticating with Cloudflare..."
    wrangler login
    
    echo "Creating Cloudflare Pages project..."
    read -p "Enter your project name (e.g., oltigo-health): " project_name
    
    # Create wrangler.toml if it doesn't exist
    if [ ! -f wrangler.toml ]; then
        cat > wrangler.toml << EOF
name = "$project_name"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".vercel/output/static"

[env.production]
vars = { NODE_ENV = "production" }

[env.preview]
vars = { NODE_ENV = "preview" }
EOF
        echo -e "${GREEN}✅ wrangler.toml created${NC}"
    fi
    
    echo -e "${GREEN}✅ Cloudflare configured${NC}"
else
    echo -e "${YELLOW}⚠️  Please create a Cloudflare account at https://dash.cloudflare.com${NC}"
    echo "Then run: wrangler login"
fi

# Build the application
echo ""
echo "🔨 Building application..."
npm run build

echo -e "${GREEN}✅ Build completed${NC}"

# Final summary
echo ""
echo "================================"
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Verify .env.local has all required variables"
echo "2. Test locally: npm run dev"
echo "3. Deploy to Cloudflare: npm run deploy"
echo ""
echo "📚 Documentation:"
echo "  - Setup Guide: AI_SETUP_GUIDE.md"
echo "  - Deployment: DEPLOY_CHECKLIST_FINAL.md"
echo "  - Quick Reference: AI_QUICK_REFERENCE.md"
echo ""
echo -e "${GREEN}✅ Your AI Revenue Agent is ready!${NC}"
