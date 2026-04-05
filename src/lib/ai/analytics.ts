/**
 * AI Advanced Analytics
 * 
 * Predictive models, forecasting, and advanced metrics.
 */

import { logger } from '@/lib/logger';
import { createTenantClient } from '@/lib/supabase-server';
import { buildAIContext } from './context-engine';

// ========== Forecasting ==========

/**
 * Forecast revenue for next N days
 */
export async function forecastRevenue(
  businessId: string,
  days: number = 30
): Promise<{
  forecast: Array<{ date: string; predicted_revenue: number; confidence_interval: [number, number] }>;
  total_predicted: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}> {
  const supabase = await createTenantClient(businessId);

  // Get historical revenue (last 90 days)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: appointments } = await supabase
    .from('appointments')
    .select('created_at, services(price)')
    .eq('clinic_id', businessId)
    .eq('status', 'completed')
    .gte('created_at', since);

  if (!appointments || appointments.length < 10) {
    return {
      forecast: [],
      total_predicted: 0,
      trend: 'stable',
    };
  }

  // Group by date
  const dailyRevenue = appointments.reduce((acc, apt) => {
    const date = apt.created_at.split('T')[0];
    const revenue = apt.services?.price || 0;
    acc[date] = (acc[date] || 0) + revenue;
    return acc;
  }, {} as Record<string, number>);

  // Calculate trend (simple linear regression)
  const dates = Object.keys(dailyRevenue).sort();
  const revenues = dates.map(d => dailyRevenue[d]);
  const avgRevenue = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;

  // Simple moving average for forecast
  const windowSize = 7;
  const recentAvg = revenues.slice(-windowSize).reduce((sum, r) => sum + r, 0) / windowSize;

  // Determine trend
  const trend = recentAvg > avgRevenue * 1.1 ? 'increasing' : 
                recentAvg < avgRevenue * 0.9 ? 'decreasing' : 'stable';

  // Generate forecast
  const forecast = [];
  let totalPredicted = 0;

  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Simple forecast: use recent average with slight trend adjustment
    let predicted = recentAvg;
    if (trend === 'increasing') predicted *= 1.02;
    if (trend === 'decreasing') predicted *= 0.98;

    // Add day-of-week seasonality
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      predicted *= 0.7; // Weekends typically lower
    }

    // Confidence interval (±20%)
    const confidenceInterval: [number, number] = [
      Math.round(predicted * 0.8),
      Math.round(predicted * 1.2),
    ];

    forecast.push({
      date,
      predicted_revenue: Math.round(predicted),
      confidence_interval: confidenceInterval,
    });

    totalPredicted += predicted;
  }

  return {
    forecast,
    total_predicted: Math.round(totalPredicted),
    trend,
  };
}

/**
 * Predict customer churn risk
 */
export async function predictChurnRisk(
  businessId: string,
  customerId: string
): Promise<{
  churn_risk: number; // 0-1
  risk_level: 'low' | 'medium' | 'high';
  factors: Array<{ factor: string; impact: number }>;
  recommendations: string[];
}> {
  const supabase = await createTenantClient(businessId);

  // Get customer data
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('clinic_id', businessId)
    .eq('patient_id', customerId)
    .order('created_at', { ascending: false });

  if (!appointments || appointments.length === 0) {
    return {
      churn_risk: 0.5,
      risk_level: 'medium',
      factors: [],
      recommendations: ['No appointment history available'],
    };
  }

  const factors: Array<{ factor: string; impact: number }> = [];
  let churnScore = 0;

  // Factor 1: Days since last visit
  const lastVisit = new Date(appointments[0].created_at);
  const daysSinceLastVisit = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceLastVisit > 180) {
    churnScore += 0.4;
    factors.push({ factor: 'No visit in 6+ months', impact: 0.4 });
  } else if (daysSinceLastVisit > 90) {
    churnScore += 0.2;
    factors.push({ factor: 'No visit in 3+ months', impact: 0.2 });
  }

  // Factor 2: Cancellation rate
  const cancelled = appointments.filter(a => a.status === 'cancelled').length;
  const cancellationRate = cancelled / appointments.length;
  
  if (cancellationRate > 0.3) {
    churnScore += 0.3;
    factors.push({ factor: 'High cancellation rate', impact: 0.3 });
  }

  // Factor 3: No-show rate
  const noShows = appointments.filter(a => a.status === 'no_show').length;
  const noShowRate = noShows / appointments.length;
  
  if (noShowRate > 0.2) {
    churnScore += 0.2;
    factors.push({ factor: 'Frequent no-shows', impact: 0.2 });
  }

  // Factor 4: Declining frequency
  if (appointments.length >= 3) {
    const recent = appointments.slice(0, 3);
    const older = appointments.slice(3, 6);
    
    if (older.length > 0) {
      const recentFreq = 90 / recent.length; // Days between visits
      const olderFreq = 90 / older.length;
      
      if (recentFreq > olderFreq * 1.5) {
        churnScore += 0.1;
        factors.push({ factor: 'Declining visit frequency', impact: 0.1 });
      }
    }
  }

  const churnRisk = Math.min(1, churnScore);
  const riskLevel = churnRisk > 0.7 ? 'high' : churnRisk > 0.4 ? 'medium' : 'low';

  // Generate recommendations
  const recommendations: string[] = [];
  if (daysSinceLastVisit > 90) {
    recommendations.push('Send re-engagement message with special offer');
  }
  if (cancellationRate > 0.3) {
    recommendations.push('Offer flexible rescheduling options');
  }
  if (noShowRate > 0.2) {
    recommendations.push('Send appointment reminders 24h and 2h before');
  }
  if (churnRisk > 0.7) {
    recommendations.push('Assign to retention campaign immediately');
  }

  return {
    churn_risk: churnRisk,
    risk_level: riskLevel,
    factors,
    recommendations,
  };
}

/**
 * Calculate customer lifetime value (LTV)
 */
export async function calculateLTV(
  businessId: string,
  customerId: string
): Promise<{
  current_ltv: number;
  predicted_ltv: number;
  avg_transaction: number;
  visit_frequency: number; // visits per year
  retention_probability: number;
}> {
  const supabase = await createTenantClient(businessId);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('created_at, services(price)')
    .eq('clinic_id', businessId)
    .eq('patient_id', customerId)
    .eq('status', 'completed');

  if (!appointments || appointments.length === 0) {
    return {
      current_ltv: 0,
      predicted_ltv: 0,
      avg_transaction: 0,
      visit_frequency: 0,
      retention_probability: 0.5,
    };
  }

  // Calculate current LTV
  const currentLTV = appointments.reduce((sum, apt) => sum + (apt.services?.price || 0), 0);

  // Calculate average transaction
  const avgTransaction = currentLTV / appointments.length;

  // Calculate visit frequency (visits per year)
  const firstVisit = new Date(appointments[appointments.length - 1].created_at);
  const lastVisit = new Date(appointments[0].created_at);
  const daysBetween = (lastVisit.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24);
  const visitFrequency = daysBetween > 0 ? (appointments.length / daysBetween) * 365 : appointments.length;

  // Estimate retention probability (based on recency and frequency)
  const daysSinceLastVisit = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
  const retentionProbability = Math.max(0.1, Math.min(0.95, 1 - (daysSinceLastVisit / 365)));

  // Predict future LTV (next 3 years)
  const predictedLTV = currentLTV + (avgTransaction * visitFrequency * 3 * retentionProbability);

  return {
    current_ltv: Math.round(currentLTV),
    predicted_ltv: Math.round(predictedLTV),
    avg_transaction: Math.round(avgTransaction),
    visit_frequency: Math.round(visitFrequency * 10) / 10,
    retention_probability: Math.round(retentionProbability * 100) / 100,
  };
}

/**
 * Identify revenue opportunities
 */
export async function identifyOpportunities(
  businessId: string
): Promise<Array<{
  type: 'pricing' | 'scheduling' | 'upsell' | 'retention' | 'acquisition';
  title: string;
  description: string;
  potential_revenue: number;
  effort: 'low' | 'medium' | 'high';
  priority: number; // 1-10
}>> {
  const context = await buildAIContext(businessId);
  const opportunities = [];

  // Opportunity 1: Empty time slots
  const emptySlots = 0; // Would need to query time_slots table
  if (emptySlots > 10) {
    opportunities.push({
      type: 'scheduling' as const,
      title: 'Fill Empty Time Slots',
      description: `You have ${emptySlots} empty slots this week. Send last-minute promotions to fill them.`,
      potential_revenue: emptySlots * context.business.metrics.average_transaction,
      effort: 'low' as const,
      priority: 8,
    });
  }

  // Opportunity 2: Inactive customers
  const inactiveCustomers = context.customers.filter(c => c.segment === 'inactive').length;
  if (inactiveCustomers > 10) {
    const avgValue = context.business.metrics.average_transaction;
    opportunities.push({
      type: 'retention' as const,
      title: 'Re-engage Inactive Customers',
      description: `${inactiveCustomers} customers haven't visited in 6+ months. Win them back with a special offer.`,
      potential_revenue: inactiveCustomers * avgValue * 0.3, // 30% conversion
      effort: 'low' as const,
      priority: 9,
    });
  }

  // Opportunity 3: At-risk customers
  const atRiskCustomers = context.customers.filter(c => c.segment === 'at_risk').length;
  if (atRiskCustomers > 5) {
    const avgValue = context.business.metrics.average_transaction;
    opportunities.push({
      type: 'retention' as const,
      title: 'Prevent Customer Churn',
      description: `${atRiskCustomers} customers are at risk of churning. Reach out proactively.`,
      potential_revenue: atRiskCustomers * avgValue * 2, // Prevent 2 future visits
      effort: 'medium' as const,
      priority: 10,
    });
  }

  // Opportunity 4: VIP upsell
  const vipCustomers = context.customers.filter(c => c.segment === 'vip').length;
  if (vipCustomers > 5) {
    const avgValue = context.business.metrics.average_transaction;
    opportunities.push({
      type: 'upsell' as const,
      title: 'Upsell Premium Services to VIPs',
      description: `${vipCustomers} VIP customers could be interested in premium packages.`,
      potential_revenue: vipCustomers * avgValue * 1.5,
      effort: 'low' as const,
      priority: 7,
    });
  }

  // Opportunity 5: Low pricing
  if (context.business.metrics.average_transaction < context.market.benchmarks.average_revenue_per_customer * 0.8) {
    const gap = context.market.benchmarks.average_revenue_per_customer - context.business.metrics.average_transaction;
    opportunities.push({
      type: 'pricing' as const,
      title: 'Increase Pricing to Market Rate',
      description: `Your prices are ${((gap / context.market.benchmarks.average_revenue_per_customer) * 100).toFixed(0)}% below market average.`,
      potential_revenue: gap * context.business.metrics.active_customers * 12, // Annual impact
      effort: 'medium' as const,
      priority: 6,
    });
  }

  // Sort by priority
  return opportunities.sort((a, b) => b.priority - a.priority);
}

/**
 * Generate business health score
 */
export async function calculateHealthScore(
  businessId: string
): Promise<{
  overall_score: number; // 0-100
  category_scores: {
    revenue: number;
    customer_satisfaction: number;
    operational_efficiency: number;
    growth: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}> {
  const context = await buildAIContext(businessId);
  const metrics = context.business.metrics;
  const benchmarks = context.market.benchmarks;

  // Calculate category scores
  const revenueScore = Math.min(100, (metrics.monthly_revenue / (benchmarks.average_revenue_per_customer * metrics.active_customers)) * 100);
  const satisfactionScore = (metrics.average_rating / 5) * 100;
  const efficiencyScore = Math.max(0, 100 - (metrics.no_show_rate * 100));
  const growthScore = Math.min(100, (metrics.retention_rate / benchmarks.average_retention_rate) * 100);

  const overallScore = (revenueScore + satisfactionScore + efficiencyScore + growthScore) / 4;

  // Identify strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (satisfactionScore > 80) {
    strengths.push('High customer satisfaction');
  } else if (satisfactionScore < 60) {
    weaknesses.push('Low customer satisfaction');
    recommendations.push('Collect feedback and address common complaints');
  }

  if (efficiencyScore > 80) {
    strengths.push('Low no-show rate');
  } else if (efficiencyScore < 60) {
    weaknesses.push('High no-show rate');
    recommendations.push('Implement automated reminders and confirmation system');
  }

  if (growthScore > 80) {
    strengths.push('Strong customer retention');
  } else if (growthScore < 60) {
    weaknesses.push('Poor customer retention');
    recommendations.push('Launch retention campaigns and loyalty program');
  }

  if (revenueScore > 80) {
    strengths.push('Above-average revenue per customer');
  } else if (revenueScore < 60) {
    weaknesses.push('Below-average revenue per customer');
    recommendations.push('Review pricing strategy and introduce premium services');
  }

  return {
    overall_score: Math.round(overallScore),
    category_scores: {
      revenue: Math.round(revenueScore),
      customer_satisfaction: Math.round(satisfactionScore),
      operational_efficiency: Math.round(efficiencyScore),
      growth: Math.round(growthScore),
    },
    strengths,
    weaknesses,
    recommendations,
  };
}

/**
 * Anomaly detection
 */
export async function detectAnomalies(
  businessId: string
): Promise<Array<{
  type: 'revenue_drop' | 'booking_spike' | 'cancellation_spike' | 'rating_drop';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected_at: string;
  data: Record<string, any>;
}>> {
  const supabase = await createTenantClient(businessId);
  const anomalies = [];

  // Check revenue drop (last 7 days vs previous 7 days)
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const previous7Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentRevenue } = await supabase
    .from('appointments')
    .select('services(price)')
    .eq('clinic_id', businessId)
    .eq('status', 'completed')
    .gte('created_at', last7Days);

  const { data: previousRevenue } = await supabase
    .from('appointments')
    .select('services(price)')
    .eq('clinic_id', businessId)
    .eq('status', 'completed')
    .gte('created_at', previous7Days)
    .lt('created_at', last7Days);

  const recentTotal = recentRevenue?.reduce((sum, a) => sum + (a.services?.price || 0), 0) || 0;
  const previousTotal = previousRevenue?.reduce((sum, a) => sum + (a.services?.price || 0), 0) || 0;

  if (previousTotal > 0 && recentTotal < previousTotal * 0.7) {
    anomalies.push({
      type: 'revenue_drop' as const,
      severity: 'high' as const,
      description: `Revenue dropped ${(((previousTotal - recentTotal) / previousTotal) * 100).toFixed(0)}% in the last 7 days`,
      detected_at: new Date().toISOString(),
      data: { recent: recentTotal, previous: previousTotal },
    });
  }

  // Check cancellation spike
  const { data: recentCancellations } = await supabase
    .from('appointments')
    .select('id')
    .eq('clinic_id', businessId)
    .eq('status', 'cancelled')
    .gte('created_at', last7Days);

  const { data: previousCancellations } = await supabase
    .from('appointments')
    .select('id')
    .eq('clinic_id', businessId)
    .eq('status', 'cancelled')
    .gte('created_at', previous7Days)
    .lt('created_at', last7Days);

  const recentCancelCount = recentCancellations?.length || 0;
  const previousCancelCount = previousCancellations?.length || 0;

  if (previousCancelCount > 0 && recentCancelCount > previousCancelCount * 1.5) {
    anomalies.push({
      type: 'cancellation_spike' as const,
      severity: 'medium' as const,
      description: `Cancellations increased ${(((recentCancelCount - previousCancelCount) / previousCancelCount) * 100).toFixed(0)}% in the last 7 days`,
      detected_at: new Date().toISOString(),
      data: { recent: recentCancelCount, previous: previousCancelCount },
    });
  }

  return anomalies;
}
