/**
 * Rate Limiter for AI Actions
 * 
 * Prevents businesses from exhausting API quotas
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';

export interface RateLimitConfig {
  max_actions_per_hour: number;
  max_actions_per_day: number;
  max_messages_per_customer_per_day: number;
  max_whatsapp_per_hour: number; // WhatsApp has strict limits
  max_sms_per_hour: number;
  max_email_per_hour: number;
}

const DEFAULT_LIMITS: RateLimitConfig = {
  max_actions_per_hour: 100,
  max_actions_per_day: 500,
  max_messages_per_customer_per_day: 3,
  max_whatsapp_per_hour: 50, // Conservative limit
  max_sms_per_hour: 100,
  max_email_per_hour: 200,
};

/**
 * Check if action is within rate limits
 */
export async function checkRateLimit(
  businessId: string,
  actionType: string,
  customerId?: string
): Promise<{
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // seconds
}> {
  try {
    const supabase = await createTenantClient(businessId);
    
    // Get rate limit config
    const { data: config } = await supabase
      .from('ai_agent_config')
      .select('rate_limits')
      .eq('business_id', businessId)
      .single();
    
    const limits: RateLimitConfig = {
      ...DEFAULT_LIMITS,
      ...(config?.rate_limits || {}),
    };
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Check hourly action limit
    const { count: hourlyActions } = await supabase
      .from('ai_actions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', oneHourAgo.toISOString());
    
    if (hourlyActions && hourlyActions >= limits.max_actions_per_hour) {
      return {
        allowed: false,
        reason: `Hourly action limit reached (${hourlyActions}/${limits.max_actions_per_hour})`,
        retryAfter: 3600,
      };
    }
    
    // Check daily action limit
    const { count: dailyActions } = await supabase
      .from('ai_actions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', oneDayAgo.toISOString());
    
    if (dailyActions && dailyActions >= limits.max_actions_per_day) {
      return {
        allowed: false,
        reason: `Daily action limit reached (${dailyActions}/${limits.max_actions_per_day})`,
        retryAfter: 86400,
      };
    }
    
    // Check message-specific limits
    if (actionType === 'send_message') {
      // Check per-customer message limit
      if (customerId) {
        const { count: customerMessages } = await supabase
          .from('ai_actions')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('type', 'send_message')
          .eq('action->params->>customer_id', customerId)
          .gte('created_at', oneDayAgo.toISOString());
        
        if (customerMessages && customerMessages >= limits.max_messages_per_customer_per_day) {
          return {
            allowed: false,
            reason: `Customer message limit reached (${customerMessages}/${limits.max_messages_per_customer_per_day})`,
            retryAfter: 86400,
          };
        }
      }
      
      // Check channel-specific limits
      const { count: whatsappCount } = await supabase
        .from('ai_actions')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('type', 'send_message')
        .eq('action->params->>channel', 'whatsapp')
        .gte('created_at', oneHourAgo.toISOString());
      
      if (whatsappCount && whatsappCount >= limits.max_whatsapp_per_hour) {
        return {
          allowed: false,
          reason: `WhatsApp hourly limit reached (${whatsappCount}/${limits.max_whatsapp_per_hour})`,
          retryAfter: 3600,
        };
      }
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('Rate limit check failed', {
      context: 'rate-limiter',
      businessId,
      actionType,
      error,
    });
    
    // Fail open: allow action if rate limit check fails
    return { allowed: true };
  }
}

/**
 * Record action for rate limiting
 */
export async function recordAction(
  businessId: string,
  actionType: string,
  customerId?: string
): Promise<void> {
  // Action is already recorded in ai_actions table
  // This function is for future use if we need separate rate limit tracking
  logger.debug('Action recorded for rate limiting', {
    context: 'rate-limiter',
    businessId,
    actionType,
    customerId,
  });
}

/**
 * Get current rate limit status
 */
export async function getRateLimitStatus(businessId: string): Promise<{
  hourly_actions: number;
  hourly_limit: number;
  daily_actions: number;
  daily_limit: number;
  whatsapp_hourly: number;
  whatsapp_limit: number;
}> {
  const supabase = await createTenantClient(businessId);
  
  const { data: config } = await supabase
    .from('ai_agent_config')
    .select('rate_limits')
    .eq('business_id', businessId)
    .single();
  
  const limits: RateLimitConfig = {
    ...DEFAULT_LIMITS,
    ...(config?.rate_limits || {}),
  };
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const { count: hourlyActions } = await supabase
    .from('ai_actions')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', oneHourAgo.toISOString());
  
  const { count: dailyActions } = await supabase
    .from('ai_actions')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', oneDayAgo.toISOString());
  
  const { count: whatsappHourly } = await supabase
    .from('ai_actions')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('type', 'send_message')
    .eq('action->params->>channel', 'whatsapp')
    .gte('created_at', oneHourAgo.toISOString());
  
  return {
    hourly_actions: hourlyActions || 0,
    hourly_limit: limits.max_actions_per_hour,
    daily_actions: dailyActions || 0,
    daily_limit: limits.max_actions_per_day,
    whatsapp_hourly: whatsappHourly || 0,
    whatsapp_limit: limits.max_whatsapp_per_hour,
  };
}
