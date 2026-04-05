/**
 * Feature Flags for AI Revenue Agent
 * 
 * Allows gradual rollout and quick disable of AI features
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rollout_percentage: number; // 0-100
  enabled_for_businesses: string[];
  disabled_for_businesses: string[];
}

// Global kill switch
const GLOBAL_AI_ENABLED = process.env.AI_AGENT_ENABLED !== 'false';

/**
 * Check if AI agent is enabled for a business
 */
export async function isAIEnabled(businessId: string): Promise<boolean> {
  // Global kill switch
  if (!GLOBAL_AI_ENABLED) {
    logger.info('AI agent globally disabled', {
      context: 'feature-flags',
      businessId,
    });
    return false;
  }
  
  try {
    const supabase = await createTenantClient(businessId);
    
    // Check business-specific config
    const { data: config } = await supabase
      .from('ai_agent_config')
      .select('enabled')
      .eq('business_id', businessId)
      .single();
    
    if (!config) {
      // Default: disabled for new businesses
      return false;
    }
    
    return config.enabled;
  } catch (error) {
    logger.error('Failed to check AI enabled status', {
      context: 'feature-flags',
      businessId,
      error,
    });
    
    // Fail closed: disable on error
    return false;
  }
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(
  featureName: string,
  businessId: string
): Promise<boolean> {
  // Check if AI is enabled first
  const aiEnabled = await isAIEnabled(businessId);
  if (!aiEnabled) {
    return false;
  }
  
  try {
    const supabase = await createTenantClient(businessId);
    
    // Check feature flag
    const { data: flag } = await supabase
      .from('ai_feature_flags')
      .select('*')
      .eq('name', featureName)
      .single();
    
    if (!flag) {
      // Default: enabled if not specified
      return true;
    }
    
    // Check if explicitly disabled for this business
    if (flag.disabled_for_businesses?.includes(businessId)) {
      return false;
    }
    
    // Check if explicitly enabled for this business
    if (flag.enabled_for_businesses?.includes(businessId)) {
      return true;
    }
    
    // Check global enabled flag
    if (!flag.enabled) {
      return false;
    }
    
    // Check rollout percentage
    if (flag.rollout_percentage < 100) {
      // Use business ID hash for consistent rollout
      const hash = hashString(businessId);
      const bucket = hash % 100;
      return bucket < flag.rollout_percentage;
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to check feature flag', {
      context: 'feature-flags',
      featureName,
      businessId,
      error,
    });
    
    // Fail open for feature flags (AI is already enabled)
    return true;
  }
}

/**
 * Enable AI for a business
 */
export async function enableAI(businessId: string): Promise<void> {
  const supabase = await createTenantClient(businessId);
  
  await supabase
    .from('ai_agent_config')
    .update({ enabled: true, updated_at: new Date().toISOString() })
    .eq('business_id', businessId);
  
  logger.info('AI enabled for business', {
    context: 'feature-flags',
    businessId,
  });
}

/**
 * Disable AI for a business (emergency kill switch)
 */
export async function disableAI(businessId: string, reason?: string): Promise<void> {
  const supabase = await createTenantClient(businessId);
  
  await supabase
    .from('ai_agent_config')
    .update({ 
      enabled: false, 
      updated_at: new Date().toISOString(),
      disabled_reason: reason,
    })
    .eq('business_id', businessId);
  
  logger.warn('AI disabled for business', {
    context: 'feature-flags',
    businessId,
    reason,
  });
}

/**
 * Simple string hash function for consistent rollout
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
