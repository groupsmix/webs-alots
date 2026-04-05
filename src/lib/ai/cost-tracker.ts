/**
 * Cost Tracking for AI Actions
 * 
 * Track actual costs and ROI of AI actions
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';

export interface ActionCost {
  action_id: string;
  business_id: string;
  action_type: string;
  costs: {
    whatsapp?: number;
    sms?: number;
    email?: number;
    llm?: number;
    other?: number;
  };
  total_cost: number;
  revenue_generated?: number;
  roi?: number; // (revenue - cost) / cost
  created_at: string;
}

// Cost per unit (in MAD centimes)
const UNIT_COSTS = {
  whatsapp: 50, // 0.50 MAD per message
  sms: 30, // 0.30 MAD per SMS
  email: 10, // 0.10 MAD per email
  llm_input_token: 0.001, // ~0.00001 MAD per token
  llm_output_token: 0.003, // ~0.00003 MAD per token
};

/**
 * Track cost of an action
 */
export async function trackActionCost(
  actionId: string,
  businessId: string,
  actionType: string,
  costs: ActionCost['costs']
): Promise<void> {
  const totalCost = Object.values(costs).reduce((sum, cost) => sum + (cost || 0), 0);
  
  try {
    const supabase = await createTenantClient(businessId);
    
    await supabase.from('ai_action_costs').insert({
      action_id: actionId,
      business_id: businessId,
      action_type: actionType,
      costs,
      total_cost: totalCost,
      created_at: new Date().toISOString(),
    });
    
    logger.info('Action cost tracked', {
      context: 'cost-tracker',
      actionId,
      actionType,
      totalCost,
    });
  } catch (error) {
    logger.error('Failed to track action cost', {
      context: 'cost-tracker',
      actionId,
      error,
    });
  }
}

/**
 * Update action cost with revenue generated
 */
export async function updateActionRevenue(
  actionId: string,
  businessId: string,
  revenueGenerated: number
): Promise<void> {
  try {
    const supabase = await createTenantClient(businessId);
    
    // Get existing cost
    const { data: costRecord } = await supabase
      .from('ai_action_costs')
      .select('total_cost')
      .eq('action_id', actionId)
      .single();
    
    if (!costRecord) {
      logger.warn('Cost record not found for action', {
        context: 'cost-tracker',
        actionId,
      });
      return;
    }
    
    const roi = costRecord.total_cost > 0
      ? (revenueGenerated - costRecord.total_cost) / costRecord.total_cost
      : 0;
    
    await supabase
      .from('ai_action_costs')
      .update({
        revenue_generated: revenueGenerated,
        roi,
        updated_at: new Date().toISOString(),
      })
      .eq('action_id', actionId);
    
    logger.info('Action revenue updated', {
      context: 'cost-tracker',
      actionId,
      revenueGenerated,
      roi: roi.toFixed(2),
    });
  } catch (error) {
    logger.error('Failed to update action revenue', {
      context: 'cost-tracker',
      actionId,
      error,
    });
  }
}

/**
 * Get cost summary for a business
 */
export async function getCostSummary(
  businessId: string,
  days: number = 30
): Promise<{
  total_cost: number;
  total_revenue: number;
  total_roi: number;
  by_action_type: Record<string, { cost: number; revenue: number; count: number }>;
  by_channel: Record<string, { cost: number; count: number }>;
}> {
  const supabase = await createTenantClient(businessId);
  
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: costs } = await supabase
    .from('ai_action_costs')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since);
  
  if (!costs || costs.length === 0) {
    return {
      total_cost: 0,
      total_revenue: 0,
      total_roi: 0,
      by_action_type: {},
      by_channel: {},
    };
  }
  
  const totalCost = costs.reduce((sum, c) => sum + c.total_cost, 0);
  const totalRevenue = costs.reduce((sum, c) => sum + (c.revenue_generated || 0), 0);
  const totalROI = totalCost > 0 ? (totalRevenue - totalCost) / totalCost : 0;
  
  // Group by action type
  const byActionType: Record<string, { cost: number; revenue: number; count: number }> = {};
  for (const cost of costs) {
    if (!byActionType[cost.action_type]) {
      byActionType[cost.action_type] = { cost: 0, revenue: 0, count: 0 };
    }
    byActionType[cost.action_type].cost += cost.total_cost;
    byActionType[cost.action_type].revenue += cost.revenue_generated || 0;
    byActionType[cost.action_type].count += 1;
  }
  
  // Group by channel
  const byChannel: Record<string, { cost: number; count: number }> = {};
  for (const cost of costs) {
    for (const [channel, amount] of Object.entries(cost.costs)) {
      if (amount && amount > 0) {
        if (!byChannel[channel]) {
          byChannel[channel] = { cost: 0, count: 0 };
        }
        byChannel[channel].cost += amount;
        byChannel[channel].count += 1;
      }
    }
  }
  
  return {
    total_cost: totalCost,
    total_revenue: totalRevenue,
    total_roi: totalROI,
    by_action_type: byActionType,
    by_channel: byChannel,
  };
}

/**
 * Estimate cost of an action before execution
 */
export function estimateActionCost(
  actionType: string,
  params: Record<string, any>
): number {
  switch (actionType) {
    case 'send_message':
      const channel = params.channel;
      const count = params.customer_id ? 1 : (params.segment ? 50 : 1); // Rough estimate
      return (UNIT_COSTS[channel as keyof typeof UNIT_COSTS] || 0) * count;
    
    case 'create_promotion':
      // No direct cost, but potential revenue impact
      return 0;
    
    case 'adjust_pricing':
      // No direct cost
      return 0;
    
    default:
      return 0;
  }
}
