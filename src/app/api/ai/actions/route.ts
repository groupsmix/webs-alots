/**
 * AI Actions API
 * 
 * Manage AI actions (list, approve, reject).
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { requireTenant } from '@/lib/tenant';
import { createTenantClient } from '@/lib/supabase-server';
import { executeAction } from '@/lib/ai/action-engine';
import { getAIConfig } from '@/lib/ai/config';
import { logger } from '@/lib/logger';

// GET - List actions
export async function GET(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { searchParams } = new URL(req.url);
    
    const businessId = searchParams.get('businessId') || clinicId;
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');

    if (businessId !== clinicId) {
      return apiUnauthorized('Cannot view other businesses');
    }

    const supabase = await createTenantClient(businessId);

    let query = supabase
      .from('ai_actions')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return apiError('Failed to fetch actions', 500);
    }

    return apiSuccess(data);

  } catch (error) {
    logger.error('Failed to list actions', {
      context: 'ai-actions-api',
      error,
    });

    return apiError('Failed to list actions', 500);
  }
}

// POST - Approve/reject action
export async function POST(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { actionId, approve, userId } = await req.json();

    const supabase = await createTenantClient(clinicId);

    // Get action
    const { data: action, error: fetchError } = await supabase
      .from('ai_actions')
      .select('*')
      .eq('id', actionId)
      .eq('business_id', clinicId)
      .single();

    if (fetchError || !action) {
      return apiError('Action not found', 404);
    }

    if (action.status !== 'pending') {
      return apiError('Action is not pending approval', 400);
    }

    if (approve) {
      // Approve and execute
      const { error: updateError } = await supabase
        .from('ai_actions')
        .update({
          status: 'approved',
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      if (updateError) {
        return apiError('Failed to approve action', 500);
      }

      // Execute action
      const config = await getAIConfig(clinicId);
      const result = await executeAction(action, config);

      logger.info('Action approved and executed', {
        context: 'ai-actions-api',
        actionId,
        success: result.success,
      });

      return apiSuccess({ approved: true, executed: true, result });

    } else {
      // Reject
      const { error: updateError } = await supabase
        .from('ai_actions')
        .update({
          status: 'failed',
          actual_outcome: {
            success: false,
            error: 'Rejected by user',
          },
        })
        .eq('id', actionId);

      if (updateError) {
        return apiError('Failed to reject action', 500);
      }

      logger.info('Action rejected', {
        context: 'ai-actions-api',
        actionId,
      });

      return apiSuccess({ approved: false });
    }

  } catch (error) {
    logger.error('Failed to process action', {
      context: 'ai-actions-api',
      error,
    });

    return apiError('Failed to process action', 500);
  }
}
