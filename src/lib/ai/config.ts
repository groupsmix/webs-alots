/**
 * AI Configuration Management
 * 
 * Manages AI settings per business.
 */

import { createTenantClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import type { AIConfig } from './types';

/**
 * Default AI configuration
 */
export const DEFAULT_AI_CONFIG: AIConfig = {
  business_id: '',
  enabled: true,
  autonomy: {
    level: 'copilot',
    auto_approve: {
      low: true,
      medium: false,
      high: false,
    },
    max_actions_per_day: 50,
    max_spend_per_action: 10000, // 100 MAD
  },
  capabilities: {
    customer_reengagement: true,
    intelligent_scheduling: true,
    dynamic_pricing: false,
    upselling: true,
    customer_service: true,
    marketing_campaigns: true,
    analytics: true,
    predictions: true,
  },
  communication: {
    channels: ['whatsapp', 'sms', 'email'],
    tone: 'professional',
    language: 'fr',
  },
  goals: {
    primary: 'revenue',
    target_revenue_increase: 50,
    target_retention_rate: 80,
  },
  notifications: {
    daily_summary: true,
    action_approvals: true,
    insights: true,
    performance_reports: true,
  },
  updated_at: new Date().toISOString(),
};

/**
 * Get AI configuration for a business
 */
export async function getAIConfig(businessId: string): Promise<AIConfig> {
  const supabase = await createTenantClient(businessId);
  
  const { data, error } = await supabase
    .from('clinics')
    .select('ai_config')
    .eq('id', businessId)
    .single();
  
  if (error || !data?.ai_config) {
    logger.info('Using default AI config', {
      context: 'ai-config',
      businessId,
    });
    
    return {
      ...DEFAULT_AI_CONFIG,
      business_id: businessId,
    };
  }
  
  return {
    ...DEFAULT_AI_CONFIG,
    ...data.ai_config,
    business_id: businessId,
  } as AIConfig;
}

/**
 * Update AI configuration
 */
export async function updateAIConfig(
  businessId: string,
  updates: Partial<AIConfig>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTenantClient(businessId);
  
  const current = await getAIConfig(businessId);
  
  const updated = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  
  const { error } = await supabase
    .from('clinics')
    .update({ ai_config: updated })
    .eq('id', businessId);
  
  if (error) {
    logger.error('Failed to update AI config', {
      context: 'ai-config',
      businessId,
      error,
    });
    
    return { success: false, error: error.message };
  }
  
  logger.info('AI config updated', {
    context: 'ai-config',
    businessId,
  });
  
  return { success: true };
}
