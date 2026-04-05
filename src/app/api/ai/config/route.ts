/**
 * AI Configuration API
 * 
 * Get and update AI configuration.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { requireTenant } from '@/lib/tenant';
import { getAIConfig, updateAIConfig } from '@/lib/ai/config';
import { logger } from '@/lib/logger';

// GET - Get AI config
export async function GET(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { searchParams } = new URL(req.url);
    
    const businessId = searchParams.get('businessId') || clinicId;

    if (businessId !== clinicId) {
      return apiUnauthorized('Cannot view other businesses');
    }

    const config = await getAIConfig(businessId);

    return apiSuccess(config);

  } catch (error) {
    logger.error('Failed to get AI config', {
      context: 'ai-config-api',
      error,
    });

    return apiError('Failed to get config', 500);
  }
}

// PUT - Update AI config
export async function PUT(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { businessId, config } = await req.json();

    if (businessId !== clinicId) {
      return apiUnauthorized('Cannot update other businesses');
    }

    const result = await updateAIConfig(businessId, config);

    if (!result.success) {
      return apiError(result.error || 'Failed to update config', 500);
    }

    logger.info('AI config updated', {
      context: 'ai-config-api',
      businessId,
    });

    return apiSuccess({ updated: true });

  } catch (error) {
    logger.error('Failed to update AI config', {
      context: 'ai-config-api',
      error,
    });

    return apiError('Failed to update config', 500);
  }
}
