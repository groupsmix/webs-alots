/**
 * AI Analysis API
 * 
 * Triggers AI analysis for a business.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { requireTenant } from '@/lib/tenant';
import { buildAIContext } from '@/lib/ai/context-engine';
import { generateDecisions, generateInsights } from '@/lib/ai/decision-engine';
import { getAIConfig } from '@/lib/ai/config';
import { createTenantClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { businessId } = await req.json();

    if (businessId !== clinicId) {
      return apiUnauthorized('Cannot analyze other businesses');
    }

    logger.info('Starting AI analysis', {
      context: 'ai-analyze-api',
      businessId,
    });

    // Get AI config
    const config = await getAIConfig(businessId);

    if (!config.enabled) {
      return apiError('AI is disabled for this business', 400);
    }

    // Build context
    const context = await buildAIContext(businessId);

    // Generate decisions
    const decision = await generateDecisions(businessId, context, config.goals.primary);

    // Generate insights
    const insights = await generateInsights(businessId, context);

    // Store decision
    const supabase = await createTenantClient(businessId);
    
    const { error: decisionError } = await supabase
      .from('ai_decisions')
      .insert({
        business_id: businessId,
        decision: decision.decision,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        alternatives: decision.alternatives,
        expected_impact: decision.expected_impact,
        created_at: new Date().toISOString(),
      });

    if (decisionError) {
      logger.error('Failed to store decision', {
        context: 'ai-analyze-api',
        error: decisionError,
      });
    }

    // Store actions
    for (const action of decision.actions) {
      const { error: actionError } = await supabase
        .from('ai_actions')
        .insert({
          business_id: businessId,
          type: action.type,
          status: action.requires_approval ? 'pending' : 'approved',
          risk_level: action.risk_level,
          confidence: action.confidence,
          action: action.action,
          reasoning: action.reasoning,
          expected_outcome: action.expected_outcome,
          requires_approval: action.requires_approval,
          created_at: new Date().toISOString(),
          created_by: 'ai_agent',
        });

      if (actionError) {
        logger.error('Failed to store action', {
          context: 'ai-analyze-api',
          error: actionError,
        });
      }
    }

    // Store insights
    for (const insight of insights) {
      const { error: insightError } = await supabase
        .from('ai_insights')
        .insert({
          business_id: businessId,
          type: insight.type,
          title: insight.title,
          description: insight.description,
          impact: insight.impact,
          revenue_impact: insight.revenue_impact,
          recommendations: insight.recommendations,
          data: insight.data,
          acted_upon: false,
          created_at: new Date().toISOString(),
        });

      if (insightError) {
        logger.error('Failed to store insight', {
          context: 'ai-analyze-api',
          error: insightError,
        });
      }
    }

    logger.info('AI analysis completed', {
      context: 'ai-analyze-api',
      businessId,
      actionsCount: decision.actions.length,
      insightsCount: insights.length,
    });

    return apiSuccess({
      decision,
      insights,
      actions_created: decision.actions.length,
      insights_created: insights.length,
    });

  } catch (error) {
    logger.error('AI analysis failed', {
      context: 'ai-analyze-api',
      error,
    });

    return apiError('Analysis failed', 500);
  }
}
