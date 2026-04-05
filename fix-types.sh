#!/bin/bash
# Fix TypeScript Errors - Regenerate Database Types
# This script runs Supabase migrations and regenerates TypeScript types

echo "🔧 Fixing TypeScript Errors..."
echo ""

# Check if Supabase CLI is installed
echo "📦 Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please configure it with your Supabase credentials."
    echo ""
fi

# Ask user which environment to use
echo "🔍 Which Supabase environment do you want to use?"
echo "  1. Local (supabase start + db push)"
echo "  2. Remote (requires project ref)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "🚀 Starting local Supabase..."
    supabase start
    
    echo ""
    echo "📤 Pushing migrations to local database..."
    supabase db push
    
    echo ""
    echo "🔄 Generating TypeScript types from local database..."
    supabase gen types typescript --local > src/lib/types/database.ts
    
elif [ "$choice" = "2" ]; then
    echo ""
    read -p "Enter your Supabase project ref (e.g., abcdefghijklmnop): " projectRef
    
    echo ""
    echo "📤 Pushing migrations to remote database..."
    supabase db push --project-ref "$projectRef"
    
    echo ""
    echo "🔄 Generating TypeScript types from remote database..."
    supabase gen types typescript --project-ref "$projectRef" > src/lib/types/database.ts
    
else
    echo "❌ Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "✅ Database types regenerated!"
echo ""

# Run TypeScript check
echo "🔍 Running TypeScript check..."
npm run typecheck

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All TypeScript errors fixed!"
    echo ""
    echo "📝 Next steps:"
    echo "  1. git add package-lock.json src/lib/types/database.ts supabase/migrations/00073_production_features.sql"
    echo "  2. git commit -m 'fix: Regenerate package-lock.json and database types'"
    echo "  3. git push origin main"
    echo ""
else
    echo ""
    echo "⚠️  Some TypeScript errors remain. Check the output above."
    echo ""
fi
