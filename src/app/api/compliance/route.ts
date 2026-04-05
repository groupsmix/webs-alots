/**
 * Compliance Settings API
 * 
 * GET  /api/compliance - Get compliance settings
 * PUT  /api/compliance - Update compliance settings
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { requireTenant } from '@/lib/tenant';
import { getComplianceSettings, updateComplianceSettings } from '@/lib/compliance-mode';
import { withAuth } from '@/lib/with-auth';
import type { ComplianceSettings } from '@/lib/compliance-mode';

/**
 * GET /api/compliance
 * Get compliance settings for the current business
 */
export const GET = withAuth(async (request: NextRequest) => {
  const { tenant } = await requireTenant();
  
  const settings = await getComplianceSettings(tenant.clinicId);
  
  return apiSuccess({ settings });
}, ['clinic_admin', 'super_admin']);

/**
 * PUT /api/compliance
 * Update compliance settings
 */
export const PUT = withAuth(async (request: NextRequest) => {
  const { tenant } = await requireTenant();
  
  const body = await request.json();
  const { settings } = body as { settings: Partial<ComplianceSettings> };
  
  if (!settings) {
    return apiError('Settings are required', 400);
  }
  
  const result = await updateComplianceSettings(tenant.clinicId, settings);
  
  if (!result.success) {
    return apiError(result.error || 'Failed to update settings', 400);
  }
  
  return apiSuccess({ message: 'Settings updated successfully' });
}, ['clinic_admin', 'super_admin']);
