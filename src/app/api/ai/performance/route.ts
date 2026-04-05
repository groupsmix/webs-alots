/**
 * AI Performance API
 * 
 * Get AI performance metrics.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { requireTenant } from '@/lib/tenant';
import { getActionStats } from '@/lib/ai/action-engine';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { searchParams } = new URL(req.url);
    
    const businessId = searchParams.get('businessId') || clinicId;
    const days = parseInt(searchParams.get('days') || '30');

    if (businessId !== clinicId) {
      return apiUnauthorized('Cannot view other businesses');
    }

    const stats = await getActionStats(businessId, days);

    return apiSuccess(stats);

  } catch (error) {
    logger.error('Failed to get AI performance', {
      context: 'ai-performance-api',
      error,
    });

    return apiError('Failed to get performance', 500);
  }
}
