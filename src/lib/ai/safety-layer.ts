/**
 * AI Safety Layer
 * 
 * Ensures AI actions are safe before execution. This is the critical layer
 * that prevents the AI from making costly mistakes.
 * 
 * Safety Checks:
 * 1. Risk assessment
 * 2. Business rule validation
 * 3. Budget constraints
 * 4. Rate limiting
 * 5. Conflict detection
 * 6. Rollback planning
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import type { AIAction, AIRiskLevel, AIConfig } from './types';

// ========== Safety Check Result ==========

export interface SafetyCheckResult {
  safe: boolean;
  risk_level: AIRiskLevel;
  concerns: string[];
  warnings: string[];
  requires_approval: boolean;
  can_auto_execute: boolean;
  estimated_cost: number;
  estimated_impact: {
    revenue: number;
    customers: number;
    reputation: number; // -1 to 1
  };
  rollback_available: boolean;
}

// ========== Safety Rules ==========

interface SafetyRule {
  id: string;
  name: string;
  description: string;
  check: (action: AIAction, context: SafetyContext) => Promise<SafetyViolation | null>;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface SafetyViolation {
  rule_id: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  can_override: boolean;
}

interface SafetyContext {
  business_id: string;
  config: AIConfig;
  recent_actions: AIAction[];
  business_metrics: {
    daily_revenue: number;
    monthly_revenue: number;
    customer_count: number;
    average_rating: number;
  };
}

// ========== Main Safety Check ==========

/**
 * Perform comprehensive safety check on an AI action
 */
export async function performSafetyCheck(
  action: AIAction,
  config: AIConfig
): Promise<SafetyCheckResult> {
  logger.info('Performing safety check', {
    context: 'ai-safety-layer',
    actionId: action.id,
    actionType: action.type,
    riskLevel: action.risk_level,
  });
  
  const context = await buildSafetyContext(action.business_id, config);
  
  // Run all safety rules
  const violations: SafetyViolation[] = [];
  
  for (const rule of SAFETY_RULES) {
    const violation = await rule.check(action, context);
    if (violation) {
      violations.push(violation);
    }
  }
  
  // Categorize violations
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  const highViolations = violations.filter(v => v.severity === 'high');
  const mediumViolations = violations.filter(v => v.severity === 'medium');
  const lowViolations = violations.filter(v => v.severity === 'low');
  
  // Determine if action is safe
  const safe = criticalViolations.length === 0 && highViolations.length === 0;
  
  // Determine if approval is required
  const requiresApproval = 
    action.risk_level === 'high' ||
    criticalViolations.length > 0 ||
    highViolations.length > 0 ||
    !config.autonomy.auto_approve[action.risk_level];
  
  // Determine if can auto-execute
  const canAutoExecute = 
    safe &&
    !requiresApproval &&
    config.autonomy.auto_approve[action.risk_level] &&
    violations.every(v => v.can_override);
  
  // Estimate cost
  const estimatedCost = estimateActionCost(action, context);
  
  // Estimate impact
  const estimatedImpact = estimateActionImpact(action, context);
  
  // Check rollback availability
  const rollbackAvailable = action.rollback_plan !== undefined;
  
  const result: SafetyCheckResult = {
    safe,
    risk_level: action.risk_level,
    concerns: [...criticalViolations, ...highViolations].map(v => v.message),
    warnings: [...mediumViolations, ...lowViolations].map(v => v.message),
    requires_approval: requiresApproval,
    can_auto_execute: canAutoExecute,
    estimated_cost: estimatedCost,
    estimated_impact: estimatedImpact,
    rollback_available: rollbackAvailable,
  };
  
  logger.info('Safety check completed', {
    context: 'ai-safety-layer',
    actionId: action.id,
    safe,
    requiresApproval,
    canAutoExecute,
    violationsCount: violations.length,
  });
  
  return result;
}

// ========== Safety Rules ==========

const SAFETY_RULES: SafetyRule[] = [
  // Rule 1: Budget constraint
  {
    id: 'budget_constraint',
    name: 'Budget Constraint',
    description: 'Ensure action does not exceed budget limits',
    severity: 'critical',
    check: async (action, context) => {
      const cost = estimateActionCost(action, context);
      const maxSpend = context.config.autonomy.max_spend_per_action;
      
      if (cost > maxSpend) {
        return {
          rule_id: 'budget_constraint',
          message: `Action cost (${cost}) exceeds max spend per action (${maxSpend})`,
          severity: 'critical',
          can_override: false,
        };
      }
      
      return null;
    },
  },
  
  // Rule 2: Rate limiting
  {
    id: 'rate_limiting',
    name: 'Rate Limiting',
    description: 'Ensure AI does not take too many actions per day',
    severity: 'high',
    check: async (action, context) => {
      const today = new Date().toISOString().split('T')[0];
      const todayActions = context.recent_actions.filter(a => 
        a.created_at.startsWith(today)
      );
      
      const maxActions = context.config.autonomy.max_actions_per_day;
      
      if (todayActions.length >= maxActions) {
        return {
          rule_id: 'rate_limiting',
          message: `Daily action limit reached (${todayActions.length}/${maxActions})`,
          severity: 'high',
          can_override: true,
        };
      }
      
      return null;
    },
  },
  
  // Rule 3: Pricing change validation
  {
    id: 'pricing_change_validation',
    name: 'Pricing Change Validation',
    description: 'Ensure pricing changes are reasonable',
    severity: 'critical',
    check: async (action, context) => {
      if (action.type !== 'adjust_pricing') return null;
      
      const changePercent = action.action.params.change_percent;
      
      // No more than 30% change
      if (Math.abs(changePercent) > 30) {
        return {
          rule_id: 'pricing_change_validation',
          message: `Pricing change too large (${changePercent}%). Max allowed: ±30%`,
          severity: 'critical',
          can_override: false,
        };
      }
      
      // No price increases during low season
      const season = context.business_metrics.daily_revenue < context.business_metrics.monthly_revenue / 30 * 0.8;
      if (season && changePercent > 0) {
        return {
          rule_id: 'pricing_change_validation',
          message: 'Cannot increase prices during low-demand period',
          severity: 'high',
          can_override: true,
        };
      }
      
      return null;
    },
  },
  
  // Rule 4: Message frequency
  {
    id: 'message_frequency',
    name: 'Message Frequency',
    description: 'Prevent spamming customers',
    severity: 'high',
    check: async (action, context) => {
      if (action.type !== 'send_message') return null;
      
      const customerId = action.action.params.customer_id;
      if (!customerId) return null;
      
      // Check recent messages to this customer
      const recentMessages = context.recent_actions.filter(a => 
        a.type === 'send_message' &&
        a.action.params.customer_id === customerId &&
        new Date(a.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );
      
      if (recentMessages.length >= 2) {
        return {
          rule_id: 'message_frequency',
          message: `Customer already received ${recentMessages.length} messages in last 24h`,
          severity: 'high',
          can_override: false,
        };
      }
      
      return null;
    },
  },
  
  // Rule 5: Appointment conflict
  {
    id: 'appointment_conflict',
    name: 'Appointment Conflict',
    description: 'Prevent double-booking',
    severity: 'critical',
    check: async (action, context) => {
      if (action.type !== 'create_appointment' && action.type !== 'reschedule_appointment') {
        return null;
      }
      
      const doctorId = action.action.params.doctor_id;
      const slotStart = action.action.params.slot_start;
      
      if (!doctorId || !slotStart) return null;
      
      // Check for conflicts in database
      const supabase = await createTenantClient(action.business_id);
      const { data: existingAppointment } = await supabase
        .from('appointments')
        .select('id')
        .eq('clinic_id', action.business_id)
        .eq('doctor_id', doctorId)
        .eq('slot_start', slotStart)
        .neq('status', 'cancelled')
        .single();
      
      const hasConflict = !!existingAppointment;
      
      if (hasConflict) {
        return {
          rule_id: 'appointment_conflict',
          message: 'Time slot already booked',
          severity: 'critical',
          can_override: false,
        };
      }
      
      return null;
    },
  },
  
  // Rule 6: Reputation risk
  {
    id: 'reputation_risk',
    name: 'Reputation Risk',
    description: 'Prevent actions that could harm reputation',
    severity: 'high',
    check: async (action, context) => {
      // Don't send promotional messages to customers with low satisfaction
      if (action.type === 'send_message' && action.action.params.message?.includes('offer')) {
        // Check if customer has complained recently (low ratings or negative feedback)
        const customerId = action.action.params.customer_id;
        if (customerId) {
          const supabase = await createTenantClient(action.business_id);
          
          // Check for recent low ratings (< 3 stars in last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const { data: lowRatings } = await supabase
            .from('reviews')
            .select('id')
            .eq('clinic_id', action.business_id)
            .eq('patient_id', customerId)
            .lt('rating', 3)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .limit(1);
          
          const hasComplaints = (lowRatings && lowRatings.length > 0);
          
          if (hasComplaints) {
            return {
              rule_id: 'reputation_risk',
              message: 'Customer has recent complaints, avoid promotional messages',
              severity: 'medium',
              can_override: true,
            };
          }
        }
      }
      
      // Don't adjust prices if rating is already low
      if (action.type === 'adjust_pricing' && context.business_metrics.average_rating < 3.5) {
        const changePercent = action.action.params.change_percent;
        if (changePercent > 0) {
          return {
            rule_id: 'reputation_risk',
            message: 'Low rating detected, price increases may harm reputation further',
            severity: 'high',
            can_override: true,
          };
        }
      }
      
      return null;
    },
  },
  
  // Rule 7: Confidence threshold
  {
    id: 'confidence_threshold',
    name: 'Confidence Threshold',
    description: 'Ensure AI is confident in its decision',
    severity: 'medium',
    check: async (action, context) => {
      const minConfidence = action.risk_level === 'high' ? 0.9 : 
                           action.risk_level === 'medium' ? 0.8 : 0.7;
      
      if (action.confidence < minConfidence) {
        return {
          rule_id: 'confidence_threshold',
          message: `Low confidence (${action.confidence.toFixed(2)}) for ${action.risk_level}-risk action`,
          severity: 'medium',
          can_override: true,
        };
      }
      
      return null;
    },
  },
  
  // Rule 8: Business hours
  {
    id: 'business_hours',
    name: 'Business Hours',
    description: 'Respect business hours for customer communication',
    severity: 'low',
    check: async (action, context) => {
      if (action.type !== 'send_message') return null;
      
      const now = new Date();
      const hour = now.getHours();
      
      // Don't send messages between 10 PM and 8 AM
      if (hour >= 22 || hour < 8) {
        return {
          rule_id: 'business_hours',
          message: 'Outside business hours (8 AM - 10 PM)',
          severity: 'low',
          can_override: true,
        };
      }
      
      return null;
    },
  },
  
  // Rule 9: Rollback requirement
  {
    id: 'rollback_requirement',
    name: 'Rollback Requirement',
    description: 'High-risk actions must have rollback plan',
    severity: 'high',
    check: async (action, context) => {
      if (action.risk_level === 'high' && !action.rollback_plan) {
        return {
          rule_id: 'rollback_requirement',
          message: 'High-risk action requires rollback plan',
          severity: 'high',
          can_override: false,
        };
      }
      
      return null;
    },
  },
  
  // Rule 10: Negative revenue impact
  {
    id: 'negative_revenue_impact',
    name: 'Negative Revenue Impact',
    description: 'Prevent actions with negative revenue impact',
    severity: 'critical',
    check: async (action, context) => {
      const revenueImpact = action.expected_outcome.revenue_impact || 0;
      
      if (revenueImpact < -1000) { // More than 10 MAD loss
        return {
          rule_id: 'negative_revenue_impact',
          message: `Action expected to lose ${Math.abs(revenueImpact / 100)} ${context.config.business_id}`,
          severity: 'critical',
          can_override: false,
        };
      }
      
      return null;
    },
  },
];

// ========== Helper Functions ==========

async function buildSafetyContext(
  businessId: string,
  config: AIConfig
): Promise<SafetyContext> {
  const supabase = await createTenantClient(businessId);
  
  // Get recent actions (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: recentActions } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });
  
  // Get business metrics
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const { data: appointments } = await supabase
    .from('appointments')
    .select('total_price, slot_start')
    .eq('clinic_id', businessId)
    .eq('status', 'completed')
    .gte('slot_start', thirtyDaysAgo.toISOString());
  
  const monthlyRevenue = appointments?.reduce((sum, a) => sum + (a.total_price || 0), 0) || 0;
  const dailyRevenue = monthlyRevenue / 30;
  
  const { data: customers } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', businessId)
    .eq('role', 'patient');
  
  const { data: reviews } = await supabase
    .from('reviews')
    .select('stars')
    .eq('clinic_id', businessId);
  
  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length
    : 0;
  
  return {
    business_id: businessId,
    config,
    recent_actions: (recentActions || []) as AIAction[],
    business_metrics: {
      daily_revenue: dailyRevenue,
      monthly_revenue: monthlyRevenue,
      customer_count: customers?.length || 0,
      average_rating: averageRating,
    },
  };
}

function estimateActionCost(action: AIAction, context: SafetyContext): number {
  switch (action.type) {
    case 'send_message':
      // WhatsApp: 0.5 MAD, SMS: 0.3 MAD, Email: 0.1 MAD
      const channel = action.action.params.channel;
      return channel === 'whatsapp' ? 50 : channel === 'sms' ? 30 : 10;
    
    case 'create_promotion':
      // Discount amount
      const discount = action.action.params.discount || 0;
      const estimatedBookings = action.action.params.estimated_bookings || 10;
      const avgPrice = context.business_metrics.monthly_revenue / 30 / 5; // Rough estimate
      return discount * estimatedBookings * avgPrice / 100;
    
    case 'adjust_pricing':
      // No direct cost, but potential revenue impact
      return 0;
    
    default:
      return 0;
  }
}

function estimateActionImpact(action: AIAction, context: SafetyContext) {
  // Use expected outcome if provided
  if (action.expected_outcome.revenue_impact) {
    return {
      revenue: action.expected_outcome.revenue_impact,
      customers: estimateCustomersAffected(action),
      reputation: estimateReputationImpact(action, context),
    };
  }
  
  // Otherwise estimate based on action type
  return {
    revenue: 0,
    customers: 0,
    reputation: 0,
  };
}

function estimateCustomersAffected(action: AIAction): number {
  if (action.action.params.customer_id) return 1;
  if (action.action.params.segment) {
    // Rough estimates
    const segmentSizes: Record<string, number> = {
      vip: 10,
      regular: 50,
      at_risk: 20,
      inactive: 30,
      new: 15,
    };
    return segmentSizes[action.action.params.segment] || 0;
  }
  return 0;
}

function estimateReputationImpact(action: AIAction, context: SafetyContext): number {
  // Positive actions
  if (action.type === 'send_review_request') return 0.1;
  if (action.type === 'send_message' && action.action.params.message?.includes('thank')) return 0.05;
  
  // Negative actions
  if (action.type === 'adjust_pricing' && action.action.params.change_percent > 10) return -0.1;
  if (action.type === 'cancel_appointment') return -0.2;
  
  return 0;
}

// ========== Safety Monitoring ==========

/**
 * Log safety check for audit trail
 */
export async function logSafetyCheck(
  action: AIAction,
  result: SafetyCheckResult
): Promise<void> {
  const supabase = await createTenantClient(action.business_id);
  
  await supabase.from('ai_safety_logs').insert({
    action_id: action.id,
    business_id: action.business_id,
    action_type: action.type,
    risk_level: result.risk_level,
    safe: result.safe,
    concerns: result.concerns,
    warnings: result.warnings,
    requires_approval: result.requires_approval,
    can_auto_execute: result.can_auto_execute,
    estimated_cost: result.estimated_cost,
    estimated_impact: result.estimated_impact,
    created_at: new Date().toISOString(),
  });
  
  logger.info('Safety check logged', {
    context: 'ai-safety-layer',
    actionId: action.id,
    safe: result.safe,
  });
}

/**
 * Get safety statistics
 */
export async function getSafetyStats(businessId: string, days: number = 30): Promise<{
  total_checks: number;
  safe_actions: number;
  blocked_actions: number;
  approval_required: number;
  auto_executed: number;
  average_risk_score: number;
}> {
  const supabase = await createTenantClient(businessId);
  
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: logs } = await supabase
    .from('ai_safety_logs')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since);
  
  if (!logs || logs.length === 0) {
    return {
      total_checks: 0,
      safe_actions: 0,
      blocked_actions: 0,
      approval_required: 0,
      auto_executed: 0,
      average_risk_score: 0,
    };
  }
  
  const riskScores: Record<string, number> = { low: 1, medium: 2, high: 3 };
  
  return {
    total_checks: logs.length,
    safe_actions: logs.filter(l => l.safe).length,
    blocked_actions: logs.filter(l => !l.safe).length,
    approval_required: logs.filter(l => l.requires_approval).length,
    auto_executed: logs.filter(l => l.can_auto_execute).length,
    average_risk_score: logs.reduce((sum, l) => sum + riskScores[l.risk_level], 0) / logs.length,
  };
}
