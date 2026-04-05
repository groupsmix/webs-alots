/**
 * AI Actions Execution Cron Job
 * 
 * Runs daily at 3 AM to execute approved AI actions.
 * 
 * Cloudflare Workers Cron: 0 3 * * *
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { createClient } from '@supabase/supabase-js';
import { executeAction } from '@/lib/ai/action-engine';
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

    logger.info('Starting AI actions execution cron job', {
      context: 'ai-actions-cron',
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
        context: 'ai-actions-cron',
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
          continue;
        }

        logger.info('Executing actions for business', {
          context: 'ai-actions-cron',
          clinicId: clinic.id,
        });

        const supabase = await createTenantClient(clinic.id);

        // Get approved actions that haven't been executed
        const { data: actions, error: actionsError } = await supabase
          .from('ai_actions')
          .select('*')
          .eq('business_id', clinic.id)
          .eq('status', 'approved')
          .is('executed_at', null)
          .order('created_at', { ascending: true })
          .limit(config.autonomy.max_actions_per_day);

        if (actionsError) {
          logger.error('Failed to fetch actions', {
            context: 'ai-actions-cron',
            clinicId: clinic.id,
            error: actionsError,
          });
          continue;
        }

        if (!actions || actions.length === 0) {
          logger.info('No actions to execute', {
            context: 'ai-actions-cron',
            clinicId: clinic.id,
          });
          continue;
        }

        let executed = 0;
        let failed = 0;

        // Execute each action
        for (const action of actions) {
          try {
            logger.info('Executing action', {
              context: 'ai-actions-cron',
              clinicId: clinic.id,
              actionId: action.id,
              actionType: action.type,
            });

            const result = await executeAction(action, config);

            if (result.success) {
              executed++;
            } else {
              failed++;
            }

            // Small delay between actions
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error) {
            logger.error('Failed to execute action', {
              context: 'ai-actions-cron',
              clinicId: clinic.id,
              actionId: action.id,
              error,
            });
            failed++;
          }
        }

        results.push({
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          total_actions: actions.length,
          executed,
          failed,
        });

        logger.info('Actions execution completed for business', {
          context: 'ai-actions-cron',
          clinicId: clinic.id,
          executed,
          failed,
        });

      } catch (error) {
        logger.error('Failed to process business actions', {
          context: 'ai-actions-cron',
          clinicId: clinic.id,
          error,
        });

        results.push({
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('AI actions execution cron job completed', {
      context: 'ai-actions-cron',
      totalClinics: clinics?.length || 0,
      results: results.length,
    });

    return apiSuccess({
      total_clinics: clinics?.length || 0,
      processed: results.length,
      results,
    });

  } catch (error) {
    logger.error('AI actions cron job failed', {
      context: 'ai-actions-cron',
      error,
    });

    return apiError('Cron job failed', 500);
  }
}
