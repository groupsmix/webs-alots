/**
 * Compliance Check API
 * 
 * GET /api/compliance/check - Check compliance status
 */

import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api-response';
import { requireTenant } from '@/lib/tenant';
import { checkCompliance } from '@/lib/compliance-mode';
import { withAuth } from '@/lib/with-auth';

/**
 * GET /api/compliance/check
 * Check if business is compliant with regulations
 */
export const GET = withAuth(async (request: NextRequest) => {
  const { tenant } = await requireTenant();
  
  const compliance = await checkCompliance(tenant.clinicId);
  
  return apiSuccess(compliance);
}, ['clinic_admin', 'super_admin']);
