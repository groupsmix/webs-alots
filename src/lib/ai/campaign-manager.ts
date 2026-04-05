/**
 * AI Campaign Manager
 * 
 * Creates and manages multi-step marketing campaigns with A/B testing.
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import { buildAIContext } from './context-engine';
import type { AICampaign, CustomerContext } from './types';

// ========== Campaign Types ==========

export interface CampaignStep {
  step_number: number;
  action_type: string;
  delay_hours: number;
  message_template: string;
  channel: 'whatsapp' | 'sms' | 'email';
  conditions?: {
    previous_step_opened?: boolean;
    previous_step_clicked?: boolean;
    no_booking_made?: boolean;
  };
}

export interface CampaignVariant {
  variant_id: string;
  name: string;
  weight: number; // 0-1, sum of all variants should be 1
  steps: CampaignStep[];
}

export interface CampaignPerformance {
  variant_id: string;
  messages_sent: number;
  messages_opened: number;
  messages_clicked: number;
  bookings_made: number;
  revenue_generated: number;
  conversion_rate: number;
  roi: number;
}

// ========== Campaign Creation ==========

/**
 * Create a new campaign
 */
export async function createCampaign(
  businessId: string,
  campaign: Omit<AICampaign, 'id' | 'created_at' | 'status'>
): Promise<{ success: boolean; campaign_id?: string; error?: string }> {
  const supabase = await createTenantClient(businessId);

  // Validate campaign
  const validation = validateCampaign(campaign);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Create campaign
  const { data, error } = await supabase
    .from('ai_campaigns')
    .insert({
      business_id: businessId,
      name: campaign.name,
      type: campaign.type,
      target: campaign.target,
      message: campaign.message,
      schedule: campaign.schedule,
      goals: campaign.goals,
      status: 'draft',
      created_at: new Date().toISOString(),
      created_by: campaign.created_by,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create campaign', {
      context: 'campaign-manager',
      error,
    });
    return { success: false, error: error.message };
  }

  logger.info('Campaign created', {
    context: 'campaign-manager',
    campaignId: data.id,
    campaignName: campaign.name,
  });

  return { success: true, campaign_id: data.id };
}

/**
 * Create A/B test campaign
 */
export async function createABTestCampaign(
  businessId: string,
  campaignName: string,
  variants: CampaignVariant[],
  target: AICampaign['target'],
  schedule: AICampaign['schedule']
): Promise<{ success: boolean; campaign_id?: string; error?: string }> {
  // Validate variants
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (Math.abs(totalWeight - 1) > 0.01) {
    return { success: false, error: 'Variant weights must sum to 1' };
  }

  const supabase = await createTenantClient(businessId);

  // Create campaign
  const { data, error } = await supabase
    .from('ai_campaigns')
    .insert({
      business_id: businessId,
      name: campaignName,
      type: 'ab_test',
      target,
      schedule,
      variants,
      status: 'draft',
      created_at: new Date().toISOString(),
      created_by: 'ai_agent',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  logger.info('A/B test campaign created', {
    context: 'campaign-manager',
    campaignId: data.id,
    variantCount: variants.length,
  });

  return { success: true, campaign_id: data.id };
}

// ========== Campaign Execution ==========

/**
 * Start a campaign
 */
export async function startCampaign(
  businessId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTenantClient(businessId);

  // Get campaign
  const { data: campaign, error: fetchError } = await supabase
    .from('ai_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('business_id', businessId)
    .single();

  if (fetchError || !campaign) {
    return { success: false, error: 'Campaign not found' };
  }

  if (campaign.status !== 'draft' && campaign.status !== 'paused') {
    return { success: false, error: 'Campaign cannot be started' };
  }

  // Get target customers
  const customers = await getTargetCustomers(businessId, campaign.target);

  if (customers.length === 0) {
    return { success: false, error: 'No customers match target criteria' };
  }

  // Update campaign status
  const { error: updateError } = await supabase
    .from('ai_campaigns')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Create campaign enrollments
  for (const customer of customers) {
    await enrollCustomerInCampaign(businessId, campaignId, customer.customer_id);
  }

  logger.info('Campaign started', {
    context: 'campaign-manager',
    campaignId,
    customersEnrolled: customers.length,
  });

  return { success: true };
}

/**
 * Pause a campaign
 */
export async function pauseCampaign(
  businessId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTenantClient(businessId);

  const { error } = await supabase
    .from('ai_campaigns')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('business_id', businessId);

  if (error) {
    return { success: false, error: error.message };
  }

  logger.info('Campaign paused', {
    context: 'campaign-manager',
    campaignId,
  });

  return { success: true };
}

/**
 * Complete a campaign
 */
export async function completeCampaign(
  businessId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTenantClient(businessId);

  // Calculate final results
  const results = await getCampaignResults(businessId, campaignId);

  const { error } = await supabase
    .from('ai_campaigns')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      results,
    })
    .eq('id', campaignId)
    .eq('business_id', businessId);

  if (error) {
    return { success: false, error: error.message };
  }

  logger.info('Campaign completed', {
    context: 'campaign-manager',
    campaignId,
    results,
  });

  return { success: true };
}

// ========== Customer Targeting ==========

/**
 * Get customers matching campaign target criteria
 */
async function getTargetCustomers(
  businessId: string,
  target: AICampaign['target']
): Promise<CustomerContext[]> {
  const supabase = await createTenantClient(businessId);

  // Build query based on criteria
  let query = supabase
    .from('users')
    .select('id')
    .eq('clinic_id', businessId)
    .eq('role', 'patient');

  // Apply segment filter
  if (target.segment) {
    // Get all customers and filter by segment (requires context building)
    const { data: users } = await query;
    if (!users) return [];

    // Build context for all customers at once
    const aiContext = await buildAIContext(businessId);
    const customers = aiContext.customers.filter(c => c.segment === target.segment);

    return customers.slice(0, target.estimated_size || 1000);
  }

  // Apply custom criteria
  if (target.criteria) {
    // Example criteria: { last_visit_days_ago: { gt: 90 } }
    // This would require more complex querying
  }

  const { data: users } = await query.limit(target.estimated_size || 1000);
  if (!users) return [];

  // Build customer contexts
  const aiContext = await buildAIContext(businessId);
  return aiContext.customers.slice(0, target.estimated_size || 1000);
}

/**
 * Enroll customer in campaign
 */
async function enrollCustomerInCampaign(
  businessId: string,
  campaignId: string,
  customerId: string
): Promise<void> {
  const supabase = await createTenantClient(businessId);

  // Determine variant (for A/B tests)
  const { data: campaign } = await supabase
    .from('ai_campaigns')
    .select('variants')
    .eq('id', campaignId)
    .single();

  let variantId = 'default';
  if (campaign?.variants) {
    // Randomly assign variant based on weights
    const random = Math.random();
    let cumulative = 0;
    for (const variant of campaign.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        variantId = variant.variant_id;
        break;
      }
    }
  }

  await supabase
    .from('campaign_enrollments')
    .insert({
      campaign_id: campaignId,
      business_id: businessId,
      customer_id: customerId,
      variant_id: variantId,
      status: 'active',
      current_step: 0,
      enrolled_at: new Date().toISOString(),
    });
}

// ========== Campaign Results ==========

/**
 * Get campaign results
 */
export async function getCampaignResults(
  businessId: string,
  campaignId: string
): Promise<AICampaign['results']> {
  const supabase = await createTenantClient(businessId);

  // Get enrollments
  const { data: enrollments } = await supabase
    .from('campaign_enrollments')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('business_id', businessId);

  if (!enrollments || enrollments.length === 0) {
    return {
      messages_sent: 0,
      messages_delivered: 0,
      responses: 0,
      bookings: 0,
      revenue: 0,
      roi: 0,
    };
  }

  // Get message logs
  const { data: messages } = await supabase
    .from('ai_message_log')
    .select('*')
    .in('customer_id', enrollments.map(e => e.customer_id));

  // Get bookings made during campaign
  const { data: bookings } = await supabase
    .from('appointments')
    .select('*, services(price)')
    .in('patient_id', enrollments.map(e => e.customer_id))
    .gte('created_at', enrollments[0].enrolled_at);

  const messagesSent = messages?.length || 0;
  const messagesDelivered = messages?.filter(m => m.status === 'delivered' || m.status === 'read').length || 0;
  const responses = messages?.filter(m => m.status === 'read').length || 0;
  const bookingCount = bookings?.length || 0;
  const revenue = bookings?.reduce((sum, b) => sum + (b.services?.price || 0), 0) || 0;

  // Calculate ROI (assuming $0.05 per message cost)
  const cost = messagesSent * 5; // 5 cents in cents
  const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

  return {
    messages_sent: messagesSent,
    messages_delivered: messagesDelivered,
    responses,
    bookings: bookingCount,
    revenue,
    roi,
  };
}

/**
 * Get A/B test results by variant
 */
export async function getABTestResults(
  businessId: string,
  campaignId: string
): Promise<CampaignPerformance[]> {
  const supabase = await createTenantClient(businessId);

  // Get enrollments by variant
  const { data: enrollments } = await supabase
    .from('campaign_enrollments')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('business_id', businessId);

  if (!enrollments) return [];

  const variantGroups = enrollments.reduce((groups, enrollment) => {
    const variantId = enrollment.variant_id || 'default';
    if (!groups[variantId]) groups[variantId] = [];
    groups[variantId].push(enrollment);
    return groups;
  }, {} as Record<string, any[]>);

  const results: CampaignPerformance[] = [];

  for (const [variantId, variantEnrollments] of Object.entries(variantGroups)) {
    const customerIds = variantEnrollments.map(e => e.customer_id);

    // Get messages for this variant
    const { data: messages } = await supabase
      .from('ai_message_log')
      .select('*')
      .in('customer_id', customerIds);

    // Get bookings for this variant
    const { data: bookings } = await supabase
      .from('appointments')
      .select('*, services(price)')
      .in('patient_id', customerIds)
      .gte('created_at', variantEnrollments[0].enrolled_at);

    const messagesSent = messages?.length || 0;
    const messagesOpened = messages?.filter(m => m.status === 'read').length || 0;
    const messagesClicked = 0; // Would need click tracking
    const bookingsMade = bookings?.length || 0;
    const revenueGenerated = bookings?.reduce((sum, b) => sum + (b.services?.price || 0), 0) || 0;
    const conversionRate = messagesSent > 0 ? bookingsMade / messagesSent : 0;
    const cost = messagesSent * 5;
    const roi = cost > 0 ? ((revenueGenerated - cost) / cost) * 100 : 0;

    results.push({
      variant_id: variantId,
      messages_sent: messagesSent,
      messages_opened: messagesOpened,
      messages_clicked: messagesClicked,
      bookings_made: bookingsMade,
      revenue_generated: revenueGenerated,
      conversion_rate: conversionRate,
      roi,
    });
  }

  return results;
}

/**
 * Determine winning variant in A/B test
 */
export async function determineWinningVariant(
  businessId: string,
  campaignId: string
): Promise<{ winner: string; confidence: number; reason: string }> {
  const results = await getABTestResults(businessId, campaignId);

  if (results.length < 2) {
    return {
      winner: results[0]?.variant_id || 'default',
      confidence: 0,
      reason: 'Not enough variants to compare',
    };
  }

  // Sort by ROI
  const sorted = results.sort((a, b) => b.roi - a.roi);
  const winner = sorted[0];
  const runnerUp = sorted[1];

  // Calculate statistical significance (simplified)
  const sampleSize = winner.messages_sent + runnerUp.messages_sent;
  const confidence = sampleSize > 100 ? 0.95 : sampleSize > 50 ? 0.85 : 0.7;

  const reason = `Variant ${winner.variant_id} achieved ${winner.roi.toFixed(1)}% ROI vs ${runnerUp.roi.toFixed(1)}% ROI`;

  return {
    winner: winner.variant_id,
    confidence,
    reason,
  };
}

// ========== Campaign Templates ==========

/**
 * Get pre-built campaign templates
 */
export function getCampaignTemplates(): Array<{
  name: string;
  type: AICampaign['type'];
  description: string;
  steps: CampaignStep[];
}> {
  return [
    {
      name: 'Re-engagement Campaign',
      type: 'reengagement',
      description: 'Win back inactive customers with a 3-step campaign',
      steps: [
        {
          step_number: 1,
          action_type: 'send_message',
          delay_hours: 0,
          message_template: 'We miss you! Book now and get 20% off your next visit.',
          channel: 'whatsapp',
        },
        {
          step_number: 2,
          action_type: 'send_message',
          delay_hours: 72,
          message_template: 'Last chance! Your 20% discount expires in 24 hours.',
          channel: 'whatsapp',
          conditions: { no_booking_made: true },
        },
        {
          step_number: 3,
          action_type: 'send_message',
          delay_hours: 168,
          message_template: 'We value your feedback. What can we do better?',
          channel: 'email',
          conditions: { no_booking_made: true },
        },
      ],
    },
    {
      name: 'Upsell Campaign',
      type: 'upsell',
      description: 'Offer premium services to regular customers',
      steps: [
        {
          step_number: 1,
          action_type: 'send_message',
          delay_hours: 0,
          message_template: 'Upgrade to our premium package and save 30%!',
          channel: 'whatsapp',
        },
        {
          step_number: 2,
          action_type: 'send_message',
          delay_hours: 48,
          message_template: 'See what our premium customers are saying...',
          channel: 'whatsapp',
          conditions: { previous_step_opened: true, no_booking_made: true },
        },
      ],
    },
    {
      name: 'Retention Campaign',
      type: 'retention',
      description: 'Keep at-risk customers engaged',
      steps: [
        {
          step_number: 1,
          action_type: 'send_message',
          delay_hours: 0,
          message_template: 'Your health is important to us. Schedule your check-up today.',
          channel: 'whatsapp',
        },
        {
          step_number: 2,
          action_type: 'send_message',
          delay_hours: 96,
          message_template: 'Special offer just for you: Free consultation this week!',
          channel: 'whatsapp',
          conditions: { no_booking_made: true },
        },
      ],
    },
  ];
}

// ========== Validation ==========

function validateCampaign(campaign: Partial<AICampaign>): { valid: boolean; error?: string } {
  if (!campaign.name || campaign.name.length < 3) {
    return { valid: false, error: 'Campaign name must be at least 3 characters' };
  }

  if (!campaign.target || !campaign.target.segment) {
    return { valid: false, error: 'Campaign must have a target segment' };
  }

  if (!campaign.schedule || !campaign.schedule.start_date) {
    return { valid: false, error: 'Campaign must have a start date' };
  }

  return { valid: true };
}
