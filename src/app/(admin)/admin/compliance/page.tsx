/**
 * Compliance Settings Page
 * 
 * Allows admins to configure data storage, encryption, backup, and sync settings.
 */

import { Suspense } from 'react';
import { requireTenant } from '@/lib/tenant';
import ComplianceSettingsComponent from '@/components/admin/compliance-settings';
import SyncStatusDashboard from '@/components/admin/sync-status-dashboard';

export const metadata = {
  title: 'Compliance Settings | Oltigo',
  description: 'Configure data storage and compliance settings',
};

export default async function CompliancePage() {
  const tenant = await requireTenant();
  
  return (
    <div className="space-y-8">
      {/* Compliance Settings */}
      <Suspense fallback={<LoadingState />}>
        <ComplianceSettingsComponent 
          businessId={tenant.clinicId}
          businessType={tenant.clinicType}
        />
      </Suspense>
      
      {/* Sync Status */}
      <div className="border-t border-gray-200 pt-8">
        <Suspense fallback={<LoadingState />}>
          <SyncStatusDashboard />
        </Suspense>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
