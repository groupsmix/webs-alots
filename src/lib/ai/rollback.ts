/**
 * AI Rollback System
 * 
 * Handles rolling back AI actions that failed or had negative outcomes.
 * This is critical for maintaining trust and preventing damage.
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import { logAuditEvent } from '@/lib/audit-log';
import { sendWhatsAppMessage, sendSMS, sendEmail } from '@/lib/integrations/messaging';
import type { AIAction } from './types';

// ========== Rollback Types ==========

export interface RollbackResult {
  success: boolean;
  message: string;
  actions_taken: string[];
  errors: string[];
}

export interface RollbackPlan {
  type: string;
  params: Record<string, any>;
  description: string;
}

// ========== Main Rollback Function ==========

/**
 * Execute rollback for a failed action
 */
export async function executeRollback(action: AIAction): Promise<RollbackResult> {
  logger.info('Executing rollback', {
    context: 'ai-rollback',
    actionId: action.id,
    actionType: action.type,
  });
  
  if (!action.rollback_plan) {
    return {
      success: false,
      message: 'No rollback plan available',
      actions_taken: [],
      errors: ['No rollback plan defined for this action'],
    };
  }
  
  const result: RollbackResult = {
    success: true,
    message: '',
    actions_taken: [],
    errors: [],
  };
  
  try {
    // Execute rollback based on action type
    switch (action.type) {
      case 'send_message':
        await rollbackSendMessage(action, result);
        break;
      
      case 'create_appointment':
        await rollbackCreateAppointment(action, result);
        break;
      
      case 'reschedule_appointment':
        await rollbackRescheduleAppointment(action, result);
        break;
      
      case 'cancel_appointment':
        await rollbackCancelAppointment(action, result);
        break;
      
      case 'adjust_pricing':
        await rollbackAdjustPricing(action, result);
        break;
      
      case 'create_promotion':
        await rollbackCreatePromotion(action, result);
        break;
      
      case 'update_availability':
        await rollbackUpdateAvailability(action, result);
        break;
      
      default:
        result.success = false;
        result.errors.push(`No rollback handler for action type: ${action.type}`);
    }
    
    // Log rollback
    await logRollback(action, result);
    
    // Update action status
    await updateActionStatus(action, result);
    
    result.message = result.success 
      ? 'Rollback completed successfully'
      : 'Rollback completed with errors';
    
  } catch (error) {
    logger.error('Rollback failed', {
      context: 'ai-rollback',
      actionId: action.id,
      error,
    });
    
    result.success = false;
    result.message = 'Rollback failed';
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  
  logger.info('Rollback completed', {
    context: 'ai-rollback',
    actionId: action.id,
    success: result.success,
    actionsTaken: result.actions_taken.length,
    errors: result.errors.length,
  });
  
  return result;
}

// ========== Rollback Handlers ==========

async function rollbackSendMessage(action: AIAction, result: RollbackResult): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  // Can't unsend a message, but we can:
  // 1. Send an apology/correction message
  // 2. Mark the message as recalled in our system
  // 3. Log the incident
  
  const customerId = action.action.params.customer_id;
  const channel = action.action.params.channel;
  
  if (action.rollback_plan?.params.send_apology) {
    // Send apology message
    const apologyMessage = action.rollback_plan.params.apology_message || 
      'We apologize for the previous message. Please disregard it.';
    
    // Send via appropriate channel
    try {
      if (channel === 'whatsapp') {
        const phone = action.action.params.phone || action.action.params.to;
        await sendWhatsAppMessage(phone, apologyMessage, action.business_id);
      } else if (channel === 'sms') {
        const phone = action.action.params.phone || action.action.params.to;
        await sendSMS(phone, apologyMessage, action.business_id);
      } else if (channel === 'email') {
        const email = action.action.params.email || action.action.params.to;
        await sendEmail(email, 'Correction', apologyMessage, apologyMessage, action.business_id);
      }
      result.actions_taken.push(`Sent apology message to customer ${customerId} via ${channel}`);
    } catch (error) {
      result.errors.push(`Failed to send apology: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Mark message as recalled
  await supabase
    .from('ai_message_log')
    .update({ recalled: true, recalled_at: new Date().toISOString() })
    .eq('action_id', action.id);
  
  result.actions_taken.push('Marked message as recalled in system');
}

async function rollbackCreateAppointment(action: AIAction, result: RollbackResult): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  const appointmentId = action.action.params.appointment_id;
  
  if (!appointmentId) {
    result.errors.push('No appointment ID found in action params');
    result.success = false;
    return;
  }
  
  // Cancel the appointment
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'AI action rollback',
    })
    .eq('id', appointmentId);
  
  if (error) {
    result.errors.push(`Failed to cancel appointment: ${error.message}`);
    result.success = false;
    return;
  }
  
  result.actions_taken.push(`Cancelled appointment ${appointmentId}`);
  
  // Notify customer
  if (action.rollback_plan?.params.notify_customer) {
    try {
      // Get customer contact info
      const { data: appointment } = await supabase
        .from('appointments')
        .select('patient_id, patients(phone, email)')
        .eq('id', appointmentId)
        .single();
      
      if (appointment?.patients) {
        const message = 'Your appointment has been cancelled. We apologize for any inconvenience. Please contact us to reschedule.';
        
        if (appointment.patients.phone) {
          await sendWhatsAppMessage(appointment.patients.phone, message, action.business_id);
        } else if (appointment.patients.email) {
          await sendEmail(appointment.patients.email, 'Appointment Cancelled', message, message, action.business_id);
        }
        result.actions_taken.push('Sent cancellation notification to customer');
      }
    } catch (error) {
      result.errors.push(`Failed to notify customer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function rollbackRescheduleAppointment(action: AIAction, result: RollbackResult): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  const appointmentId = action.action.params.appointment_id;
  const originalSlotStart = action.rollback_plan?.params.original_slot_start;
  const originalSlotEnd = action.rollback_plan?.params.original_slot_end;
  
  if (!appointmentId || !originalSlotStart || !originalSlotEnd) {
    result.errors.push('Missing required rollback parameters');
    result.success = false;
    return;
  }
  
  // Restore original time
  const { error } = await supabase
    .from('appointments')
    .update({
      slot_start: originalSlotStart,
      slot_end: originalSlotEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);
  
  if (error) {
    result.errors.push(`Failed to restore appointment time: ${error.message}`);
    result.success = false;
    return;
  }
  
  result.actions_taken.push(`Restored appointment ${appointmentId} to original time`);
  
  // Notify customer
  if (action.rollback_plan?.params.notify_customer) {
    try {
      const { data: appointment } = await supabase
        .from('appointments')
        .select('patient_id, patients(phone, email)')
        .eq('id', appointmentId)
        .single();
      
      if (appointment?.patients) {
        const message = `Your appointment time has been restored to ${originalSlotStart}. We apologize for any confusion.`;
        
        if (appointment.patients.phone) {
          await sendWhatsAppMessage(appointment.patients.phone, message, action.business_id);
        } else if (appointment.patients.email) {
          await sendEmail(appointment.patients.email, 'Appointment Time Restored', message, message, action.business_id);
        }
        result.actions_taken.push('Sent notification to customer about time restoration');
      }
    } catch (error) {
      result.errors.push(`Failed to notify customer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function rollbackCancelAppointment(action: AIAction, result: RollbackResult): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  const appointmentId = action.action.params.appointment_id;
  
  if (!appointmentId) {
    result.errors.push('No appointment ID found in action params');
    result.success = false;
    return;
  }
  
  // Restore appointment
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'confirmed',
      cancelled_at: null,
      cancellation_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);
  
  if (error) {
    result.errors.push(`Failed to restore appointment: ${error.message}`);
    result.success = false;
    return;
  }
  
  result.actions_taken.push(`Restored appointment ${appointmentId}`);
  
  // Notify customer
  if (action.rollback_plan?.params.notify_customer) {
    try {
      const { data: appointment } = await supabase
        .from('appointments')
        .select('patient_id, patients(phone, email)')
        .eq('id', appointmentId)
        .single();
      
      if (appointment?.patients) {
        const message = 'Your appointment has been restored. We apologize for the cancellation. Your appointment is confirmed.';
        
        if (appointment.patients.phone) {
          await sendWhatsAppMessage(appointment.patients.phone, message, action.business_id);
        } else if (appointment.patients.email) {
          await sendEmail(appointment.patients.email, 'Appointment Restored', message, message, action.business_id);
        }
        result.actions_taken.push('Sent notification to customer about appointment restoration');
      }
    } catch (error) {
      result.errors.push(`Failed to notify customer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function rollbackAdjustPricing(action: AIAction, result: RollbackResult): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  const serviceId = action.action.params.service_id;
  const originalPrice = action.rollback_plan?.params.original_price;
  
  if (!serviceId || originalPrice === undefined) {
    result.errors.push('Missing required rollback parameters');
    result.success = false;
    return;
  }
  
  // Restore original price
  const { error } = await supabase
    .from('services')
    .update({
      price: originalPrice,
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceId);
  
  if (error) {
    result.errors.push(`Failed to restore price: ${error.message}`);
    result.success = false;
    return;
  }
  
  result.actions_taken.push(`Restored service ${serviceId} to original price: ${originalPrice}`);
}

async function rollbackCreatePromotion(action: AIAction, result: RollbackResult): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  const promotionId = action.action.params.promotion_id;
  
  if (!promotionId) {
    result.errors.push('No promotion ID found in action params');
    result.success = false;
    return;
  }
  
  // Deactivate promotion
  const { error } = await supabase
    .from('promotions')
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivation_reason: 'AI action rollback',
    })
    .eq('id', promotionId);
  
  if (error) {
    result.errors.push(`Failed to deactivate promotion: ${error.message}`);
    result.success = false;
    return;
  }
  
  result.actions_taken.push(`Deactivated promotion ${promotionId}`);
}

async function rollbackUpdateAvailability(action: AIAction, result: RollbackResult): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  const doctorId = action.action.params.doctor_id;
  const originalAvailability = action.rollback_plan?.params.original_availability;
  
  if (!doctorId || !originalAvailability) {
    result.errors.push('Missing required rollback parameters');
    result.success = false;
    return;
  }
  
  // Restore original availability
  const { error } = await supabase
    .from('time_slots')
    .update({
      is_active: originalAvailability.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('doctor_id', doctorId);
  
  if (error) {
    result.errors.push(`Failed to restore availability: ${error.message}`);
    result.success = false;
    return;
  }
  
  result.actions_taken.push(`Restored availability for doctor ${doctorId}`);
}

// ========== Helper Functions ==========

async function logRollback(action: AIAction, result: RollbackResult): Promise<void> {
  await logAuditEvent({
    action: 'ai.action_rolled_back',
    type: 'ai_action',
    clinicId: action.business_id,
    actor: 'ai_agent',
    description: `Rolled back AI action: ${action.type}`,
    metadata: {
      action_id: action.id,
      action_type: action.type,
      success: result.success,
      actions_taken: result.actions_taken,
      errors: result.errors,
    },
  });
}

async function updateActionStatus(action: AIAction, result: RollbackResult): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  await supabase
    .from('ai_actions')
    .update({
      status: 'rolled_back',
      actual_outcome: {
        ...action.actual_outcome,
        rolled_back: true,
        rollback_success: result.success,
        rollback_actions: result.actions_taken,
        rollback_errors: result.errors,
      },
    })
    .eq('id', action.id);
}

// ========== Automatic Rollback ==========

/**
 * Check if an action should be automatically rolled back
 */
export function shouldAutoRollback(action: AIAction): boolean {
  // Auto-rollback if action failed
  if (action.status === 'failed') return true;
  
  // Auto-rollback if actual outcome is significantly worse than expected
  if (action.actual_outcome && action.expected_outcome) {
    const expectedRevenue = action.expected_outcome.revenue_impact || 0;
    const actualRevenue = action.actual_outcome.revenue_impact || 0;
    
    // If actual revenue is 50% worse than expected, rollback
    if (actualRevenue < expectedRevenue * 0.5) {
      return true;
    }
  }
  
  return false;
}

/**
 * Monitor actions and auto-rollback if needed
 */
export async function monitorAndRollback(businessId: string): Promise<number> {
  const supabase = await createTenantClient(businessId);
  
  // Get recent actions that might need rollback
  const { data: actions } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('business_id', businessId)
    .in('status', ['failed', 'completed'])
    .is('actual_outcome->rolled_back', null)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  if (!actions || actions.length === 0) return 0;
  
  let rolledBackCount = 0;
  
  for (const action of actions as AIAction[]) {
    if (shouldAutoRollback(action)) {
      logger.info('Auto-rolling back action', {
        context: 'ai-rollback',
        actionId: action.id,
        actionType: action.type,
      });
      
      const result = await executeRollback(action);
      
      if (result.success) {
        rolledBackCount++;
      }
    }
  }
  
  return rolledBackCount;
}

// ========== Rollback Statistics ==========

/**
 * Get rollback statistics
 */
export async function getRollbackStats(businessId: string, days: number = 30): Promise<{
  total_rollbacks: number;
  successful_rollbacks: number;
  failed_rollbacks: number;
  by_action_type: Record<string, number>;
  average_rollback_time_minutes: number;
}> {
  const supabase = await createTenantClient(businessId);
  
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: actions } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'rolled_back')
    .gte('created_at', since);
  
  if (!actions || actions.length === 0) {
    return {
      total_rollbacks: 0,
      successful_rollbacks: 0,
      failed_rollbacks: 0,
      by_action_type: {},
      average_rollback_time_minutes: 0,
    };
  }
  
  const successful = actions.filter(a => 
    (a.actual_outcome as any)?.rollback_success === true
  );
  
  const byActionType: Record<string, number> = {};
  for (const action of actions) {
    byActionType[action.type] = (byActionType[action.type] || 0) + 1;
  }
  
  // Calculate average rollback time
  const totalTime = actions.reduce((sum, a) => {
    const createdAt = new Date(a.created_at).getTime();
    const completedAt = a.completed_at ? new Date(a.completed_at).getTime() : Date.now();
    return sum + (completedAt - createdAt);
  }, 0);
  
  const averageTimeMinutes = actions.length > 0
    ? totalTime / actions.length / (60 * 1000)
    : 0;
  
  return {
    total_rollbacks: actions.length,
    successful_rollbacks: successful.length,
    failed_rollbacks: actions.length - successful.length,
    by_action_type: byActionType,
    average_rollback_time_minutes: averageTimeMinutes,
  };
}
