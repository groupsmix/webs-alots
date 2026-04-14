@echo off
chcp 65001 >nul
echo.
echo ═══════════════════════════════════════════════════════════════
echo 🔧 Supabase Auth Configuration Helper
echo ═══════════════════════════════════════════════════════════════
echo.
echo This script will help you configure Supabase Auth for wristnerd.xyz
echo.
echo Choose an option:
echo   [1] Run PowerShell script (Recommended for Windows)
echo   [2] Run Node.js script
echo   [3] Show manual instructions only
echo.
set /p choice="Enter 1, 2, or 3: "

if "%choice%"=="1" (
    echo.
    echo Starting PowerShell script...
    powershell -ExecutionPolicy Bypass -File "%~dp0setup-supabase-auth.ps1"
) else if "%choice%"=="2" (
    echo.
    echo Starting Node.js script...
    node "%~dp0setup-supabase-auth.js"
) else (
    echo.
    echo ═══════════════════════════════════════════════════════════════
    echo 📋 MANUAL INSTRUCTIONS
echo ═══════════════════════════════════════════════════════════════
    echo.
    echo Go to: https://supabase.com/dashboard
echo   → Select your project
echo   → Authentication → URL Configuration
echo.
    echo Update these settings:
echo.
    echo 1. Site URL:
echo    https://wristnerd.xyz
echo.
    echo 2. Add Redirect URLs ^(click "Add URL" for each^):
echo    https://wristnerd.xyz/**
echo    https://*.wristnerd.xyz/**
echo.
    echo 3. Click "Save changes"
echo.
    echo ═══════════════════════════════════════════════════════════════
)

echo.
pause
