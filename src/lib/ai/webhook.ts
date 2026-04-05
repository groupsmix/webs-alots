/**
 * Webhook System
 * 
 * Notify external systems of AI actions and events
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import { retryWithBackoff } from './retry';
import crypto from 'crypto';

export interface WebhookEvent {
  event: string;
  business_id: string;
  data: any;
  timestamp: string;
}

export interface WebhookSubscription {
  id: string;
  business_id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  created_at: string;
}

/**
 * Send webhook notification
 */
export async function sendWebhook(
  businessId: string,
  event: string,
  data: any
): Promise<void> {
  try {
    const supabase = await createTenantClient(businessId);
    
    // Get webhook subscriptions for this event
    const { data: subscriptions } = await supabase
      .from('ai_webhook_subscriptions')
      .select('*')
      .eq('business_id', businessId)
      .eq('enabled', true)
      .contains('events', [event]);
    
    if (!subscriptions || subscriptions.length === 0) {
      return;
    }
    
    const webhookEvent: WebhookEvent = {
      event,
      business_id: businessId,
      data,
      timestamp: new Date().toISOString(),
    };
    
    // Send to all subscriptions
    const promises = subscriptions.map(sub =>
      sendWebhookToUrl(sub, webhookEvent)
    );
    
    await Promise.allSettled(promises);
    
    logger.info('Webhooks sent', {
      context: 'webhook',
      businessId,
      event,
      count: subscriptions.length,
    });
  } catch (error) {
    logger.error('Failed to send webhooks', {
      context: 'webhook',
      businessId,
      event,
      error,
    });
  }
}

/**
 * Send webhook to specific URL
 */
async function sendWebhookToUrl(
  subscription: WebhookSubscription,
  event: WebhookEvent
): Promise<void> {
  try {
    // Generate signature
    const signature = generateSignature(event, subscription.secret);
    
    // Send with retry
    await retryWithBackoff(
      async () => {
        const response = await fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event.event,
            'X-Webhook-Timestamp': event.timestamp,
          },
          body: JSON.stringify(event),
        });
        
        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }
      },
      { maxAttempts: 3 }
    );
    
    // Log success
    await logWebhookDelivery(subscription.id, event, 'success');
    
    logger.info('Webhook delivered', {
      context: 'webhook',
      subscriptionId: subscription.id,
      event: event.event,
      url: subscription.url,
    });
  } catch (error) {
    // Log failure
    await logWebhookDelivery(subscription.id, event, 'failed', error);
    
    logger.error('Webhook delivery failed', {
      context: 'webhook',
      subscriptionId: subscription.id,
      event: event.event,
      url: subscription.url,
      error,
    });
  }
}

/**
 * Generate HMAC signature for webhook
 */
function generateSignature(event: WebhookEvent, secret: string): string {
  const payload = JSON.stringify(event);
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Log webhook delivery
 */
async function logWebhookDelivery(
  subscriptionId: string,
  event: WebhookEvent,
  status: 'success' | 'failed',
  error?: any
): Promise<void> {
  try {
    const supabase = await createTenantClient(event.business_id);
    
    await supabase.from('ai_webhook_logs').insert({
      subscription_id: subscriptionId,
      business_id: event.business_id,
      event: event.event,
      status,
      error_message: error instanceof Error ? error.message : undefined,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to log webhook delivery', {
      context: 'webhook',
      subscriptionId,
      error,
    });
  }
}

/**
 * Create webhook subscription
 */
export async function createWebhookSubscription(
  businessId: string,
  url: string,
  events: string[]
): Promise<string> {
  const supabase = await createTenantClient(businessId);
  
  // Generate secret
  const secret = crypto.randomBytes(32).toString('hex');
  
  const { data, error } = await supabase
    .from('ai_webhook_subscriptions')
    .insert({
      business_id: businessId,
      url,
      events,
      secret,
      enabled: true,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  
  if (error) {
    throw error;
  }
  
  logger.info('Webhook subscription created', {
    context: 'webhook',
    businessId,
    subscriptionId: data.id,
    url,
    events,
  });
  
  return data.id;
}

/**
 * Available webhook events
 */
export const WEBHOOK_EVENTS = {
  ACTION_CREATED: 'action.created',
  ACTION_EXECUTED: 'action.executed',
  ACTION_COMPLETED: 'action.completed',
  ACTION_FAILED: 'action.failed',
  ACTION_APPROVED: 'action.approved',
  ACTION_REJECTED: 'action.rejected',
  DECISION_GENERATED: 'decision.generated',
  INSIGHT_CREATED: 'insight.created',
  CAMPAIGN_STARTED: 'campaign.started',
  CAMPAIGN_COMPLETED: 'campaign.completed',
  SAFETY_VIOLATION: 'safety.violation',
  RATE_LIMIT_EXCEEDED: 'rate_limit.exceeded',
} as const;
