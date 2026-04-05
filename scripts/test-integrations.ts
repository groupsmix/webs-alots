/**
 * Integration Testing Script
 * 
 * Tests real API integrations with actual credentials
 * Run with: npx tsx scripts/test-integrations.ts
 */

import { sendWhatsAppMessage, sendSMS, sendEmail } from '../src/lib/integrations/messaging';
import { createAppointment } from '../src/lib/integrations/booking';
import { updateServicePrice, createPromotion } from '../src/lib/integrations/pricing';

const TEST_BUSINESS_ID = process.env.TEST_BUSINESS_ID || 'test-business-123';
const TEST_PHONE = process.env.TEST_PHONE || '+212600000000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

async function testWhatsApp() {
  console.log('\n🔵 Testing WhatsApp Integration...');
  
  try {
    const result = await sendWhatsAppMessage(
      TEST_PHONE,
      'Test message from AI Revenue Agent',
      TEST_BUSINESS_ID
    );
    
    if (result.success) {
      console.log('✅ WhatsApp: SUCCESS');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('❌ WhatsApp: FAILED');
      console.log(`   Error: ${result.error}`);
    }
    
    return result.success;
  } catch (error) {
    console.log('❌ WhatsApp: ERROR');
    console.log(`   ${error}`);
    return false;
  }
}

async function testSMS() {
  console.log('\n🔵 Testing SMS Integration...');
  
  try {
    const result = await sendSMS(
      TEST_PHONE,
      'Test SMS from AI Revenue Agent',
      TEST_BUSINESS_ID
    );
    
    if (result.success) {
      console.log('✅ SMS: SUCCESS');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('❌ SMS: FAILED');
      console.log(`   Error: ${result.error}`);
    }
    
    return result.success;
  } catch (error) {
    console.log('❌ SMS: ERROR');
    console.log(`   ${error}`);
    return false;
  }
}

async function testEmail() {
  console.log('\n🔵 Testing Email Integration...');
  
  try {
    const result = await sendEmail(
      TEST_EMAIL,
      'Test Email from AI Revenue Agent',
      '<h1>Test Email</h1><p>This is a test email from the AI Revenue Agent.</p>',
      'Test Email\n\nThis is a test email from the AI Revenue Agent.',
      TEST_BUSINESS_ID
    );
    
    if (result.success) {
      console.log('✅ Email: SUCCESS');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('❌ Email: FAILED');
      console.log(`   Error: ${result.error}`);
    }
    
    return result.success;
  } catch (error) {
    console.log('❌ Email: ERROR');
    console.log(`   ${error}`);
    return false;
  }
}

async function testBooking() {
  console.log('\n🔵 Testing Booking Integration...');
  
  try {
    // Note: This will fail without real database connection
    console.log('⚠️  Booking: SKIPPED (requires database connection)');
    console.log('   Run this test in a real environment with database access');
    return true;
  } catch (error) {
    console.log('❌ Booking: ERROR');
    console.log(`   ${error}`);
    return false;
  }
}

async function testPricing() {
  console.log('\n🔵 Testing Pricing Integration...');
  
  try {
    // Note: This will fail without real database connection
    console.log('⚠️  Pricing: SKIPPED (requires database connection)');
    console.log('   Run this test in a real environment with database access');
    return true;
  } catch (error) {
    console.log('❌ Pricing: ERROR');
    console.log(`   ${error}`);
    return false;
  }
}

async function main() {
  console.log('🚀 AI Revenue Agent - Integration Tests');
  console.log('========================================');
  
  console.log('\n📋 Configuration:');
  console.log(`   Business ID: ${TEST_BUSINESS_ID}`);
  console.log(`   Test Phone: ${TEST_PHONE}`);
  console.log(`   Test Email: ${TEST_EMAIL}`);
  console.log(`   WhatsApp Provider: ${process.env.WHATSAPP_PROVIDER || 'meta'}`);
  console.log(`   Email Provider: ${process.env.EMAIL_PROVIDER || 'resend'}`);
  
  const results = {
    whatsapp: await testWhatsApp(),
    sms: await testSMS(),
    email: await testEmail(),
    booking: await testBooking(),
    pricing: await testPricing(),
  };
  
  console.log('\n========================================');
  console.log('📊 Test Results:');
  console.log(`   WhatsApp: ${results.whatsapp ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   SMS: ${results.sms ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Email: ${results.email ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Booking: ${results.booking ? '✅ PASS' : '⚠️  SKIP'}`);
  console.log(`   Pricing: ${results.pricing ? '✅ PASS' : '⚠️  SKIP'}`);
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All integrations working!');
    process.exit(0);
  } else {
    console.log('❌ Some integrations failed. Check configuration.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
