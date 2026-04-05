/**
 * AI Action Engine
 * 
 * Executes AI actions safely and tracks outcomes.
 * This is the "hands" of the AI Revenue Agent.
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import { logAuditEvent } from '@/lib/audit-log';
import { trackActionExecution, trackIntegrationError } from '@/lib/monitoring';
import type { AIAction, AIConfig } from './types';
import { performSafetyCheck, logSafetyCheck } from './safety-layer';
import { createApprovalRequest } from './approval-workflow';
import { executeRollback, shouldAutoRollback } from './rollback';
import { isAIEnabled } from './feature-flags';
import { checkRateLimit } from './rate-limiter';
import { retryWithBackoff } from './retry';
import { trackActionCost, estimateActionCost } from './cost-tracker';
import { checkIdempotency, storeIdempotency, generateIdempotencyKey } from './idempotency';
import { sendWebhook, WEBHOOK_EVENTS } from './webhook';

// ========== Action Execution Result ==========

export interface ActionExecutionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  revenue_impact?: number;
  time_saved?: number;
  customers_affected?: number;
}

// ========== Main Execution Function ==========

/**
 * Execute an AI action with full safety checks
 */
export async function executeAction(
  action: AIAction,
  config: AIConfig,
  options: { dryRun?: boolean } = {}
): Promise<ActionExecutionResult> {
  const startTime = Date.now();
  
  logger.info('Executing AI action', {
    context: 'ai-action-engine',
    actionId: action.id,
    actionType: action.type,
    riskLevel: action.risk_level,
    dryRun: options.dryRun,
  });
  
  try {
    // Step 0: Check idempotency
    const idempotencyKey = generateIdempotencyKey(action.id, action.created_at);
    const idempotencyCheck = await checkIdempotency(action.business_id, idempotencyKey);
    
    if (idempotencyCheck.executed) {
      logger.info('Action already executed (idempotency)', {
        context: 'ai-action-engine',
        actionId: action.id,
      });
      
      return idempotencyCheck.result;
    }
    
    // Step 0.1: Check if AI is enabled
    const aiEnabled = await isAIEnabled(action.business_id);
    if (!aiEnabled) {
      logger.warn('AI disabled for business', {
        context: 'ai-action-engine',
        businessId: action.business_id,
      });
      
      return {
        success: false,
        message: 'AI agent is disabled for this business',
        error: 'AI_DISABLED',
      };
    }
    
    // Step 0.5: Check rate limits
    const rateLimit = await checkRateLimit(
      action.business_id,
      action.type,
      action.action.params.customer_id
    );
    
    if (!rateLimit.allowed) {
      logger.warn('Action blocked by rate limit', {
        context: 'ai-action-engine',
        actionId: action.id,
        reason: rateLimit.reason,
      });
      
      return {
        success: false,
        message: 'Rate limit exceeded',
        error: rateLimit.reason,
      };
    }
    
    // Dry run mode: return early
    if (options.dryRun) {
      const { executeDryRun } = await import('./dry-run');
      return await executeDryRun(action, config);
    }
    // Step 1: Safety check
    const safetyCheck = await performSafetyCheck(action, config);
    await logSafetyCheck(action, safetyCheck);
    
    // Step 2: Block if unsafe
    if (!safetyCheck.safe) {
      logger.warn('Action blocked by safety check', {
        context: 'ai-action-engine',
        actionId: action.id,
        concerns: safetyCheck.concerns,
      });
      
      await updateActionStatus(action, 'failed', {
        success: false,
        error: `Blocked by safety check: ${safetyCheck.concerns.join(', ')}`,
      });
      
      return {
        success: false,
        message: 'Action blocked by safety check',
        error: safetyCheck.concerns.join(', '),
      };
    }
    
    // Step 3: Require approval if needed
    if (safetyCheck.requires_approval) {
      logger.info('Action requires approval', {
        context: 'ai-action-engine',
        actionId: action.id,
      });
      
      await createApprovalRequest(action, safetyCheck);
      
      await updateActionStatus(action, 'pending', {
        success: false,
        error: 'Awaiting approval',
      });
      
      return {
        success: true,
        message: 'Action submitted for approval',
      };
    }
    
    // Step 4: Execute action with retry logic
    logger.info('Executing action', {
      context: 'ai-action-engine',
      actionId: action.id,
      actionType: action.type,
    });
    
    await updateActionStatus(action, 'executing');
    
    const result = await retryWithBackoff(
      () => executeActionByType(action),
      { maxAttempts: 3 }
    );
    
    // Step 4.5: Track costs
    const actionCost = estimateActionCost(action.type, action.action.params);
    if (actionCost > 0) {
      await trackActionCost(action.id, action.business_id, action.type, {
        [action.action.params.channel || 'other']: actionCost,
      });
    }
    
    // Step 5: Update outcome
    await updateActionStatus(action, result.success ? 'completed' : 'failed', {
      success: result.success,
      error: result.error,
      revenue_impact: result.revenue_impact,
      time_saved: result.time_saved,
    });
    
    // Step 6: Check if rollback needed
    if (!result.success || shouldAutoRollback(action)) {
      logger.warn('Action failed or needs rollback', {
        context: 'ai-action-engine',
        actionId: action.id,
      });
      
      await executeRollback(action);
    }
    
    // Step 7: Log audit event
    await logAuditEvent({
      action: `ai.action_${result.success ? 'completed' : 'failed'}`,
      type: 'ai_action',
      clinicId: action.business_id,
      actor: 'ai_agent',
      description: `AI ${result.success ? 'completed' : 'failed'} action: ${action.type}`,
      metadata: {
        action_id: action.id,
        action_type: action.type,
        result,
      },
    });
    
    // Step 8: Send webhooks
    await sendWebhook(
      action.business_id,
      result.success ? WEBHOOK_EVENTS.ACTION_COMPLETED : WEBHOOK_EVENTS.ACTION_FAILED,
      {
        action_id: action.id,
        action_type: action.type,
        result,
      }
    );
    
    // Step 9: Store idempotency record
    await storeIdempotency(action.business_id, idempotencyKey, action.id, result);
    
    logger.info('Action execution completed', {
      context: 'ai-action-engine',
      actionId: action.id,
      success: result.success,
    });
    
    // Track execution metrics
    const duration = Date.now() - startTime;
    trackActionExecution(
      action.id,
      action.type,
      action.business_id,
      result.success,
      duration
    );
    
    return result;
    
  } catch (error) {
    logger.error('Action execution failed', {
      context: 'ai-action-engine',
      actionId: action.id,
      error,
    });
    
    await updateActionStatus(action, 'failed', {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    
    return {
      success: false,
      message: 'Action execution failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Action Type Handlers ==========

async function executeActionByType(action: AIAction): Promise<ActionExecutionResult> {
  switch (action.type) {
    case 'send_message':
      return await executeSendMessage(action);
    
    case 'create_appointment':
      return await executeCreateAppointment(action);
    
    case 'reschedule_appointment':
      return await executeRescheduleAppointment(action);
    
    case 'cancel_appointment':
      return await executeCancelAppointment(action);
    
    case 'adjust_pricing':
      return await executeAdjustPricing(action);
    
    case 'create_promotion':
      return await executeCreatePromotion(action);
    
    case 'send_review_request':
      return await executeSendReviewRequest(action);
    
    case 'create_upsell_offer':
      return await executeCreateUpsellOffer(action);
    
    case 'update_availability':
      return await executeUpdateAvailability(action);
    
    case 'predict_no_show':
      return await executePredictNoShow(action);
    
    case 'identify_opportunity':
      return await executeIdentifyOpportunity(action);
    
    default:
      return {
        success: false,
        message: `Unknown action type: ${action.type}`,
        error: `No handler for action type: ${action.type}`,
      };
  }
}

// ========== Individual Action Handlers ==========

async function executeSendMessage(action: AIAction): Promise<ActionExecutionResult> {
  const { customer_id, segment, message, channel } = action.action.params;
  
  const supabase = await createTenantClient(action.business_id);
  
  // Import messaging integration
  const { sendWhatsAppMessage, sendSMS, sendEmail, formatPhoneNumber } = await import('@/lib/integrations/messaging');
  
  // Get customers to message
  let customers: any[] = [];
  
  if (customer_id) {
    const { data } = await supabase
      .from('users')
      .select('id, name, phone, email')
      .eq('id', customer_id)
      .single();
    
    if (data) customers = [data];
  } else if (segment) {
    // Get customers by segment
    const query = supabase
      .from('users')
      .select('id, name, phone, email, last_visit_at, total_visits, total_spent')
      .eq('clinic_id', action.business_id)
      .eq('role', 'patient');
    
    // Apply segment filters
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    switch (segment) {
      case 'inactive':
        // No visit in last 90 days
        query.lt('last_visit_at', ninetyDaysAgo.toISOString());
        break;
      case 'at_risk':
        // No visit in last 30-90 days
        query.lt('last_visit_at', thirtyDaysAgo.toISOString());
        query.gte('last_visit_at', ninetyDaysAgo.toISOString());
        break;
      case 'vip':
        // High spenders (>5000 MAD total)
        query.gte('total_spent', 5000);
        break;
      case 'regular':
        // 3+ visits
        query.gte('total_visits', 3);
        break;
      case 'new':
        // 1-2 visits
        query.lte('total_visits', 2);
        break;
      default:
        // All patients
        break;
    }
    
    const { data } = await query.limit(100);
    customers = data || [];
  }
  
  if (customers.length === 0) {
    return {
      success: false,
      message: 'No customers found',
      error: 'No customers match the criteria',
    };
  }
  
  // Send messages
  let sent = 0;
  let failed = 0;
  
  for (const customer of customers) {
    try {
      let result;
      
      // Send via appropriate channel
      if (channel === 'whatsapp' && customer.phone) {
        const phone = formatPhoneNumber(customer.phone);
        result = await sendWhatsAppMessage(phone, message, action.business_id);
      } else if (channel === 'sms' && customer.phone) {
        const phone = formatPhoneNumber(customer.phone);
        result = await sendSMS(phone, message, action.business_id);
      } else if (channel === 'email' && customer.email) {
        result = await sendEmail(
          customer.email,
          'Message from your clinic',
          `<p>${message}</p>`,
          message,
          action.business_id
        );
      } else {
        result = { success: false, error: 'No valid contact method' };
      }
      
      // Log message
      await supabase.from('ai_message_log').insert({
        action_id: action.id,
        business_id: action.business_id,
        customer_id: customer.id,
        channel,
        message,
        status: result.success ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
        error_message: result.error,
      });
      
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      logger.error('Failed to send message', {
        context: 'ai-action-engine',
        customerId: customer.id,
        error,
      });
      failed++;
    }
  }
  
  return {
    success: sent > 0,
    message: `Sent ${sent} messages, ${failed} failed`,
    data: { sent, failed },
    customers_affected: sent,
  };
}

async function executeCreateAppointment(action: AIAction): Promise<ActionExecutionResult> {
  const { customer_id, doctor_id, slot_start, slot_end, service_id, notes } = action.action.params;
  
  // Import booking integration
  const { createAppointment } = await import('@/lib/integrations/booking');
  
  const result = await createAppointment(action.business_id, {
    patient_id: customer_id,
    doctor_id,
    service_id,
    slot_start,
    slot_end,
    notes,
    created_by: 'ai_agent',
  });
  
  if (!result.success) {
    return {
      success: false,
      message: 'Failed to create appointment',
      error: result.error,
    };
  }
  
  // Store appointment ID for rollback
  action.action.params.appointment_id = result.appointment_id;
  
  return {
    success: true,
    message: 'Appointment created successfully',
    data: { appointment_id: result.appointment_id },
    customers_affected: 1,
  };
}

async function executeRescheduleAppointment(action: AIAction): Promise<ActionExecutionResult> {
  const { appointment_id, new_slot_start, new_slot_end } = action.action.params;
  
  const supabase = await createTenantClient(action.business_id);
  
  // Get original time for rollback
  const { data: original } = await supabase
    .from('appointments')
    .select('slot_start, slot_end')
    .eq('id', appointment_id)
    .single();
  
  if (original) {
    action.rollback_plan = {
      type: 'restore_appointment_time',
      params: {
        original_slot_start: original.slot_start,
        original_slot_end: original.slot_end,
      },
    };
  }
  
  // Reschedule
  const { error } = await supabase
    .from('appointments')
    .update({
      slot_start: new_slot_start,
      slot_end: new_slot_end,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointment_id);
  
  if (error) {
    return {
      success: false,
      message: 'Failed to reschedule appointment',
      error: error.message,
    };
  }
  
  return {
    success: true,
    message: 'Appointment rescheduled successfully',
    customers_affected: 1,
  };
}

async function executeCancelAppointment(action: AIAction): Promise<ActionExecutionResult> {
  const { appointment_id, reason } = action.action.params;
  
  const supabase = await createTenantClient(action.business_id);
  
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || 'AI automated cancellation',
    })
    .eq('id', appointment_id);
  
  if (error) {
    return {
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message,
    };
  }
  
  return {
    success: true,
    message: 'Appointment cancelled successfully',
    customers_affected: 1,
  };
}

async function executeAdjustPricing(action: AIAction): Promise<ActionExecutionResult> {
  const { service_id, change_percent, reason } = action.action.params;
  
  const supabase = await createTenantClient(action.business_id);
  
  // Import pricing integration
  const { updateServicePrice } = await import('@/lib/integrations/pricing');
  
  // Get current price
  const { data: service } = await supabase
    .from('services')
    .select('price')
    .eq('id', service_id)
    .single();
  
  if (!service) {
    return {
      success: false,
      message: 'Service not found',
      error: 'Service does not exist',
    };
  }
  
  const originalPrice = service.price;
  const newPrice = Math.round(originalPrice * (1 + change_percent / 100));
  
  // Store original price for rollback
  action.rollback_plan = {
    type: 'restore_price',
    params: { original_price: originalPrice, service_id },
  };
  
  // Update price using integration
  const result = await updateServicePrice(action.business_id, service_id, newPrice, reason);
  
  if (!result.success) {
    return {
      success: false,
      message: 'Failed to adjust pricing',
      error: result.error,
    };
  }
  
  return {
    success: true,
    message: `Price adjusted from ${originalPrice} to ${newPrice}`,
    data: { original_price: originalPrice, new_price: newPrice },
  };
}

async function executeCreatePromotion(action: AIAction): Promise<ActionExecutionResult> {
  const { name, description, discount_type, discount_value, valid_from, valid_until, service_ids, code } = action.action.params;
  
  // Import pricing integration
  const { createPromotion } = await import('@/lib/integrations/pricing');
  
  const result = await createPromotion(action.business_id, {
    name,
    description,
    discount_type: discount_type || 'percentage',
    discount_value,
    valid_from: valid_from || new Date().toISOString(),
    valid_until,
    service_ids,
    code,
  });
  
  if (!result.success) {
    return {
      success: false,
      message: 'Failed to create promotion',
      error: result.error,
    };
  }
  
  // Store promotion ID for rollback
  action.action.params.promotion_id = result.promotion_id;
  
  return {
    success: true,
    message: 'Promotion created successfully',
    data: { promotion_id: result.promotion_id },
  };
}

async function executeSendReviewRequest(action: AIAction): Promise<ActionExecutionResult> {
  const { customer_id, appointment_id } = action.action.params;
  
  // Similar to send_message but specifically for review requests
  return await executeSendMessage({
    ...action,
    action: {
      ...action.action,
      params: {
        customer_id,
        message: 'How was your experience? Please leave us a review!',
        channel: 'whatsapp',
      },
    },
  });
}

async function executeCreateUpsellOffer(action: AIAction): Promise<ActionExecutionResult> {
  const { customer_id, service_id, discount } = action.action.params;
  
  // Create a personalized upsell offer
  return await executeSendMessage({
    ...action,
    action: {
      ...action.action,
      params: {
        customer_id,
        message: `Special offer just for you! Get ${discount}% off on our premium service.`,
        channel: 'whatsapp',
      },
    },
  });
}

async function executeUpdateAvailability(action: AIAction): Promise<ActionExecutionResult> {
  const { doctor_id, time_slots, is_active } = action.action.params;
  
  const supabase = await createTenantClient(action.business_id);
  
  const { error } = await supabase
    .from('time_slots')
    .update({
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('doctor_id', doctor_id)
    .in('id', time_slots);
  
  if (error) {
    return {
      success: false,
      message: 'Failed to update availability',
      error: error.message,
    };
  }
  
  return {
    success: true,
    message: 'Availability updated successfully',
  };
}

async function executePredictNoShow(action: AIAction): Promise<ActionExecutionResult> {
  // This is an analysis action, not a mutation
  // Just log the prediction
  return {
    success: true,
    message: 'No-show prediction completed',
    data: action.action.params,
  };
}

async function executeIdentifyOpportunity(action: AIAction): Promise<ActionExecutionResult> {
  // This is an analysis action, not a mutation
  // Just log the opportunity
  return {
    success: true,
    message: 'Opportunity identified',
    data: action.action.params,
  };
}

// ========== Helper Functions ==========

async function updateActionStatus(
  action: AIAction,
  status: AIAction['status'],
  outcome?: Partial<AIAction['actual_outcome']>
): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  };
  
  if (status === 'executing') {
    updates.executed_at = new Date().toISOString();
  }
  
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }
  
  if (outcome) {
    updates.actual_outcome = {
      ...action.actual_outcome,
      ...outcome,
    };
  }
  
  await supabase
    .from('ai_actions')
    .update(updates)
    .eq('id', action.id);
}

/**
 * Execute multiple actions in batch
 */
export async function executeActionBatch(
  actions: AIAction[],
  config: AIConfig
): Promise<ActionExecutionResult[]> {
  logger.info('Executing action batch', {
    context: 'ai-action-engine',
    count: actions.length,
  });
  
  const results: ActionExecutionResult[] = [];
  
  for (const action of actions) {
    const result = await executeAction(action, config);
    results.push(result);
    
    // Small delay between actions to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Get action execution statistics
 */
export async function getActionStats(businessId: string, days: number = 30): Promise<{
  total_actions: number;
  successful: number;
  failed: number;
  pending: number;
  by_type: Record<string, number>;
  by_risk_level: Record<string, number>;
  total_revenue_impact: number;
  total_time_saved: number;
  total_customers_affected: number;
}> {
  const supabase = await createTenantClient(businessId);
  
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: actions } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since);
  
  if (!actions || actions.length === 0) {
    return {
      total_actions: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      by_type: {},
      by_risk_level: {},
      total_revenue_impact: 0,
      total_time_saved: 0,
      total_customers_affected: 0,
    };
  }
  
  const byType: Record<string, number> = {};
  const byRiskLevel: Record<string, number> = {};
  let totalRevenueImpact = 0;
  let totalTimeSaved = 0;
  let totalCustomersAffected = 0;
  
  for (const action of actions) {
    byType[action.type] = (byType[action.type] || 0) + 1;
    byRiskLevel[action.risk_level] = (byRiskLevel[action.risk_level] || 0) + 1;
    
    if (action.actual_outcome) {
      totalRevenueImpact += action.actual_outcome.revenue_impact || 0;
      totalTimeSaved += action.actual_outcome.time_saved || 0;
    }
  }
  
  return {
    total_actions: actions.length,
    successful: actions.filter(a => a.status === 'completed').length,
    failed: actions.filter(a => a.status === 'failed').length,
    pending: actions.filter(a => a.status === 'pending').length,
    by_type: byType,
    by_risk_level: byRiskLevel,
    total_revenue_impact: totalRevenueImpact,
    total_time_saved: totalTimeSaved,
    total_customers_affected: totalCustomersAffected,
  };
}
