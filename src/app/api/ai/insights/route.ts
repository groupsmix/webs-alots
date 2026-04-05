/**
 * AI Insights API
 * 
 * Get AI-generated insights.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { requireTenant } from '@/lib/tenant';
import { createTenantClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { searchParams } = new URL(req.url);
    
    const businessId = searchParams.get('businessId') || clinicId;
    const limit = parseInt(searchParams.get('limit') || '10');

    if (businessId !== clinicId) {
      return apiUnauthorized('Cannot view other businesses');
    }

    const supabase = await createTenantClient(businessId);

    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return apiError('Failed to fetch insights', 500);
    }

    return apiSuccess(data);

  } catch (error) {
    logger.error('Failed to list insights', {
      context: 'ai-insights-api',
      error,
    });

    return apiError('Failed to list insights', 500);
  }
}
