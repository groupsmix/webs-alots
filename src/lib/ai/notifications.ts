/**
 * AI Notification System
 * 
 * Sends real-time alerts and daily reports to admins.
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import { getActionStats } from './action-engine';
import { getLearningMetrics } from './learning-engine';
import { calculateHealthScore } from './analytics';

// ========== Notification Types ==========

export interface AINotification {
  id: string;
  business_id: string;
  type: 'action_approval' | 'daily_summary' | 'insight' | 'performance_alert' | 'anomaly';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
}

// ========== Send Notifications ==========

/**
 * Send action approval notification
 */
export async function notifyActionApproval(
  businessId: string,
  action: any
): Promise<void> {
  const supabase = await createTenantClient(businessId);

  await supabase
    .from('ai_notifications')
    .insert({
      business_id: businessId,
      type: 'action_approval',
      priority: action.risk_level === 'high' ? 'urgent' : 'medium',
      title: 'AI Action Requires Approval',
      message: `${formatActionType(action.type)} action needs your approval. ${action.reasoning}`,
      data: {
        action_id: action.id,
        action_type: action.type,
        risk_level: action.risk_level,
        expected_revenue: action.expected_outcome?.revenue_impact,
      },
      read: false,
      created_at: new Date().toISOString(),
    });

  logger.info('Action approval notification sent', {
    context: 'ai-notifications',
    businessId,
    actionId: action.id,
  });
}

/**
 * Send daily summary
 */
export async function sendDailySummary(businessId: string): Promise<void> {
  const stats = await getActionStats(businessId, 1); // Last 24 hours
  const learningMetrics = await getLearningMetrics(businessId, 1);
  const healthScore = await calculateHealthScore(businessId);

  const supabase = await createTenantClient(businessId);

  const message = `
📊 Daily AI Summary

✅ Actions: ${stats.successful} successful, ${stats.failed} failed
💰 Revenue: +${(stats.total_revenue_impact / 100).toFixed(2)} MAD
⏱️ Time Saved: ${Math.round(stats.total_time_saved / 60)} hours
👥 Customers: ${stats.total_customers_affected} affected

📈 Health Score: ${healthScore.overall_score}/100
🎯 Prediction Accuracy: ${(learningMetrics.prediction_accuracy * 100).toFixed(0)}%
  `.trim();

  await supabase
    .from('ai_notifications')
    .insert({
      business_id: businessId,
      type: 'daily_summary',
      priority: 'low',
      title: 'Your Daily AI Report',
      message,
      data: {
        stats,
        learning_metrics: learningMetrics,
        health_score: healthScore,
      },
      read: false,
      created_at: new Date().toISOString(),
    });

  logger.info('Daily summary sent', {
    context: 'ai-notifications',
    businessId,
  });
}

/**
 * Send insight notification
 */
export async function notifyInsight(
  businessId: string,
  insight: any
): Promise<void> {
  const supabase = await createTenantClient(businessId);

  const priority = insight.impact === 'critical' ? 'urgent' : 
                   insight.impact === 'high' ? 'high' : 'medium';

  await supabase
    .from('ai_notifications')
    .insert({
      business_id: businessId,
      type: 'insight',
      priority,
      title: insight.title,
      message: insight.description,
      data: {
        insight_id: insight.id,
        type: insight.type,
        impact: insight.impact,
        revenue_impact: insight.revenue_impact,
        recommendations: insight.recommendations,
      },
      read: false,
      created_at: new Date().toISOString(),
    });

  logger.info('Insight notification sent', {
    context: 'ai-notifications',
    businessId,
    insightId: insight.id,
  });
}

/**
 * Send performance alert
 */
export async function notifyPerformanceAlert(
  businessId: string,
  alert: {
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    data: Record<string, any>;
  }
): Promise<void> {
  const supabase = await createTenantClient(businessId);

  await supabase
    .from('ai_notifications')
    .insert({
      business_id: businessId,
      type: 'performance_alert',
      priority: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data,
      read: false,
      created_at: new Date().toISOString(),
    });

  logger.info('Performance alert sent', {
    context: 'ai-notifications',
    businessId,
  });
}

/**
 * Send anomaly notification
 */
export async function notifyAnomaly(
  businessId: string,
  anomaly: any
): Promise<void> {
  const supabase = await createTenantClient(businessId);

  const priority = anomaly.severity === 'high' ? 'urgent' : 
                   anomaly.severity === 'medium' ? 'high' : 'medium';

  await supabase
    .from('ai_notifications')
    .insert({
      business_id: businessId,
      type: 'anomaly',
      priority,
      title: `Anomaly Detected: ${anomaly.type}`,
      message: anomaly.description,
      data: anomaly.data,
      read: false,
      created_at: new Date().toISOString(),
    });

  logger.info('Anomaly notification sent', {
    context: 'ai-notifications',
    businessId,
  });
}

// ========== Get Notifications ==========

/**
 * Get unread notifications
 */
export async function getUnreadNotifications(
  businessId: string
): Promise<AINotification[]> {
  const supabase = await createTenantClient(businessId);

  const { data, error } = await supabase
    .from('ai_notifications')
    .select('*')
    .eq('business_id', businessId)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.error('Failed to fetch notifications', {
      context: 'ai-notifications',
      error,
    });
    return [];
  }

  return data || [];
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  businessId: string,
  notificationId: string
): Promise<void> {
  const supabase = await createTenantClient(businessId);

  await supabase
    .from('ai_notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('business_id', businessId);
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(
  businessId: string
): Promise<void> {
  const supabase = await createTenantClient(businessId);

  await supabase
    .from('ai_notifications')
    .update({ read: true })
    .eq('business_id', businessId)
    .eq('read', false);
}

// ========== Email Reports ==========

/**
 * Generate weekly report email
 */
export async function generateWeeklyReport(
  businessId: string
): Promise<{
  subject: string;
  html: string;
  text: string;
}> {
  const stats = await getActionStats(businessId, 7);
  const learningMetrics = await getLearningMetrics(businessId, 7);
  const healthScore = await calculateHealthScore(businessId);

  const subject = `Your Weekly AI Report - ${healthScore.overall_score}/100 Health Score`;

  const text = `
Weekly AI Performance Report

ACTIONS TAKEN
✅ Successful: ${stats.successful}
❌ Failed: ${stats.failed}
📊 Success Rate: ${(stats.successful / stats.total_actions * 100).toFixed(0)}%

REVENUE IMPACT
💰 Generated: ${(stats.total_revenue_impact / 100).toFixed(2)} MAD
📈 ROI: ${((stats.total_revenue_impact / 1000) * 100).toFixed(0)}%

TIME SAVED
⏱️ Total: ${Math.round(stats.total_time_saved / 60)} hours
👥 Customers Affected: ${stats.total_customers_affected}

LEARNING & IMPROVEMENT
🎯 Prediction Accuracy: ${(learningMetrics.prediction_accuracy * 100).toFixed(0)}%
📚 Patterns Detected: ${learningMetrics.patterns_detected}
📈 Improvement Rate: ${learningMetrics.improvement_rate.toFixed(1)}%

BUSINESS HEALTH
🏥 Overall Score: ${healthScore.overall_score}/100
💵 Revenue: ${healthScore.category_scores.revenue}/100
😊 Satisfaction: ${healthScore.category_scores.customer_satisfaction}/100
⚡ Efficiency: ${healthScore.category_scores.operational_efficiency}/100
📈 Growth: ${healthScore.category_scores.growth}/100

STRENGTHS
${healthScore.strengths.map(s => `✓ ${s}`).join('\n')}

AREAS FOR IMPROVEMENT
${healthScore.weaknesses.map(w => `• ${w}`).join('\n')}

RECOMMENDATIONS
${healthScore.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .section { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .metric { display: inline-block; margin: 10px 20px; }
    .metric-value { font-size: 32px; font-weight: bold; color: #667eea; }
    .metric-label { font-size: 14px; color: #666; }
    .score { font-size: 48px; font-weight: bold; }
    .list-item { padding: 8px 0; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly AI Report</h1>
      <div class="score">${healthScore.overall_score}/100</div>
      <p>Health Score</p>
    </div>

    <div class="section">
      <h2>📊 Actions Taken</h2>
      <div class="metric">
        <div class="metric-value">${stats.successful}</div>
        <div class="metric-label">Successful</div>
      </div>
      <div class="metric">
        <div class="metric-value">${stats.failed}</div>
        <div class="metric-label">Failed</div>
      </div>
      <div class="metric">
        <div class="metric-value">${(stats.successful / stats.total_actions * 100).toFixed(0)}%</div>
        <div class="metric-label">Success Rate</div>
      </div>
    </div>

    <div class="section">
      <h2>💰 Revenue Impact</h2>
      <div class="metric">
        <div class="metric-value">${(stats.total_revenue_impact / 100).toFixed(2)} MAD</div>
        <div class="metric-label">Generated</div>
      </div>
      <div class="metric">
        <div class="metric-value">${Math.round(stats.total_time_saved / 60)}h</div>
        <div class="metric-label">Time Saved</div>
      </div>
    </div>

    <div class="section">
      <h2>✅ Strengths</h2>
      ${healthScore.strengths.map(s => `<div class="list-item">✓ ${s}</div>`).join('')}
    </div>

    <div class="section">
      <h2>💡 Recommendations</h2>
      ${healthScore.recommendations.map((r, i) => `<div class="list-item">${i + 1}. ${r}</div>`).join('')}
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

// ========== Helper Functions ==========

function formatActionType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
