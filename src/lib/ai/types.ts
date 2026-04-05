/**
 * AI Revenue Agent - Type Definitions
 * 
 * Core types for the AI system that autonomously grows business revenue.
 */

// ========== AI Action Types ==========

export type AIActionType =
  | 'send_message'
  | 'create_appointment'
  | 'update_appointment'
  | 'cancel_appointment'
  | 'reschedule_appointment'
  | 'adjust_pricing'
  | 'create_promotion'
  | 'send_review_request'
  | 'create_upsell_offer'
  | 'update_availability'
  | 'generate_report'
  | 'analyze_data'
  | 'predict_no_show'
  | 'identify_opportunity';

export type AIActionStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'rolled_back';

export type AIRiskLevel = 'low' | 'medium' | 'high';

export interface AIAction {
  id: string;
  business_id: string;
  type: AIActionType;
  status: AIActionStatus;
  risk_level: AIRiskLevel;
  confidence: number; // 0-1
  
  /** The action to perform */
  action: {
    type: AIActionType;
    params: Record<string, any>;
  };
  
  /** Why the AI wants to take this action */
  reasoning: string;
  
  /** Expected outcome */
  expected_outcome: {
    revenue_impact?: number; // Expected revenue change in cents
    time_saved?: number; // Expected time saved in minutes
    customer_satisfaction?: number; // Expected satisfaction change (0-1)
  };
  
  /** Actual outcome (after execution) */
  actual_outcome?: {
    revenue_impact?: number;
    time_saved?: number;
    customer_satisfaction?: number;
    success: boolean;
    error?: string;
  };
  
  /** Rollback plan if action fails */
  rollback_plan?: {
    type: string;
    params: Record<string, any>;
  };
  
  /** Requires human approval? */
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: string;
  
  /** Execution details */
  executed_at?: string;
  completed_at?: string;
  
  /** Audit trail */
  created_at: string;
  created_by: 'ai_agent';
  metadata?: Record<string, any>;
}

// ========== AI Context Types ==========

export interface BusinessContext {
  business_id: string;
  business_name: string;
  business_type: string;
  timezone: string;
  currency: string;
  
  /** Business metrics */
  metrics: {
    total_revenue: number;
    monthly_revenue: number;
    average_transaction: number;
    total_customers: number;
    active_customers: number;
    retention_rate: number;
    no_show_rate: number;
    average_rating: number;
  };
  
  /** Working hours */
  working_hours: {
    [day: number]: {
      open: string;
      close: string;
      enabled: boolean;
    };
  };
  
  /** Services offered */
  services: Array<{
    id: string;
    name: string;
    price: number;
    duration: number;
    category: string;
  }>;
  
  /** Staff members */
  staff: Array<{
    id: string;
    name: string;
    role: string;
    specialties: string[];
  }>;
}

export interface CustomerContext {
  customer_id: string;
  name: string;
  phone: string;
  email: string;
  
  /** Customer behavior */
  behavior: {
    total_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    no_shows: number;
    total_spent: number;
    average_spend: number;
    last_visit: string | null;
    days_since_last_visit: number;
    preferred_time: string | null;
    preferred_day: number | null;
  };
  
  /** Customer preferences */
  preferences: {
    communication_channel: 'whatsapp' | 'sms' | 'email';
    language: string;
    reminders_enabled: boolean;
  };
  
  /** Customer segment */
  segment: 'vip' | 'regular' | 'at_risk' | 'inactive' | 'new';
  
  /** Lifetime value */
  ltv: number;
  
  /** Churn risk (0-1) */
  churn_risk: number;
}

export interface MarketContext {
  /** Industry benchmarks */
  benchmarks: {
    average_revenue_per_customer: number;
    average_retention_rate: number;
    average_no_show_rate: number;
    average_rating: number;
  };
  
  /** Competitor data (if available) */
  competitors?: Array<{
    name: string;
    pricing: number;
    rating: number;
    services: string[];
  }>;
  
  /** Seasonal trends */
  trends: {
    current_season: 'high' | 'medium' | 'low';
    demand_forecast: number; // 0-1
  };
}

export interface AIContext {
  business: BusinessContext;
  customers: CustomerContext[];
  market: MarketContext;
  timestamp: string;
}

// ========== AI Decision Types ==========

export interface AIDecision {
  id: string;
  business_id: string;
  
  /** What decision was made */
  decision: string;
  
  /** Why this decision was made */
  reasoning: string;
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Alternative options considered */
  alternatives: Array<{
    option: string;
    score: number;
    pros: string[];
    cons: string[];
  }>;
  
  /** Actions to take */
  actions: AIAction[];
  
  /** Expected impact */
  expected_impact: {
    revenue: number;
    customers_affected: number;
    time_frame: string;
  };
  
  created_at: string;
}

// ========== AI Insight Types ==========

export interface AIInsight {
  id: string;
  business_id: string;
  
  /** Type of insight */
  type: 'opportunity' | 'risk' | 'trend' | 'anomaly' | 'recommendation';
  
  /** Insight title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Impact level */
  impact: 'low' | 'medium' | 'high' | 'critical';
  
  /** Potential revenue impact */
  revenue_impact?: number;
  
  /** Recommended actions */
  recommendations: string[];
  
  /** Supporting data */
  data: Record<string, any>;
  
  /** Has this been acted upon? */
  acted_upon: boolean;
  action_taken?: string;
  
  created_at: string;
  expires_at?: string;
}

// ========== AI Campaign Types ==========

export interface AICampaign {
  id: string;
  business_id: string;
  
  /** Campaign name */
  name: string;
  
  /** Campaign type */
  type: 'reengagement' | 'upsell' | 'retention' | 'acquisition' | 'promotion';
  
  /** Target audience */
  target: {
    segment: string;
    criteria: Record<string, any>;
    estimated_size: number;
  };
  
  /** Campaign message */
  message: {
    template: string;
    variables: Record<string, any>;
    channel: 'whatsapp' | 'sms' | 'email';
  };
  
  /** Campaign schedule */
  schedule: {
    start_date: string;
    end_date?: string;
    send_time: string;
    frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  };
  
  /** Campaign goals */
  goals: {
    target_revenue?: number;
    target_bookings?: number;
    target_response_rate?: number;
  };
  
  /** Campaign results */
  results?: {
    messages_sent: number;
    messages_delivered: number;
    responses: number;
    bookings: number;
    revenue: number;
    roi: number;
  };
  
  /** Campaign status */
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  
  created_at: string;
  created_by: 'ai_agent' | string;
}

// ========== AI Performance Types ==========

export interface AIPerformance {
  business_id: string;
  period: {
    start: string;
    end: string;
  };
  
  /** Actions taken */
  actions: {
    total: number;
    by_type: Record<AIActionType, number>;
    by_risk_level: Record<AIRiskLevel, number>;
    success_rate: number;
  };
  
  /** Revenue impact */
  revenue: {
    generated: number;
    saved: number;
    total_impact: number;
    roi: number; // Return on investment
  };
  
  /** Time saved */
  time_saved: {
    total_minutes: number;
    by_task: Record<string, number>;
  };
  
  /** Customer impact */
  customers: {
    reengaged: number;
    retained: number;
    upsold: number;
    satisfaction_change: number;
  };
  
  /** Insights generated */
  insights: {
    total: number;
    by_type: Record<string, number>;
    acted_upon: number;
  };
  
  /** Campaigns run */
  campaigns: {
    total: number;
    successful: number;
    total_reach: number;
    total_revenue: number;
  };
}

// ========== AI Configuration Types ==========

export interface AIConfig {
  business_id: string;
  
  /** Is AI enabled? */
  enabled: boolean;
  
  /** Autonomy level */
  autonomy: {
    level: 'assistant' | 'copilot' | 'autopilot';
    
    /** Auto-approve actions by risk level */
    auto_approve: {
      low: boolean;
      medium: boolean;
      high: boolean;
    };
    
    /** Max actions per day */
    max_actions_per_day: number;
    
    /** Max spend per action */
    max_spend_per_action: number;
  };
  
  /** Which capabilities are enabled */
  capabilities: {
    customer_reengagement: boolean;
    intelligent_scheduling: boolean;
    dynamic_pricing: boolean;
    upselling: boolean;
    customer_service: boolean;
    marketing_campaigns: boolean;
    analytics: boolean;
    predictions: boolean;
  };
  
  /** Communication preferences */
  communication: {
    channels: Array<'whatsapp' | 'sms' | 'email'>;
    tone: 'professional' | 'friendly' | 'casual';
    language: string;
  };
  
  /** Goals */
  goals: {
    primary: 'revenue' | 'retention' | 'satisfaction' | 'efficiency';
    target_revenue_increase: number; // percentage
    target_retention_rate: number; // percentage
  };
  
  /** Notifications */
  notifications: {
    daily_summary: boolean;
    action_approvals: boolean;
    insights: boolean;
    performance_reports: boolean;
  };
  
  updated_at: string;
}

// ========== AI Learning Types ==========

export interface AILearning {
  business_id: string;
  
  /** What was learned */
  learning: {
    type: 'pattern' | 'preference' | 'optimization' | 'prediction';
    description: string;
    confidence: number;
  };
  
  /** Supporting evidence */
  evidence: {
    data_points: number;
    time_period: string;
    accuracy: number;
  };
  
  /** How this affects future decisions */
  impact: {
    affects: string[];
    improvement: number; // percentage
  };
  
  created_at: string;
}

// ========== Export all types ==========

export type {
  AIAction,
  AIActionType,
  AIActionStatus,
  AIRiskLevel,
  BusinessContext,
  CustomerContext,
  MarketContext,
  AIContext,
  AIDecision,
  AIInsight,
  AICampaign,
  AIPerformance,
  AIConfig,
  AILearning,
};
