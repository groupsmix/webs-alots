'use client';

/**
 * AI Performance Charts
 * 
 * Visual analytics for AI performance metrics.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Users,
  Loader2 
} from 'lucide-react';

interface AIPerformanceChartsProps {
  businessId: string;
}

export function AIPerformanceCharts({ businessId }: AIPerformanceChartsProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadStats();
  }, [businessId, timeRange]);

  async function loadStats() {
    setLoading(true);
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const res = await fetch(`/api/ai/performance?businessId=${businessId}&days=${days}`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Performance Analytics</h3>
        <Tabs value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
          <TabsList>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
            <TabsTrigger value="90d">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Actions"
          value={stats.total_actions}
          icon={<Activity className="h-4 w-4" />}
          trend={`${((stats.successful / stats.total_actions) * 100).toFixed(0)}% success`}
        />
        <MetricCard
          title="Revenue Generated"
          value={`${(stats.total_revenue_impact / 100).toFixed(2)} MAD`}
          icon={<DollarSign className="h-4 w-4" />}
          trend="This period"
        />
        <MetricCard
          title="Time Saved"
          value={`${Math.round(stats.total_time_saved / 60)}h`}
          icon={<TrendingUp className="h-4 w-4" />}
          trend="Automated"
        />
        <MetricCard
          title="Customers Affected"
          value={stats.total_customers_affected}
          icon={<Users className="h-4 w-4" />}
          trend="Reached"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Actions by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Actions by Type</CardTitle>
            <CardDescription>Distribution of AI actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.by_type || {}).map(([type, count]: [string, any]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm">{formatActionType(type)}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${(count / stats.total_actions) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions by Risk Level */}
        <Card>
          <CardHeader>
            <CardTitle>Actions by Risk Level</CardTitle>
            <CardDescription>Risk distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.by_risk_level || {}).map(([level, count]: [string, any]) => {
                const colors = {
                  low: 'bg-green-500',
                  medium: 'bg-yellow-500',
                  high: 'bg-red-500',
                };
                return (
                  <div key={level} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{level}</span>
                      <span className="font-medium">{count} ({((count / stats.total_actions) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${colors[level as keyof typeof colors]}`}
                        style={{ width: `${(count / stats.total_actions) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Success Rate</CardTitle>
          <CardDescription>
            {((stats.successful / stats.total_actions) * 100).toFixed(1)}% of actions completed successfully
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600">Successful</span>
              <span className="font-medium">{stats.successful}</span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500"
                style={{ width: `${(stats.successful / stats.total_actions) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm mt-4">
              <span className="text-red-600">Failed</span>
              <span className="font-medium">{stats.failed}</span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500"
                style={{ width: `${(stats.failed / stats.total_actions) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm mt-4">
              <span className="text-yellow-600">Pending</span>
              <span className="font-medium">{stats.pending}</span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-500"
                style={{ width: `${(stats.pending / stats.total_actions) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon, 
  trend 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  trend: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{trend}</p>
      </CardContent>
    </Card>
  );
}

function formatActionType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
