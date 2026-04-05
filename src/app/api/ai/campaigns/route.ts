/**
 * AI Campaigns API
 * 
 * Create and manage AI marketing campaigns.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { requireTenant } from '@/lib/tenant';
import { 
  createCampaign, 
  startCampaign, 
  pauseCampaign,
  getCampaignResults,
  getCampaignTemplates
} from '@/lib/ai/campaign-manager';
import { createTenantClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

// GET - List campaigns or get templates
export async function GET(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { searchParams } = new URL(req.url);
    
    const businessId = searchParams.get('businessId') || clinicId;
    const templates = searchParams.get('templates') === 'true';

    if (businessId !== clinicId) {
      return apiUnauthorized('Cannot view other businesses');
    }

    // Return templates
    if (templates) {
      const campaignTemplates = getCampaignTemplates();
      return apiSuccess(campaignTemplates);
    }

    // List campaigns
    const supabase = await createTenantClient(businessId);

    const { data, error } = await supabase
      .from('ai_campaigns')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      return apiError('Failed to fetch campaigns', 500);
    }

    return apiSuccess(data);

  } catch (error) {
    logger.error('Failed to list campaigns', {
      context: 'ai-campaigns-api',
      error,
    });

    return apiError('Failed to list campaigns', 500);
  }
}

// POST - Create or control campaign
export async function POST(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const body = await req.json();
    const { action, campaignId, campaign } = body;

    if (action === 'start') {
      const result = await startCampaign(clinicId, campaignId);
      if (!result.success) {
        return apiError(result.error || 'Failed to start campaign', 400);
      }
      return apiSuccess({ started: true });
    }

    if (action === 'pause') {
      const result = await pauseCampaign(clinicId, campaignId);
      if (!result.success) {
        return apiError(result.error || 'Failed to pause campaign', 400);
      }
      return apiSuccess({ paused: true });
    }

    if (action === 'results') {
      const results = await getCampaignResults(clinicId, campaignId);
      return apiSuccess(results);
    }

    // Create campaign
    const result = await createCampaign(clinicId, campaign);
    if (!result.success) {
      return apiError(result.error || 'Failed to create campaign', 400);
    }

    return apiSuccess({ campaign_id: result.campaign_id });

  } catch (error) {
    logger.error('Failed to manage campaign', {
      context: 'ai-campaigns-api',
      error,
    });

    return apiError('Failed to manage campaign', 500);
  }
}
