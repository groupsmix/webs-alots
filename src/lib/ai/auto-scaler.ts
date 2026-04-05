/**
 * Auto Scaler
 * 
 * Automatically adjust rate limits based on load
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';

export interface ScalingMetrics {
  current_load: number;
  target_load: number;
  recommended_limit: number;
  action: 'scale_up' | 'scale_down' | 'maintain';
}

/**
 * Calculate optimal rate limits based on current load
 */
export async function calculateOptimalLimits(businessId: string): Promise<ScalingMetrics> {
  const supabase = await createTenantClient(businessId);
  
  // Get current rate limits
  const { data: config } = await supabase
    .from('ai_agent_config')
    .select('rate_limits')
    .eq('business_id', businessId)
    .single();
  
  const currentLimit = config?.rate_limits?.max_actions_per_hour || 100;
  
  // Get recent load (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const { count: recentActions } = await supabase
    .from('ai_actions')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', oneHourAgo.toISOString());
  
  const currentLoad = recentActions || 0;
  const utilizationRate = currentLoad / currentLimit;
  
  let action: ScalingMetrics['action'] = 'maintain';
  let recommendedLimit = currentLimit;
  
  // Scale up if utilization > 80%
  if (utilizationRate > 0.8) {
    action = 'scale_up';
    recommendedLimit = Math.ceil(currentLimit * 1.5);
    
    logger.info('Recommending scale up', {
      context: 'auto-scaler',
      businessId,
      currentLimit,
      currentLoad,
      recommendedLimit,
    });
  }
  // Scale down if utilization < 20% for extended period
  else if (utilizationRate < 0.2) {
    action = 'scale_down';
    recommendedLimit = Math.max(50, Math.ceil(currentLimit * 0.7));
    
    logger.info('Recommending scale down', {
      context: 'auto-scaler',
      businessId,
      currentLimit,
      currentLoad,
      recommendedLimit,
    });
  }
  
  return {
    current_load: currentLoad,
    target_load: currentLimit,
    recommended_limit: recommendedLimit,
    action,
  };
}

/**
 * Apply scaling recommendations
 */
export async function applyScaling(businessId: string, metrics: ScalingMetrics): Promise<void> {
  if (metrics.action === 'maintain') {
    return;
  }
  
  const supabase = await createTenantClient(businessId);
  
  const { data: config } = await supabase
    .from('ai_agent_config')
    .select('rate_limits')
    .eq('business_id', businessId)
    .single();
  
  const newLimits = {
    ...config?.rate_limits,
    max_actions_per_hour: metrics.recommended_limit,
  };
  
  await supabase
    .from('ai_agent_config')
    .update({
      rate_limits: newLimits,
      updated_at: new Date().toISOString(),
    })
    .eq('business_id', businessId);
  
  logger.info('Scaling applied', {
    context: 'auto-scaler',
    businessId,
    action: metrics.action,
    newLimit: metrics.recommended_limit,
  });
}
