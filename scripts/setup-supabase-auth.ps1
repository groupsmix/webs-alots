# Supabase Auth Auto-Configuration Script (PowerShell)
# 
# This script helps configure Supabase Auth URL settings for wristnerd.xyz
# 
# Usage:
#   1. Set environment variables or run interactively
#   2. Run: .\scripts\setup-supabase-auth.ps1
#   3. Follow prompts

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔧 Supabase Auth Auto-Configuration" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Get Supabase credentials
$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseUrl) {
    $supabaseUrl = Read-Host "Enter your Supabase URL (e.g., https://xxxxx.supabase.co)"
}

if (-not $serviceKey) {
    $serviceKey = Read-Host "Enter your SUPABASE_SERVICE_ROLE_KEY" -AsSecureString
    $serviceKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($serviceKey))
}

# Clean up URL
$supabaseUrl = $supabaseUrl.Trim().TrimEnd('/')

Write-Host ""
Write-Host "📝 Configuration:" -ForegroundColor Yellow
Write-Host "   Supabase URL: $supabaseUrl"
Write-Host "   Site URL: https://wristnerd.xyz"
Write-Host "   Redirect URLs: https://wristnerd.xyz/**, https://*.wristnerd.xyz/**"
Write-Host ""

$confirm = Read-Host "Proceed with configuration? (yes/no)"

if ($confirm -ne "yes" -and $confirm -ne "y") {
    Write-Host "❌ Cancelled." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🚀 Testing Supabase connection..." -ForegroundColor Green
Write-Host ""

try {
    # Test connection
    $headers = @{
        'Authorization' = "Bearer $serviceKey"
        'apikey' = $serviceKey
    }
    
    $testResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/sites?limit=1" -Headers $headers -Method GET
    
    Write-Host "✅ Supabase connection verified!" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "❌ Connection failed: $_" -ForegroundColor Red
    Write-Host "Check your SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
    exit
}

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "⚠️  IMPORTANT: Manual Step Required" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Supabase Auth URL settings cannot be fully automated via API" -ForegroundColor Yellow
Write-Host "(This is a security feature from Supabase)" -ForegroundColor Gray
Write-Host ""
Write-Host "👉 Go to: https://supabase.com/dashboard" -ForegroundColor Cyan
Write-Host "   → Select your project" -ForegroundColor White
Write-Host "   → Authentication → URL Configuration" -ForegroundColor White
Write-Host ""
Write-Host "📝 Update these settings:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Site URL:" -ForegroundColor Yellow
Write-Host "   https://wristnerd.xyz" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Add these Redirect URLs:" -ForegroundColor Yellow
Write-Host "   https://wristnerd.xyz/**" -ForegroundColor Cyan
Write-Host "   https://*.wristnerd.xyz/**" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Click 'Save changes'" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ After saving, your auth will work at:" -ForegroundColor Green
Write-Host "   https://wristnerd.xyz/admin" -ForegroundColor Cyan
