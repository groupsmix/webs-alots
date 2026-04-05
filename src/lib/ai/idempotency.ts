/**
 * Idempotency Keys
 * 
 * Prevents duplicate action execution from retries
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';

export interface IdempotencyRecord {
  key: string;
  business_id: string;
  action_id: string;
  result: any;
  created_at: string;
  expires_at: string;
}

/**
 * Check if action was already executed
 */
export async function checkIdempotency(
  businessId: string,
  idempotencyKey: string
): Promise<{ executed: boolean; result?: any }> {
  try {
    const supabase = await createTenantClient(businessId);
    
    const { data: record } = await supabase
      .from('ai_idempotency_keys')
      .select('*')
      .eq('business_id', businessId)
      .eq('key', idempotencyKey)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (record) {
      logger.info('Idempotency key found - returning cached result', {
        context: 'idempotency',
        businessId,
        idempotencyKey,
        actionId: record.action_id,
      });
      
      return {
        executed: true,
        result: record.result,
      };
    }
    
    return { executed: false };
  } catch (error) {
    logger.error('Failed to check idempotency', {
      context: 'idempotency',
      businessId,
      idempotencyKey,
      error,
    });
    
    // Fail open: allow execution if check fails
    return { executed: false };
  }
}

/**
 * Store idempotency record
 */
export async function storeIdempotency(
  businessId: string,
  idempotencyKey: string,
  actionId: string,
  result: any,
  ttlHours: number = 24
): Promise<void> {
  try {
    const supabase = await createTenantClient(businessId);
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);
    
    await supabase.from('ai_idempotency_keys').insert({
      key: idempotencyKey,
      business_id: businessId,
      action_id: actionId,
      result,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    });
    
    logger.info('Idempotency key stored', {
      context: 'idempotency',
      businessId,
      idempotencyKey,
      actionId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to store idempotency key', {
      context: 'idempotency',
      businessId,
      idempotencyKey,
      error,
    });
  }
}

/**
 * Generate idempotency key for action
 */
export function generateIdempotencyKey(
  actionId: string,
  createdAt: string
): string {
  return `${actionId}-${createdAt}`;
}

/**
 * Clean up expired idempotency keys
 */
export async function cleanupExpiredKeys(businessId: string): Promise<number> {
  try {
    const supabase = await createTenantClient(businessId);
    
    const { data, error } = await supabase
      .from('ai_idempotency_keys')
      .delete()
      .eq('business_id', businessId)
      .lt('expires_at', new Date().toISOString())
      .select('key');
    
    if (error) throw error;
    
    const count = data?.length || 0;
    
    if (count > 0) {
      logger.info('Cleaned up expired idempotency keys', {
        context: 'idempotency',
        businessId,
        count,
      });
    }
    
    return count;
  } catch (error) {
    logger.error('Failed to cleanup idempotency keys', {
      context: 'idempotency',
      businessId,
      error,
    });
    
    return 0;
  }
}
