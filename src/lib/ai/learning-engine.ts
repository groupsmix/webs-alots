/**
 * AI Learning Engine
 * 
 * Tracks action outcomes and improves predictions over time.
 * This is the "brain" that makes the AI smarter with each action.
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import type { AIAction, AILearning } from './types';

// ========== Learning Data Types ==========

interface ActionOutcome {
  action_id: string;
  action_type: string;
  risk_level: string;
  confidence: number;
  success: boolean;
  revenue_impact: number;
  time_saved: number;
  customer_satisfaction?: number;
  context: {
    day_of_week: number;
    hour_of_day: number;
    customer_segment: string;
    business_metrics: Record<string, number>;
  };
}

interface LearningPattern {
  pattern_type: 'success_factor' | 'failure_factor' | 'timing' | 'segmentation';
  description: string;
  confidence: number;
  evidence_count: number;
  impact: number;
  recommendations: string[];
}

// ========== Outcome Tracking ==========

/**
 * Record action outcome for learning
 */
export async function recordActionOutcome(
  businessId: string,
  action: AIAction
): Promise<void> {
  if (!action.actual_outcome) {
    logger.warn('No outcome to record', {
      context: 'learning-engine',
      actionId: action.id,
    });
    return;
  }

  const supabase = await createTenantClient(businessId);

  const outcome: ActionOutcome = {
    action_id: action.id,
    action_type: action.type,
    risk_level: action.risk_level,
    confidence: action.confidence,
    success: action.actual_outcome.success,
    revenue_impact: action.actual_outcome.revenue_impact || 0,
    time_saved: action.actual_outcome.time_saved || 0,
    customer_satisfaction: action.actual_outcome.customer_satisfaction,
    context: {
      day_of_week: new Date(action.created_at).getDay(),
      hour_of_day: new Date(action.created_at).getHours(),
      customer_segment: action.metadata?.customer_segment || 'unknown',
      business_metrics: action.metadata?.business_metrics || {},
    },
  };

  const { error } = await supabase
    .from('ai_learning_outcomes')
    .insert({
      business_id: businessId,
      action_id: action.id,
      action_type: outcome.action_type,
      risk_level: outcome.risk_level,
      confidence: outcome.confidence,
      success: outcome.success,
      revenue_impact: outcome.revenue_impact,
      time_saved: outcome.time_saved,
      customer_satisfaction: outcome.customer_satisfaction,
      context: outcome.context,
      created_at: new Date().toISOString(),
    });

  if (error) {
    logger.error('Failed to record outcome', {
      context: 'learning-engine',
      error,
    });
  }
}

// ========== Pattern Detection ==========

/**
 * Analyze outcomes and detect patterns
 */
export async function detectPatterns(
  businessId: string,
  minSamples: number = 10
): Promise<LearningPattern[]> {
  const supabase = await createTenantClient(businessId);

  // Get recent outcomes (last 90 days)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: outcomes, error } = await supabase
    .from('ai_learning_outcomes')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since);

  if (error || !outcomes || outcomes.length < minSamples) {
    logger.info('Insufficient data for pattern detection', {
      context: 'learning-engine',
      businessId,
      sampleCount: outcomes?.length || 0,
    });
    return [];
  }

  const patterns: LearningPattern[] = [];

  // Pattern 1: Success by action type
  const byType = groupBy(outcomes, 'action_type');
  for (const [type, typeOutcomes] of Object.entries(byType)) {
    const successRate = typeOutcomes.filter(o => o.success).length / typeOutcomes.length;
    const avgRevenue = average(typeOutcomes.map(o => o.revenue_impact));

    if (successRate > 0.8 && typeOutcomes.length >= minSamples) {
      patterns.push({
        pattern_type: 'success_factor',
        description: `${type} actions have ${(successRate * 100).toFixed(0)}% success rate`,
        confidence: Math.min(successRate, typeOutcomes.length / 50),
        evidence_count: typeOutcomes.length,
        impact: avgRevenue,
        recommendations: [
          `Increase frequency of ${type} actions`,
          `Consider auto-approving ${type} actions`,
        ],
      });
    }

    if (successRate < 0.5 && typeOutcomes.length >= minSamples) {
      patterns.push({
        pattern_type: 'failure_factor',
        description: `${type} actions have low success rate (${(successRate * 100).toFixed(0)}%)`,
        confidence: Math.min(1 - successRate, typeOutcomes.length / 50),
        evidence_count: typeOutcomes.length,
        impact: avgRevenue,
        recommendations: [
          `Review ${type} action strategy`,
          `Require approval for ${type} actions`,
          `Adjust ${type} action parameters`,
        ],
      });
    }
  }

  // Pattern 2: Success by day of week
  const byDay = groupBy(outcomes, o => o.context.day_of_week);
  for (const [day, dayOutcomes] of Object.entries(byDay)) {
    const successRate = dayOutcomes.filter(o => o.success).length / dayOutcomes.length;
    const avgRevenue = average(dayOutcomes.map(o => o.revenue_impact));

    if (successRate > 0.8 && dayOutcomes.length >= minSamples) {
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(day)];
      patterns.push({
        pattern_type: 'timing',
        description: `Actions on ${dayName} have ${(successRate * 100).toFixed(0)}% success rate`,
        confidence: Math.min(successRate, dayOutcomes.length / 30),
        evidence_count: dayOutcomes.length,
        impact: avgRevenue,
        recommendations: [
          `Schedule more actions on ${dayName}`,
          `Prioritize high-value actions on ${dayName}`,
        ],
      });
    }
  }

  // Pattern 3: Success by customer segment
  const bySegment = groupBy(outcomes, o => o.context.customer_segment);
  for (const [segment, segmentOutcomes] of Object.entries(bySegment)) {
    const successRate = segmentOutcomes.filter(o => o.success).length / segmentOutcomes.length;
    const avgRevenue = average(segmentOutcomes.map(o => o.revenue_impact));

    if (successRate > 0.8 && segmentOutcomes.length >= minSamples) {
      patterns.push({
        pattern_type: 'segmentation',
        description: `Actions targeting ${segment} customers have ${(successRate * 100).toFixed(0)}% success rate`,
        confidence: Math.min(successRate, segmentOutcomes.length / 30),
        evidence_count: segmentOutcomes.length,
        impact: avgRevenue,
        recommendations: [
          `Focus more actions on ${segment} segment`,
          `Create ${segment}-specific campaigns`,
        ],
      });
    }
  }

  // Pattern 4: Confidence calibration
  const highConfidence = outcomes.filter(o => o.confidence > 0.8);
  if (highConfidence.length >= minSamples) {
    const actualSuccess = highConfidence.filter(o => o.success).length / highConfidence.length;
    if (Math.abs(actualSuccess - 0.8) > 0.2) {
      patterns.push({
        pattern_type: 'success_factor',
        description: `AI confidence scores need calibration (predicted 80%, actual ${(actualSuccess * 100).toFixed(0)}%)`,
        confidence: 0.9,
        evidence_count: highConfidence.length,
        impact: 0,
        recommendations: [
          'Adjust confidence scoring algorithm',
          'Review decision engine parameters',
        ],
      });
    }
  }

  logger.info('Pattern detection completed', {
    context: 'learning-engine',
    businessId,
    patternsFound: patterns.length,
  });

  return patterns;
}

// ========== Learning Application ==========

/**
 * Apply learned patterns to improve future decisions
 */
export async function applyLearnings(
  businessId: string
): Promise<{ applied: number; improvements: string[] }> {
  const patterns = await detectPatterns(businessId);

  if (patterns.length === 0) {
    return { applied: 0, improvements: [] };
  }

  const supabase = await createTenantClient(businessId);
  const improvements: string[] = [];
  let applied = 0;

  // Store learnings
  for (const pattern of patterns) {
    const { error } = await supabase
      .from('ai_learnings')
      .insert({
        business_id: businessId,
        learning: {
          type: pattern.pattern_type,
          description: pattern.description,
          confidence: pattern.confidence,
        },
        evidence: {
          data_points: pattern.evidence_count,
          time_period: '90 days',
          accuracy: pattern.confidence,
        },
        impact: {
          affects: ['decision_engine', 'action_engine'],
          improvement: pattern.impact,
        },
        created_at: new Date().toISOString(),
      });

    if (!error) {
      applied++;
      improvements.push(pattern.description);
    }
  }

  logger.info('Learnings applied', {
    context: 'learning-engine',
    businessId,
    applied,
  });

  return { applied, improvements };
}

// ========== Prediction Improvement ==========

/**
 * Get success probability for an action based on historical data
 */
export async function predictSuccessProbability(
  businessId: string,
  actionType: string,
  context: {
    day_of_week: number;
    hour_of_day: number;
    customer_segment: string;
  }
): Promise<number> {
  const supabase = await createTenantClient(businessId);

  // Get similar historical actions
  const { data: outcomes } = await supabase
    .from('ai_learning_outcomes')
    .select('success')
    .eq('business_id', businessId)
    .eq('action_type', actionType)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  if (!outcomes || outcomes.length < 5) {
    // Not enough data, return neutral probability
    return 0.5;
  }

  // Calculate success rate
  const successRate = outcomes.filter(o => o.success).length / outcomes.length;

  // Adjust based on context (simple heuristic, can be improved with ML)
  let adjustedProbability = successRate;

  // Weekend adjustment (if applicable)
  if (context.day_of_week === 0 || context.day_of_week === 6) {
    adjustedProbability *= 0.9; // Slightly lower success on weekends
  }

  // Off-hours adjustment
  if (context.hour_of_day < 8 || context.hour_of_day > 18) {
    adjustedProbability *= 0.85; // Lower success outside business hours
  }

  return Math.max(0.1, Math.min(0.95, adjustedProbability));
}

// ========== Performance Metrics ==========

/**
 * Get learning system performance metrics
 */
export async function getLearningMetrics(
  businessId: string,
  days: number = 30
): Promise<{
  total_outcomes: number;
  patterns_detected: number;
  learnings_applied: number;
  prediction_accuracy: number;
  improvement_rate: number;
}> {
  const supabase = await createTenantClient(businessId);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Get outcomes
  const { data: outcomes } = await supabase
    .from('ai_learning_outcomes')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since);

  // Get learnings
  const { data: learnings } = await supabase
    .from('ai_learnings')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since);

  // Calculate prediction accuracy
  let predictionAccuracy = 0.5;
  if (outcomes && outcomes.length > 0) {
    const highConfidence = outcomes.filter(o => o.confidence > 0.7);
    if (highConfidence.length > 0) {
      predictionAccuracy = highConfidence.filter(o => o.success).length / highConfidence.length;
    }
  }

  // Calculate improvement rate (compare first half vs second half)
  let improvementRate = 0;
  if (outcomes && outcomes.length >= 20) {
    const midpoint = Math.floor(outcomes.length / 2);
    const firstHalf = outcomes.slice(0, midpoint);
    const secondHalf = outcomes.slice(midpoint);

    const firstSuccess = firstHalf.filter(o => o.success).length / firstHalf.length;
    const secondSuccess = secondHalf.filter(o => o.success).length / secondHalf.length;

    improvementRate = ((secondSuccess - firstSuccess) / firstSuccess) * 100;
  }

  return {
    total_outcomes: outcomes?.length || 0,
    patterns_detected: (await detectPatterns(businessId, 5)).length,
    learnings_applied: learnings?.length || 0,
    prediction_accuracy: predictionAccuracy,
    improvement_rate: improvementRate,
  };
}

// ========== Helper Functions ==========

function groupBy<T>(array: T[], key: string | ((item: T) => any)): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = typeof key === 'function' ? key(item) : (item as any)[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Clean up old learning data (keep last 180 days)
 */
export async function cleanupOldLearningData(businessId: string): Promise<number> {
  const supabase = await createTenantClient(businessId);
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('ai_learning_outcomes')
    .delete()
    .eq('business_id', businessId)
    .lt('created_at', cutoff);

  if (error) {
    logger.error('Failed to cleanup learning data', {
      context: 'learning-engine',
      error,
    });
    return 0;
  }

  logger.info('Cleaned up old learning data', {
    context: 'learning-engine',
    businessId,
    deleted: count || 0,
  });

  return count || 0;
}
