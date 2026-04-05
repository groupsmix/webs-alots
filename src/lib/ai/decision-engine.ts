/**
 * AI Decision Engine
 * 
 * Uses LLMs (GPT-4, Claude) to analyze business context and make intelligent decisions.
 * This is the "brain" of the AI Revenue Agent.
 */

import { logger } from '@/lib/logger';
import type { AIContext, AIDecision, AIAction, AIInsight, AIRiskLevel } from './types';
import { getContextSummary } from './context-engine';

// ========== LLM Response Validation ==========

/**
 * Validate LLM response structure
 */
function validateLLMResponse(response: any): LLMResponse {
  if (!response || typeof response !== 'object') {
    throw new Error('LLM response must be an object');
  }
  
  if (!response.decision || typeof response.decision !== 'string') {
    throw new Error('LLM response missing valid "decision" field');
  }
  
  if (!response.reasoning || typeof response.reasoning !== 'string') {
    throw new Error('LLM response missing valid "reasoning" field');
  }
  
  if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
    throw new Error('LLM response missing valid "confidence" field (0-1)');
  }
  
  if (!Array.isArray(response.actions)) {
    throw new Error('LLM response missing valid "actions" array');
  }
  
  if (!Array.isArray(response.insights)) {
    response.insights = []; // Optional field
  }
  
  // Validate each action
  for (const action of response.actions) {
    if (!action.type || typeof action.type !== 'string') {
      throw new Error('Action missing valid "type" field');
    }
    
    if (!action.params || typeof action.params !== 'object') {
      throw new Error('Action missing valid "params" field');
    }
    
    if (!action.risk_level || !['low', 'medium', 'high'].includes(action.risk_level)) {
      throw new Error('Action missing valid "risk_level" field');
    }
  }
  
  return response as LLMResponse;
}

// ========== LLM Configuration ==========

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface LLMResponse {
  decision: string;
  reasoning: string;
  confidence: number;
  actions: Array<{
    type: string;
    params: Record<string, any>;
    reasoning: string;
    risk_level: AIRiskLevel;
    expected_outcome: {
      revenue_impact?: number;
      time_saved?: number;
    };
  }>;
  insights: Array<{
    type: string;
    title: string;
    description: string;
    impact: string;
    recommendations: string[];
  }>;
}

// ========== Decision Engine ==========

/**
 * Analyze business and generate decisions
 */
export async function generateDecisions(
  businessId: string,
  context: AIContext,
  goal: 'revenue' | 'retention' | 'efficiency' = 'revenue'
): Promise<AIDecision> {
  logger.info('Generating AI decisions', {
    context: 'ai-decision-engine',
    businessId,
    goal,
  });
  
  const prompt = buildDecisionPrompt(context, goal);
  const response = await callLLM(prompt);
  
  // Convert LLM response to structured decision
  const decision: AIDecision = {
    id: crypto.randomUUID(),
    business_id: businessId,
    decision: response.decision,
    reasoning: response.reasoning,
    confidence: response.confidence,
    alternatives: response.alternatives || [],
    actions: response.actions.map(action => ({
      id: crypto.randomUUID(),
      business_id: businessId,
      type: action.type as any,
      status: 'pending',
      risk_level: action.risk_level,
      confidence: response.confidence,
      action: {
        type: action.type as any,
        params: action.params,
      },
      reasoning: action.reasoning,
      expected_outcome: action.expected_outcome,
      requires_approval: action.risk_level === 'high',
      created_at: new Date().toISOString(),
      created_by: 'ai_agent',
    })),
    expected_impact: {
      revenue: response.actions.reduce((sum, a) => sum + (a.expected_outcome.revenue_impact || 0), 0),
      customers_affected: estimateCustomersAffected(response.actions, context),
      time_frame: '30 days',
    },
    created_at: new Date().toISOString(),
  };
  
  logger.info('AI decision generated', {
    context: 'ai-decision-engine',
    businessId,
    actionsCount: decision.actions.length,
    expectedRevenue: decision.expected_impact.revenue,
  });
  
  return decision;
}

/**
 * Generate insights from business context
 */
export async function generateInsights(
  businessId: string,
  context: AIContext
): Promise<AIInsight[]> {
  logger.info('Generating AI insights', {
    context: 'ai-decision-engine',
    businessId,
  });
  
  const prompt = buildInsightsPrompt(context);
  const response = await callLLM(prompt);
  
  const insights: AIInsight[] = response.insights.map(insight => ({
    id: crypto.randomUUID(),
    business_id: businessId,
    type: insight.type as any,
    title: insight.title,
    description: insight.description,
    impact: insight.impact as any,
    revenue_impact: extractRevenueImpact(insight.description),
    recommendations: insight.recommendations,
    data: {},
    acted_upon: false,
    created_at: new Date().toISOString(),
  }));
  
  logger.info('AI insights generated', {
    context: 'ai-decision-engine',
    businessId,
    insightsCount: insights.length,
  });
  
  return insights;
}

// ========== Prompt Engineering ==========

function buildDecisionPrompt(context: AIContext, goal: string): string {
  const summary = getContextSummary(context);
  
  return `
You are an AI Revenue Agent for a ${context.business.business_type} business. Your goal is to ${goal === 'revenue' ? 'maximize revenue' : goal === 'retention' ? 'improve customer retention' : 'increase operational efficiency'}.

${summary}

Based on this context, analyze the business and provide:

1. **Decision**: What should the business do to achieve the goal?
2. **Reasoning**: Why is this the best decision?
3. **Confidence**: How confident are you (0-1)?
4. **Actions**: Specific actions to take (with parameters, risk level, and expected outcomes)
5. **Insights**: Key insights about the business

Focus on:
- Re-engaging inactive customers (${context.customers.filter(c => c.segment === 'inactive').length} inactive)
- Retaining at-risk customers (${context.customers.filter(c => c.segment === 'at_risk').length} at risk)
- Upselling to regular customers (${context.customers.filter(c => c.segment === 'regular').length} regular)
- Reducing no-shows (current rate: ${(context.business.metrics.no_show_rate * 100).toFixed(1)}%)
- Filling empty time slots
- Optimizing pricing

Respond in JSON format:
{
  "decision": "string",
  "reasoning": "string",
  "confidence": 0.85,
  "actions": [
    {
      "type": "send_message",
      "params": {
        "customer_id": "uuid",
        "message": "string",
        "channel": "whatsapp"
      },
      "reasoning": "string",
      "risk_level": "low",
      "expected_outcome": {
        "revenue_impact": 5000,
        "time_saved": 30
      }
    }
  ],
  "insights": [
    {
      "type": "opportunity",
      "title": "string",
      "description": "string",
      "impact": "high",
      "recommendations": ["string"]
    }
  ]
}

Available action types:
- send_message: Send WhatsApp/SMS/Email to customer
- create_appointment: Book appointment for customer
- reschedule_appointment: Reschedule existing appointment
- adjust_pricing: Change service pricing
- create_promotion: Create limited-time offer
- send_review_request: Ask for review
- create_upsell_offer: Offer additional service

Risk levels:
- low: Safe to execute automatically (e.g., send reminder)
- medium: Requires notification (e.g., reschedule appointment)
- high: Requires approval (e.g., adjust pricing)

Be specific with customer IDs, amounts, and messages. Use the business's currency (${context.business.currency}).
  `.trim();
}

function buildInsightsPrompt(context: AIContext): string {
  const summary = getContextSummary(context);
  
  return `
You are an AI business analyst for a ${context.business.business_type} business.

${summary}

Analyze this business and provide 5-10 actionable insights. Focus on:
- Revenue opportunities
- Customer retention risks
- Operational inefficiencies
- Market trends
- Competitive positioning

Respond in JSON format:
{
  "insights": [
    {
      "type": "opportunity",
      "title": "string",
      "description": "string",
      "impact": "high",
      "recommendations": ["string"]
    }
  ]
}

Insight types: opportunity, risk, trend, anomaly, recommendation
Impact levels: low, medium, high, critical
  `.trim();
}

// ========== LLM Integration ==========

async function callLLM(prompt: string): Promise<LLMResponse> {
  // Try OpenAI first
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(prompt);
    } catch (error) {
      logger.warn('OpenAI call failed, falling back to Anthropic', {
        context: 'ai-decision-engine',
        error,
      });
    }
  }
  
  // Fallback to Anthropic
  if (ANTHROPIC_API_KEY) {
    try {
      return await callAnthropic(prompt);
    } catch (error) {
      logger.error('Anthropic call failed', {
        context: 'ai-decision-engine',
        error,
      });
    }
  }
  
  // If both fail, throw error - don't use mock in production
  const error = new Error('No LLM API keys configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
  logger.error('LLM API keys missing', {
    context: 'ai-decision-engine',
    error,
  });
  
  throw error;
}

async function callOpenAI(prompt: string): Promise<LLMResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an AI Revenue Agent that helps businesses grow. Always respond in valid JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const parsed = JSON.parse(content);
    return validateLLMResponse(parsed);
  } catch (error) {
    logger.error('Invalid OpenAI response', {
      context: 'ai-decision-engine',
      content,
      error,
    });
    throw new Error('OpenAI returned invalid JSON response');
  }
}

async function callAnthropic(prompt: string): Promise<LLMResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-opus-20240229',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  const content = data.content[0].text;
  
  try {
    const parsed = JSON.parse(content);
    return validateLLMResponse(parsed);
  } catch (error) {
    logger.error('Invalid Anthropic response', {
      context: 'ai-decision-engine',
      content,
      error,
    });
    throw new Error('Anthropic returned invalid JSON response');
  }
}

function getMockResponse(): LLMResponse {
  return {
    decision: 'Re-engage inactive customers and fill empty time slots',
    reasoning: 'The business has a significant number of inactive customers who could be re-engaged with personalized outreach. Additionally, optimizing the schedule to fill empty slots will increase revenue.',
    confidence: 0.85,
    actions: [
      {
        type: 'send_message',
        params: {
          segment: 'inactive',
          message: 'We miss you! Book your next appointment and get 20% off.',
          channel: 'whatsapp',
        },
        reasoning: 'Inactive customers are likely to respond to a personalized offer',
        risk_level: 'low',
        expected_outcome: {
          revenue_impact: 5000,
          time_saved: 0,
        },
      },
      {
        type: 'create_promotion',
        params: {
          name: 'Fill Empty Slots',
          discount: 15,
          time_slots: ['14:00', '15:00'],
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        reasoning: 'Offering a discount for typically empty time slots will increase bookings',
        risk_level: 'medium',
        expected_outcome: {
          revenue_impact: 3000,
          time_saved: 0,
        },
      },
    ],
    insights: [
      {
        type: 'opportunity',
        title: 'High No-Show Rate',
        description: 'Your no-show rate is above industry average. Implementing automated reminders could reduce this by 50%.',
        impact: 'high',
        recommendations: [
          'Send WhatsApp reminders 24 hours before appointment',
          'Send SMS reminders 2 hours before appointment',
          'Implement a cancellation policy',
        ],
      },
      {
        type: 'risk',
        title: 'At-Risk Customers',
        description: 'You have customers who are at risk of churning. Proactive outreach could retain them.',
        impact: 'medium',
        recommendations: [
          'Send personalized check-in messages',
          'Offer loyalty discounts',
          'Request feedback to understand concerns',
        ],
      },
    ],
  };
}

// ========== Helper Functions ==========

function estimateCustomersAffected(actions: any[], context: AIContext): number {
  let count = 0;
  
  for (const action of actions) {
    if (action.params.customer_id) {
      count += 1;
    } else if (action.params.segment) {
      count += context.customers.filter(c => c.segment === action.params.segment).length;
    }
  }
  
  return count;
}

function extractRevenueImpact(description: string): number | undefined {
  // Try to extract revenue numbers from description
  const match = description.match(/(\d+)%/);
  if (match) {
    return parseInt(match[1]);
  }
  return undefined;
}

/**
 * Evaluate action safety
 */
export function evaluateActionSafety(action: AIAction): {
  safe: boolean;
  concerns: string[];
} {
  const concerns: string[] = [];
  
  // Check risk level
  if (action.risk_level === 'high') {
    concerns.push('High-risk action requires approval');
  }
  
  // Check confidence
  if (action.confidence < 0.7) {
    concerns.push('Low confidence level');
  }
  
  // Check expected outcome
  if (action.expected_outcome.revenue_impact && action.expected_outcome.revenue_impact < 0) {
    concerns.push('Negative revenue impact expected');
  }
  
  // Check for pricing changes
  if (action.type === 'adjust_pricing') {
    const change = action.action.params.change_percent;
    if (Math.abs(change) > 20) {
      concerns.push('Large pricing change (>20%)');
    }
  }
  
  return {
    safe: concerns.length === 0,
    concerns,
  };
}
