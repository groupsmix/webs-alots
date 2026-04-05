/**
 * AI Approval Workflow
 * 
 * Manages the approval process for high-risk AI actions.
 * Allows humans to review and approve/reject actions before execution.
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import { logAuditEvent } from '@/lib/audit-log';
import type { AIAction } from './types';
import type { SafetyCheckResult } from './safety-layer';

// ========== Approval Types ==========

export interface ApprovalRequest {
  id: string;
  action_id: string;
  business_id: string;
  action: AIAction;
  safety_check: SafetyCheckResult;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requested_at: string;
  requested_by: 'ai_agent';
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  expires_at: string;
}

export interface ApprovalDecision {
  approved: boolean;
  reviewed_by: string;
  review_notes?: string;
  modifications?: Partial<AIAction>;
}

// ========== Create Approval Request ==========

/**
 * Create an approval request for a high-risk action
 */
export async function createApprovalRequest(
  action: AIAction,
  safetyCheck: SafetyCheckResult,
  expiresInHours: number = 24
): Promise<ApprovalRequest> {
  logger.info('Creating approval request', {
    context: 'ai-approval-workflow',
    actionId: action.id,
    actionType: action.type,
  });
  
  const supabase = await createTenantClient(action.business_id);
  
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
  
  const request: ApprovalRequest = {
    id: crypto.randomUUID(),
    action_id: action.id,
    business_id: action.business_id,
    action,
    safety_check: safetyCheck,
    status: 'pending',
    requested_at: new Date().toISOString(),
    requested_by: 'ai_agent',
    expires_at: expiresAt,
  };
  
  // Store in database
  const { error } = await supabase.from('ai_approval_requests').insert({
    id: request.id,
    action_id: request.action_id,
    business_id: request.business_id,
    action: request.action,
    safety_check: request.safety_check,
    status: request.status,
    requested_at: request.requested_at,
    requested_by: request.requested_by,
    expires_at: request.expires_at,
  });
  
  if (error) {
    logger.error('Failed to create approval request', {
      context: 'ai-approval-workflow',
      error,
    });
    throw new Error('Failed to create approval request');
  }
  
  // Send notification to admins
  await notifyAdmins(action.business_id, request);
  
  // Log audit event
  await logAuditEvent({
    action: 'ai.approval_requested',
    type: 'ai_action',
    clinicId: action.business_id,
    actor: 'ai_agent',
    description: `AI requested approval for ${action.type} action`,
    metadata: {
      action_id: action.id,
      action_type: action.type,
      risk_level: action.risk_level,
      concerns: safetyCheck.concerns,
    },
  });
  
  logger.info('Approval request created', {
    context: 'ai-approval-workflow',
    requestId: request.id,
    actionId: action.id,
  });
  
  return request;
}

// ========== Process Approval Decision ==========

/**
 * Process an approval decision (approve or reject)
 */
export async function processApprovalDecision(
  requestId: string,
  decision: ApprovalDecision
): Promise<{ success: boolean; message: string }> {
  logger.info('Processing approval decision', {
    context: 'ai-approval-workflow',
    requestId,
    approved: decision.approved,
    reviewedBy: decision.reviewed_by,
  });
  
  const supabase = await createTenantClient(''); // Will get business_id from request
  
  // Get the approval request
  const { data: request, error: fetchError } = await supabase
    .from('ai_approval_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  
  if (fetchError || !request) {
    return { success: false, message: 'Approval request not found' };
  }
  
  // Check if already reviewed
  if (request.status !== 'pending') {
    return { success: false, message: `Request already ${request.status}` };
  }
  
  // Check if expired
  if (new Date(request.expires_at) < new Date()) {
    await supabase
      .from('ai_approval_requests')
      .update({ status: 'expired' })
      .eq('id', requestId);
    
    return { success: false, message: 'Request has expired' };
  }
  
  // Update request status
  const { error: updateError } = await supabase
    .from('ai_approval_requests')
    .update({
      status: decision.approved ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: decision.reviewed_by,
      review_notes: decision.review_notes,
    })
    .eq('id', requestId);
  
  if (updateError) {
    logger.error('Failed to update approval request', {
      context: 'ai-approval-workflow',
      error: updateError,
    });
    return { success: false, message: 'Failed to update request' };
  }
  
  // Update the action
  const action = request.action as AIAction;
  
  if (decision.approved) {
    // Apply modifications if any
    if (decision.modifications) {
      Object.assign(action, decision.modifications);
    }
    
    // Mark action as approved
    await supabase
      .from('ai_actions')
      .update({
        status: 'approved',
        approved_by: decision.reviewed_by,
        approved_at: new Date().toISOString(),
      })
      .eq('id', action.id);
    
    // Log audit event
    await logAuditEvent({
      action: 'ai.action_approved',
      type: 'ai_action',
      clinicId: request.business_id,
      actor: decision.reviewed_by,
      description: `Approved AI action: ${action.type}`,
      metadata: {
        action_id: action.id,
        action_type: action.type,
        review_notes: decision.review_notes,
      },
    });
    
    logger.info('Action approved', {
      context: 'ai-approval-workflow',
      actionId: action.id,
      reviewedBy: decision.reviewed_by,
    });
    
    return { success: true, message: 'Action approved and queued for execution' };
  } else {
    // Mark action as rejected
    await supabase
      .from('ai_actions')
      .update({
        status: 'failed',
        actual_outcome: {
          success: false,
          error: 'Rejected by human reviewer',
        },
      })
      .eq('id', action.id);
    
    // Log audit event
    await logAuditEvent({
      action: 'ai.action_rejected',
      type: 'ai_action',
      clinicId: request.business_id,
      actor: decision.reviewed_by,
      description: `Rejected AI action: ${action.type}`,
      metadata: {
        action_id: action.id,
        action_type: action.type,
        review_notes: decision.review_notes,
      },
    });
    
    logger.info('Action rejected', {
      context: 'ai-approval-workflow',
      actionId: action.id,
      reviewedBy: decision.reviewed_by,
    });
    
    return { success: true, message: 'Action rejected' };
  }
}

// ========== Get Pending Approvals ==========

/**
 * Get all pending approval requests for a business
 */
export async function getPendingApprovals(businessId: string): Promise<ApprovalRequest[]> {
  const supabase = await createTenantClient(businessId);
  
  const { data, error } = await supabase
    .from('ai_approval_requests')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('requested_at', { ascending: false });
  
  if (error) {
    logger.error('Failed to get pending approvals', {
      context: 'ai-approval-workflow',
      error,
    });
    return [];
  }
  
  return (data || []) as ApprovalRequest[];
}

/**
 * Get approval request by ID
 */
export async function getApprovalRequest(requestId: string): Promise<ApprovalRequest | null> {
  const supabase = await createTenantClient(''); // Will get business_id from request
  
  const { data, error } = await supabase
    .from('ai_approval_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as ApprovalRequest;
}

// ========== Expire Old Requests ==========

/**
 * Mark expired approval requests as expired
 */
export async function expireOldRequests(businessId: string): Promise<number> {
  const supabase = await createTenantClient(businessId);
  
  const { data, error } = await supabase
    .from('ai_approval_requests')
    .update({ status: 'expired' })
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');
  
  if (error) {
    logger.error('Failed to expire old requests', {
      context: 'ai-approval-workflow',
      error,
    });
    return 0;
  }
  
  const count = data?.length || 0;
  
  if (count > 0) {
    logger.info('Expired old approval requests', {
      context: 'ai-approval-workflow',
      count,
    });
  }
  
  return count;
}

// ========== Notifications ==========

/**
 * Notify admins about pending approval
 */
async function notifyAdmins(businessId: string, request: ApprovalRequest): Promise<void> {
  const supabase = await createTenantClient(businessId);
  
  // Get all admins
  const { data: admins } = await supabase
    .from('users')
    .select('id, name, email, phone')
    .eq('clinic_id', businessId)
    .eq('role', 'clinic_admin')
    .eq('is_active', true);
  
  if (!admins || admins.length === 0) {
    logger.warn('No admins found to notify', {
      context: 'ai-approval-workflow',
      businessId,
    });
    return;
  }
  
  // Create in-app notifications
  const notifications = admins.map(admin => ({
    user_id: admin.id,
    clinic_id: businessId,
    type: 'ai_approval_required',
    channel: 'in_app',
    title: 'AI Action Requires Approval',
    message: `The AI wants to ${request.action.type}. Review and approve?`,
    data: {
      request_id: request.id,
      action_id: request.action.id,
      action_type: request.action.type,
      risk_level: request.action.risk_level,
      concerns: request.safety_check.concerns,
    },
    status: 'pending',
    created_at: new Date().toISOString(),
  }));
  
  await supabase.from('notifications').insert(notifications);
  
  // Send email/WhatsApp notifications for critical actions
  if (request.action.risk_level === 'high') {
    logger.info('High-risk action requires immediate attention', {
      context: 'ai-approval-workflow',
      requestId: request.id,
      actionType: request.action.type,
    });
    
    // Send notifications to admins
    try {
      const { sendEmail } = await import('@/lib/integrations/messaging');
      
      // Get clinic admins
      const { data: admins } = await supabase
        .from('users')
        .select('email, name')
        .eq('clinic_id', businessId)
        .in('role', ['clinic_admin', 'super_admin'])
        .not('email', 'is', null);
      
      if (admins && admins.length > 0) {
        const subject = `⚠️ High-Risk AI Action Requires Approval`;
        const message = `
          <h2>High-Risk AI Action Pending Approval</h2>
          <p>A high-risk AI action requires your immediate attention:</p>
          <ul>
            <li><strong>Action Type:</strong> ${request.action.type}</li>
            <li><strong>Risk Level:</strong> ${request.action.risk_level}</li>
            <li><strong>Confidence:</strong> ${Math.round(request.action.confidence * 100)}%</li>
            <li><strong>Expected Impact:</strong> ${request.action.expected_outcome?.revenue_impact || 'N/A'} MAD</li>
          </ul>
          <p><strong>Reasoning:</strong> ${request.action.reasoning}</p>
          <p>Please review and approve/reject this action in the AI dashboard.</p>
        `;
        
        // Send to all admins
        for (const admin of admins) {
          await sendEmail(admin.email, subject, message, message.replace(/<[^>]*>/g, ''), businessId);
        }
        
        logger.info('Sent high-risk action notifications to admins', {
          context: 'ai-approval-workflow',
          adminCount: admins.length,
        });
      }
    } catch (error) {
      logger.error('Failed to send high-risk action notifications', {
        context: 'ai-approval-workflow',
        error,
      });
    }
  }
}

// ========== Approval Statistics ==========

/**
 * Get approval statistics
 */
export async function getApprovalStats(businessId: string, days: number = 30): Promise<{
  total_requests: number;
  approved: number;
  rejected: number;
  expired: number;
  pending: number;
  average_review_time_hours: number;
  approval_rate: number;
}> {
  const supabase = await createTenantClient(businessId);
  
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: requests } = await supabase
    .from('ai_approval_requests')
    .select('*')
    .eq('business_id', businessId)
    .gte('requested_at', since);
  
  if (!requests || requests.length === 0) {
    return {
      total_requests: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
      pending: 0,
      average_review_time_hours: 0,
      approval_rate: 0,
    };
  }
  
  const approved = requests.filter(r => r.status === 'approved');
  const rejected = requests.filter(r => r.status === 'rejected');
  const expired = requests.filter(r => r.status === 'expired');
  const pending = requests.filter(r => r.status === 'pending');
  
  // Calculate average review time
  const reviewedRequests = [...approved, ...rejected];
  const totalReviewTime = reviewedRequests.reduce((sum, r) => {
    if (!r.reviewed_at) return sum;
    const requestedAt = new Date(r.requested_at).getTime();
    const reviewedAt = new Date(r.reviewed_at).getTime();
    return sum + (reviewedAt - requestedAt);
  }, 0);
  
  const averageReviewTimeHours = reviewedRequests.length > 0
    ? totalReviewTime / reviewedRequests.length / (60 * 60 * 1000)
    : 0;
  
  const approvalRate = reviewedRequests.length > 0
    ? approved.length / reviewedRequests.length
    : 0;
  
  return {
    total_requests: requests.length,
    approved: approved.length,
    rejected: rejected.length,
    expired: expired.length,
    pending: pending.length,
    average_review_time_hours: averageReviewTimeHours,
    approval_rate: approvalRate,
  };
}

/**
 * Get approval history for an action type
 */
export async function getApprovalHistory(
  businessId: string,
  actionType?: string,
  limit: number = 50
): Promise<ApprovalRequest[]> {
  const supabase = await createTenantClient(businessId);
  
  let query = supabase
    .from('ai_approval_requests')
    .select('*')
    .eq('business_id', businessId)
    .order('requested_at', { ascending: false })
    .limit(limit);
  
  if (actionType) {
    query = query.eq('action->type', actionType);
  }
  
  const { data, error } = await query;
  
  if (error) {
    logger.error('Failed to get approval history', {
      context: 'ai-approval-workflow',
      error,
    });
    return [];
  }
  
  return (data || []) as ApprovalRequest[];
}
