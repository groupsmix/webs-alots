/**
 * Action Scheduler
 * 
 * Schedule actions for optimal execution time
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import type { AIAction } from './types';

export interface ScheduledAction {
  id: string;
  action_id: string;
  business_id: string;
  execute_at: string;
  timezone: string;
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  created_at: string;
}

/**
 * Schedule action for later execution
 */
export async function scheduleAction(
  action: AIAction,
  executeAt: Date,
  timezone: string = 'Africa/Casablanca'
): Promise<string> {
  const supabase = await createTenantClient(action.business_id);
  
  const { data, error } = await supabase
    .from('ai_scheduled_actions')
    .insert({
      action_id: action.id,
      business_id: action.business_id,
      execute_at: executeAt.toISOString(),
      timezone,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  
  if (error) {
    logger.error('Failed to schedule action', {
      context: 'scheduler',
      actionId: action.id,
      executeAt: executeAt.toISOString(),
      error,
    });
    throw error;
  }
  
  logger.info('Action scheduled', {
    context: 'scheduler',
    actionId: action.id,
    scheduleId: data.id,
    executeAt: executeAt.toISOString(),
    timezone,
  });
  
  return data.id;
}

/**
 * Get actions ready for execution
 */
export async function getReadyActions(businessId: string): Promise<AIAction[]> {
  const supabase = await createTenantClient(businessId);
  
  const { data: scheduled } = await supabase
    .from('ai_scheduled_actions')
    .select('action_id')
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .lte('execute_at', new Date().toISOString())
    .order('execute_at', { ascending: true });
  
  if (!scheduled || scheduled.length === 0) {
    return [];
  }
  
  const actionIds = scheduled.map(s => s.action_id);
  
  const { data: actions } = await supabase
    .from('ai_actions')
    .select('*')
    .in('id', actionIds);
  
  return (actions || []) as AIAction[];
}

/**
 * Mark scheduled action as executed
 */
export async function markScheduledExecuted(
  businessId: string,
  actionId: string
): Promise<void> {
  const supabase = await createTenantClient(businessId);
  
  await supabase
    .from('ai_scheduled_actions')
    .update({
      status: 'executed',
      executed_at: new Date().toISOString(),
    })
    .eq('action_id', actionId);
  
  logger.info('Scheduled action marked as executed', {
    context: 'scheduler',
    actionId,
  });
}

/**
 * Cancel scheduled action
 */
export async function cancelScheduledAction(
  businessId: string,
  scheduleId: string
): Promise<void> {
  const supabase = await createTenantClient(businessId);
  
  await supabase
    .from('ai_scheduled_actions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', scheduleId);
  
  logger.info('Scheduled action cancelled', {
    context: 'scheduler',
    scheduleId,
  });
}

/**
 * Get optimal time for sending messages
 */
export function getOptimalMessageTime(timezone: string = 'Africa/Casablanca'): Date {
  const now = new Date();
  const hour = now.getHours();
  
  // If it's between 8 AM and 8 PM, send now
  if (hour >= 8 && hour < 20) {
    return now;
  }
  
  // Otherwise, schedule for 9 AM tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  
  return tomorrow;
}

/**
 * Clean up old scheduled actions
 */
export async function cleanupOldScheduled(businessId: string, daysOld: number = 30): Promise<number> {
  const supabase = await createTenantClient(businessId);
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  
  const { data, error } = await supabase
    .from('ai_scheduled_actions')
    .delete()
    .eq('business_id', businessId)
    .in('status', ['executed', 'cancelled', 'failed'])
    .lt('created_at', cutoff.toISOString())
    .select('id');
  
  if (error) {
    logger.error('Failed to cleanup old scheduled actions', {
      context: 'scheduler',
      businessId,
      error,
    });
    return 0;
  }
  
  const count = data?.length || 0;
  
  if (count > 0) {
    logger.info('Cleaned up old scheduled actions', {
      context: 'scheduler',
      businessId,
      count,
    });
  }
  
  return count;
}
