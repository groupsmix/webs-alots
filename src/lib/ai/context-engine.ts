/**
 * AI Context Engine
 * 
 * Aggregates all relevant business data into a structured context
 * that the AI can use to make intelligent decisions.
 */

import { createTenantClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import type { AIContext, BusinessContext, CustomerContext, MarketContext } from './types';

/**
 * Build complete AI context for a business
 */
export async function buildAIContext(businessId: string): Promise<AIContext> {
  logger.info('Building AI context', { context: 'ai-context-engine', businessId });
  
  const [business, customers, market] = await Promise.all([
    buildBusinessContext(businessId),
    buildCustomerContext(businessId),
    buildMarketContext(businessId),
  ]);
  
  return {
    business,
    customers,
    market,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build business context
 */
async function buildBusinessContext(businessId: string): Promise<BusinessContext> {
  const supabase = await createTenantClient(businessId);
  
  // Get business details
  const { data: business } = await supabase
    .from('clinics')
    .select('name, type, config')
    .eq('id', businessId)
    .single();
  
  if (!business) {
    throw new Error('Business not found');
  }
  
  const config = business.config as any || {};
  
  // Get business metrics
  const metrics = await calculateBusinessMetrics(businessId);
  
  // Get services
  const { data: services } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, category')
    .eq('clinic_id', businessId)
    .eq('is_active', true);
  
  // Get staff
  const { data: staff } = await supabase
    .from('users')
    .select('id, name, role, metadata')
    .eq('clinic_id', businessId)
    .in('role', ['doctor', 'receptionist'])
    .eq('is_active', true);
  
  return {
    business_id: businessId,
    business_name: business.name,
    business_type: business.type,
    timezone: config.timezone || 'Africa/Casablanca',
    currency: config.currency || 'MAD',
    metrics,
    working_hours: config.workingHours || {},
    services: (services || []).map(s => ({
      id: s.id,
      name: s.name,
      price: s.price,
      duration: s.duration_minutes,
      category: s.category || 'general',
    })),
    staff: (staff || []).map(s => ({
      id: s.id,
      name: s.name,
      role: s.role,
      specialties: (s.metadata as any)?.specialties || [],
    })),
  };
}

/**
 * Calculate business metrics
 */
async function calculateBusinessMetrics(businessId: string) {
  const supabase = await createTenantClient(businessId);
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  // Get appointments data
  const { data: appointments } = await supabase
    .from('appointments')
    .select('status, slot_start, total_price, patient_id')
    .eq('clinic_id', businessId)
    .gte('slot_start', ninetyDaysAgo.toISOString());
  
  const completedAppointments = appointments?.filter(a => a.status === 'completed') || [];
  const noShows = appointments?.filter(a => a.status === 'no_show') || [];
  
  // Calculate revenue
  const totalRevenue = completedAppointments.reduce((sum, a) => sum + (a.total_price || 0), 0);
  const monthlyRevenue = completedAppointments
    .filter(a => new Date(a.slot_start) >= thirtyDaysAgo)
    .reduce((sum, a) => sum + (a.total_price || 0), 0);
  
  // Calculate average transaction
  const averageTransaction = completedAppointments.length > 0
    ? totalRevenue / completedAppointments.length
    : 0;
  
  // Get unique customers
  const uniqueCustomers = new Set(appointments?.map(a => a.patient_id) || []);
  const activeCustomers = new Set(
    appointments
      ?.filter(a => new Date(a.slot_start) >= thirtyDaysAgo)
      .map(a => a.patient_id) || []
  );
  
  // Calculate retention rate
  const oldCustomers = new Set(
    appointments
      ?.filter(a => new Date(a.slot_start) < thirtyDaysAgo && new Date(a.slot_start) >= ninetyDaysAgo)
      .map(a => a.patient_id) || []
  );
  const retainedCustomers = [...activeCustomers].filter(id => oldCustomers.has(id));
  const retentionRate = oldCustomers.size > 0 ? retainedCustomers.length / oldCustomers.size : 0;
  
  // Calculate no-show rate
  const noShowRate = appointments && appointments.length > 0
    ? noShows.length / appointments.length
    : 0;
  
  // Get average rating
  const { data: reviews } = await supabase
    .from('reviews')
    .select('stars')
    .eq('clinic_id', businessId);
  
  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length
    : 0;
  
  return {
    total_revenue: totalRevenue,
    monthly_revenue: monthlyRevenue,
    average_transaction: averageTransaction,
    total_customers: uniqueCustomers.size,
    active_customers: activeCustomers.size,
    retention_rate: retentionRate,
    no_show_rate: noShowRate,
    average_rating: averageRating,
  };
}

/**
 * Build customer context
 */
async function buildCustomerContext(businessId: string): Promise<CustomerContext[]> {
  const supabase = await createTenantClient(businessId);
  
  // Get all customers with their appointment history
  const { data: customers } = await supabase
    .from('users')
    .select(`
      id,
      name,
      phone,
      email,
      metadata,
      appointments:appointments(
        id,
        status,
        slot_start,
        total_price
      )
    `)
    .eq('clinic_id', businessId)
    .eq('role', 'patient');
  
  if (!customers) return [];
  
  const now = new Date();
  
  return customers.map(customer => {
    const appointments = (customer as any).appointments || [];
    const completedAppointments = appointments.filter((a: any) => a.status === 'completed');
    const cancelledAppointments = appointments.filter((a: any) => a.status === 'cancelled');
    const noShows = appointments.filter((a: any) => a.status === 'no_show');
    
    // Calculate total spent
    const totalSpent = completedAppointments.reduce((sum: number, a: any) => sum + (a.total_price || 0), 0);
    const averageSpend = completedAppointments.length > 0 ? totalSpent / completedAppointments.length : 0;
    
    // Find last visit
    const sortedAppointments = [...completedAppointments].sort((a: any, b: any) => 
      new Date(b.slot_start).getTime() - new Date(a.slot_start).getTime()
    );
    const lastVisit = sortedAppointments[0]?.slot_start || null;
    const daysSinceLastVisit = lastVisit 
      ? Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (24 * 60 * 60 * 1000))
      : 999;
    
    // Calculate preferred time and day
    const appointmentTimes = completedAppointments.map((a: any) => {
      const date = new Date(a.slot_start);
      return {
        hour: date.getHours(),
        day: date.getDay(),
      };
    });
    
    const preferredHour = appointmentTimes.length > 0
      ? Math.round(appointmentTimes.reduce((sum: number, t: any) => sum + t.hour, 0) / appointmentTimes.length)
      : null;
    
    const dayCount: Record<number, number> = {};
    appointmentTimes.forEach((t: any) => {
      dayCount[t.day] = (dayCount[t.day] || 0) + 1;
    });
    const preferredDay = Object.keys(dayCount).length > 0
      ? parseInt(Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0][0])
      : null;
    
    // Calculate LTV (Lifetime Value)
    const ltv = totalSpent;
    
    // Calculate churn risk
    const churnRisk = calculateChurnRisk({
      daysSinceLastVisit,
      noShowCount: noShows.length,
      cancelledCount: cancelledAppointments.length,
      totalAppointments: appointments.length,
    });
    
    // Determine segment
    const segment = determineCustomerSegment({
      totalSpent,
      daysSinceLastVisit,
      churnRisk,
      totalAppointments: appointments.length,
    });
    
    const metadata = (customer.metadata as any) || {};
    
    return {
      customer_id: customer.id,
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      behavior: {
        total_appointments: appointments.length,
        completed_appointments: completedAppointments.length,
        cancelled_appointments: cancelledAppointments.length,
        no_shows: noShows.length,
        total_spent: totalSpent,
        average_spend: averageSpend,
        last_visit: lastVisit,
        days_since_last_visit: daysSinceLastVisit,
        preferred_time: preferredHour !== null ? `${preferredHour}:00` : null,
        preferred_day: preferredDay,
      },
      preferences: {
        communication_channel: metadata.preferred_channel || 'whatsapp',
        language: metadata.language || 'fr',
        reminders_enabled: metadata.reminders_enabled !== false,
      },
      segment,
      ltv,
      churn_risk: churnRisk,
    };
  });
}

/**
 * Calculate churn risk (0-1)
 */
function calculateChurnRisk(data: {
  daysSinceLastVisit: number;
  noShowCount: number;
  cancelledCount: number;
  totalAppointments: number;
}): number {
  let risk = 0;
  
  // Days since last visit (0-0.4)
  if (data.daysSinceLastVisit > 180) risk += 0.4;
  else if (data.daysSinceLastVisit > 90) risk += 0.3;
  else if (data.daysSinceLastVisit > 60) risk += 0.2;
  else if (data.daysSinceLastVisit > 30) risk += 0.1;
  
  // No-show rate (0-0.3)
  if (data.totalAppointments > 0) {
    const noShowRate = data.noShowCount / data.totalAppointments;
    risk += noShowRate * 0.3;
  }
  
  // Cancellation rate (0-0.3)
  if (data.totalAppointments > 0) {
    const cancelRate = data.cancelledCount / data.totalAppointments;
    risk += cancelRate * 0.3;
  }
  
  return Math.min(risk, 1);
}

/**
 * Determine customer segment
 */
function determineCustomerSegment(data: {
  totalSpent: number;
  daysSinceLastVisit: number;
  churnRisk: number;
  totalAppointments: number;
}): 'vip' | 'regular' | 'at_risk' | 'inactive' | 'new' {
  // New customer
  if (data.totalAppointments <= 1) return 'new';
  
  // Inactive customer
  if (data.daysSinceLastVisit > 180) return 'inactive';
  
  // At-risk customer
  if (data.churnRisk > 0.5) return 'at_risk';
  
  // VIP customer
  if (data.totalSpent > 5000 && data.totalAppointments > 10) return 'vip';
  
  // Regular customer
  return 'regular';
}

/**
 * Build market context
 */
async function buildMarketContext(businessId: string): Promise<MarketContext> {
  const supabase = await createTenantClient(businessId);
  
  // Try to get real industry benchmarks from database
  // Fall back to reasonable defaults if not available
  const { data: benchmarkData } = await supabase
    .from('industry_benchmarks')
    .select('*')
    .eq('industry', 'healthcare')
    .single();
  
  const benchmarks = benchmarkData || {
    average_revenue_per_customer: 500,
    average_retention_rate: 0.7,
    average_no_show_rate: 0.15,
    average_rating: 4.2,
  };
  
  // Determine current season based on month
  const month = new Date().getMonth();
  let currentSeason: 'high' | 'medium' | 'low';
  let demandForecast: number;
  
  // High season: September-December, March-May
  // Medium season: January-February, June
  // Low season: July-August
  if ([8, 9, 10, 11, 2, 3, 4].includes(month)) {
    currentSeason = 'high';
    demandForecast = 0.8;
  } else if ([0, 1, 5].includes(month)) {
    currentSeason = 'medium';
    demandForecast = 0.6;
  } else {
    currentSeason = 'low';
    demandForecast = 0.4;
  }
  
  return {
    benchmarks,
    trends: {
      current_season: currentSeason,
      demand_forecast: demandForecast,
    },
  };
}

/**
 * Get context summary for AI prompt
 */
export function getContextSummary(context: AIContext): string {
  const { business, customers, market } = context;
  
  const summary = `
Business Overview:
- Name: ${business.business_name}
- Type: ${business.business_type}
- Monthly Revenue: ${business.currency} ${(business.metrics.monthly_revenue / 100).toFixed(2)}
- Total Customers: ${business.metrics.total_customers}
- Active Customers: ${business.metrics.active_customers}
- Retention Rate: ${(business.metrics.retention_rate * 100).toFixed(1)}%
- No-Show Rate: ${(business.metrics.no_show_rate * 100).toFixed(1)}%
- Average Rating: ${business.metrics.average_rating.toFixed(1)}/5

Customer Segments:
- VIP: ${customers.filter(c => c.segment === 'vip').length}
- Regular: ${customers.filter(c => c.segment === 'regular').length}
- At Risk: ${customers.filter(c => c.segment === 'at_risk').length}
- Inactive: ${customers.filter(c => c.segment === 'inactive').length}
- New: ${customers.filter(c => c.segment === 'new').length}

Market Context:
- Current Season: ${market.trends.current_season}
- Demand Forecast: ${(market.trends.demand_forecast * 100).toFixed(0)}%
- Industry Avg Revenue/Customer: ${market.benchmarks.average_revenue_per_customer}
- Industry Avg Retention: ${(market.benchmarks.average_retention_rate * 100).toFixed(0)}%

Services Offered: ${business.services.length} services
Staff Members: ${business.staff.length} staff
  `.trim();
  
  return summary;
}

/**
 * Cache context to avoid rebuilding too frequently
 */
const contextCache = new Map<string, { context: AIContext; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedContext(businessId: string): Promise<AIContext> {
  const cached = contextCache.get(businessId);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.context;
  }
  
  const context = await buildAIContext(businessId);
  contextCache.set(businessId, { context, timestamp: Date.now() });
  
  return context;
}
