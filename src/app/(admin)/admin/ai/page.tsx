/**
 * AI Management Page
 * 
 * Main page for managing the AI Revenue Agent.
 */

import { Metadata } from 'next';
import { requireTenant } from '@/lib/tenant';
import { AIApprovalQueue } from '@/components/admin/ai-approval-queue';
import { AIDashboard } from '@/components/admin/ai-dashboard';
import { AIHealthScore } from '@/components/admin/ai-health-score';
import { AIInsightsPanel } from '@/components/admin/ai-insights-panel';
import { AILearningMetrics } from '@/components/admin/ai-learning-metrics';
import { AINotificationsPanel } from '@/components/admin/ai-notifications-panel';
import { AISettings } from '@/components/admin/ai-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata: Metadata = {
  title: 'AI Revenue Agent | Admin',
  description: 'Manage your AI-powered revenue growth agent',
};

export default async function AIPage() {
  const { clinicId } = await requireTenant();

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="health">Health Score</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <AIDashboard businessId={clinicId} />
        </TabsContent>

        <TabsContent value="approvals">
          <AIApprovalQueue businessId={clinicId} />
        </TabsContent>

        <TabsContent value="notifications">
          <AINotificationsPanel businessId={clinicId} />
        </TabsContent>

        <TabsContent value="health">
          <AIHealthScore businessId={clinicId} />
        </TabsContent>

        <TabsContent value="insights">
          <AIInsightsPanel businessId={clinicId} />
        </TabsContent>

        <TabsContent value="learning">
          <AILearningMetrics businessId={clinicId} />
        </TabsContent>

        <TabsContent value="settings">
          <AISettings businessId={clinicId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
