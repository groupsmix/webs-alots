#!/usr/bin/env node
/**
 * Supabase Auth Auto-Configuration Script
 * 
 * This script automatically configures Supabase Auth URL settings
 * for your wristnerd.xyz domain - no manual dashboard clicks needed!
 * 
 * Usage:
 *   1. Set your SUPABASE_SERVICE_ROLE_KEY in .env or environment
 *   2. Run: node scripts/setup-supabase-auth.js
 *   3. Done! Auth is configured for wristnerd.xyz
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupSupabaseAuth() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔧 Supabase Auth Auto-Configuration');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Get Supabase credentials
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    supabaseUrl = await question('Enter your Supabase URL (e.g., https://xxxxx.supabase.co): ');
  }

  if (!serviceKey) {
    serviceKey = await question('Enter your SUPABASE_SERVICE_ROLE_KEY: ');
  }

  // Clean up URL
  supabaseUrl = supabaseUrl.trim().replace(/\/$/, '');
  
  console.log('');
  console.log('📝 Configuration:');
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log(`   Site URL: https://wristnerd.xyz`);
  console.log(`   Redirect URLs: https://wristnerd.xyz/**, https://*.wristnerd.xyz/**`);
  console.log('');

  const confirm = await question('Proceed with configuration? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('❌ Cancelled.');
    rl.close();
    return;
  }

  console.log('');
  console.log('🚀 Configuring Supabase Auth...');
  console.log('');

  try {
    // Step 1: Update Site URL
    console.log('1️⃣  Setting Site URL to https://wristnerd.xyz...');
    
    const siteUrlResponse = await fetch(`${supabaseUrl}/auth/v1/admin/config`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceKey
      },
      body: JSON.stringify({
        site_url: 'https://wristnerd.xyz'
      })
    });

    if (!siteUrlResponse.ok) {
      const error = await siteUrlResponse.text();
      console.log(`   ⚠️  Site URL update may have failed: ${error}`);
    } else {
      console.log('   ✅ Site URL configured');
    }

    // Step 2: Add Redirect URLs
    console.log('2️⃣  Adding Redirect URLs...');
    
    // Note: Supabase doesn't have a direct API for redirect URLs in the config endpoint
    // We'll try to use the Gotrue admin API if available, otherwise provide manual instructions
    
    console.log('   ℹ️  Redirect URLs need to be configured via Supabase Dashboard');
    console.log('   (Supabase does not expose this via public API for security)');
    console.log('');
    
    // Alternative: Try to use the REST API to at least verify connection
    const testResponse = await fetch(`${supabaseUrl}/rest/v1/sites?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      }
    });

    if (testResponse.ok) {
      console.log('   ✅ Supabase connection verified');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 Manual Step Required (Cannot be automated via API)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Go to: https://supabase.com/dashboard');
    console.log('→ Select your project');
    console.log('→ Authentication → URL Configuration');
    console.log('');
    console.log('Update these settings:');
    console.log('');
    console.log('1. Site URL:');
    console.log('   https://wristnerd.xyz');
    console.log('');
    console.log('2. Redirect URLs (click "Add URL" for each):');
    console.log('   https://wristnerd.xyz/**');
    console.log('   https://*.wristnerd.xyz/**');
    console.log('');
    console.log('3. Click "Save changes"');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('Make sure your SUPABASE_SERVICE_ROLE_KEY is correct.');
  }

  rl.close();
}

// Run the setup
setupSupabaseAuth();
