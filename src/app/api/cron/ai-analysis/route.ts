/**
 * AI Analysis Cron Job
 * 
 * Runs daily at 2 AM to analyze all businesses and generate decisions.
 * 
 * Cloudflare Workers Cron: 0 2 * * *
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { createClient } from '@supabase/supabase-js';
import { buildAIContext } from '@/lib/ai/context-engine';
import { generateDecisions, generateInsights } from '@/lib/ai/decision-engine';
import { getAIConfig } from '@/lib/ai/config';
import { createTenantClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return apiUnauthorized('Invalid cron secret');
    }

    logger.info('Starting AI analysis cron job', {
      context: 'ai-analysis-cron',
    });

    // Get all businesses with AI enabled
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: clinics, error: clinicsError } = await supabaseAdmin
      .from('clinics')
      .select('id, name, ai_config')
      .not('ai_config', 'is', null);

    if (clinicsError) {
      logger.error('Failed to fetch clinics', {
        context: 'ai-analysis-cron',
        error: clinicsError,
      });
      return apiError('Failed to fetch clinics', 500);
    }

    const results = [];

    // Process each clinic
    for (const clinic of clinics || []) {
      try {
        const config = await getAIConfig(clinic.id);

        // Skip if AI is disabled
        if (!config.enabled) {
          logger.info('Skipping disabled AI', {
            context: 'ai-analysis-cron',
            clinicId: clinic.id,
          });
          continue;
        }

        logger.info('Analyzing business', {
          context: 'ai-analysis-cron',
          clinicId: clinic.id,
          clinicName: clinic.name,
        });

        // Build context
        const context = await buildAIContext(clinic.id);

        // Generate decisions
        const decision = await generateDecisions(clinic.id, context, config.goals.primary);

        // Generate insights
        const insights = await generateInsights(clinic.id, context);

        // Store decision
        const supabase = await createTenantClient(clinic.id);

        const { error: decisionError } = await supabase
          .from('ai_decisions')
          .insert({
            business_id: clinic.id,
            decision: decision.decision,
            reasoning: decision.reasoning,
            confidence: decision.confidence,
            alternatives: decision.alternatives,
            expected_impact: decision.expected_impact,
            created_at: new Date().toISOString(),
          });

        if (decisionError) {
          logger.error('Failed to store decision', {
            context: 'ai-analysis-cron',
            clinicId: clinic.id,
            error: decisionError,
          });
        }

        // Store actions
        let actionsCreated = 0;
        for (const action of decision.actions) {
          const { error: actionError } = await supabase
            .from('ai_actions')
            .insert({
              business_id: clinic.id,
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

          if (!actionError) {
            actionsCreated++;
          }
        }

        // Store insights
        let insightsCreated = 0;
        for (const insight of insights) {
          const { error: insightError } = await supabase
            .from('ai_insights')
            .insert({
              business_id: clinic.id,
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

          if (!insightError) {
            insightsCreated++;
          }
        }

        results.push({
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          success: true,
          actions_created: actionsCreated,
          insights_created: insightsCreated,
        });

        logger.info('Business analysis completed', {
          context: 'ai-analysis-cron',
          clinicId: clinic.id,
          actionsCreated,
          insightsCreated,
        });

      } catch (error) {
        logger.error('Failed to analyze business', {
          context: 'ai-analysis-cron',
          clinicId: clinic.id,
          error,
        });

        results.push({
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('AI analysis cron job completed', {
      context: 'ai-analysis-cron',
      totalClinics: clinics?.length || 0,
      successfulAnalyses: results.filter(r => r.success).length,
    });

    return apiSuccess({
      total_clinics: clinics?.length || 0,
      analyzed: results.length,
      results,
    });

  } catch (error) {
    logger.error('AI analysis cron job failed', {
      context: 'ai-analysis-cron',
      error,
    });

    return apiError('Cron job failed', 500);
  }
}
