/**
 * AI Reports Cron Job
 * 
 * Sends daily summaries and weekly reports.
 * 
 * Cloudflare Workers Cron: 0 8 * * * (8 AM daily)
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { createClient } from '@supabase/supabase-js';
import { sendDailySummary, generateWeeklyReport } from '@/lib/ai/notifications';
import { getAIConfig } from '@/lib/ai/config';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return apiUnauthorized('Invalid cron secret');
    }

    logger.info('Starting AI reports cron job', {
      context: 'ai-reports-cron',
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
        context: 'ai-reports-cron',
        error: clinicsError,
      });
      return apiError('Failed to fetch clinics', 500);
    }

    const results = [];
    const today = new Date().getDay();
    const isMonday = today === 1; // Send weekly report on Mondays

    // Process each clinic
    for (const clinic of clinics || []) {
      try {
        const config = await getAIConfig(clinic.id);

        // Skip if AI is disabled or notifications disabled
        if (!config.enabled || !config.notifications.daily_summary) {
          continue;
        }

        logger.info('Sending reports for business', {
          context: 'ai-reports-cron',
          clinicId: clinic.id,
          clinicName: clinic.name,
        });

        // Send daily summary
        await sendDailySummary(clinic.id);

        // Send weekly report on Mondays
        if (isMonday && config.notifications.performance_reports) {
          const report = await generateWeeklyReport(clinic.id);
          
          // TODO: Actually send email via Resend/SMTP
          logger.info('Weekly report generated', {
            context: 'ai-reports-cron',
            clinicId: clinic.id,
            subject: report.subject,
          });
        }

        results.push({
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          success: true,
          daily_sent: true,
          weekly_sent: isMonday,
        });

      } catch (error) {
        logger.error('Failed to send reports for business', {
          context: 'ai-reports-cron',
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

    logger.info('AI reports cron job completed', {
      context: 'ai-reports-cron',
      totalClinics: clinics?.length || 0,
      successfulReports: results.filter(r => r.success).length,
    });

    return apiSuccess({
      total_clinics: clinics?.length || 0,
      reports_sent: results.length,
      results,
    });

  } catch (error) {
    logger.error('AI reports cron job failed', {
      context: 'ai-reports-cron',
      error,
    });

    return apiError('Cron job failed', 500);
  }
}
