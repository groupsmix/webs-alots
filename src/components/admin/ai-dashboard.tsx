'use client';

/**
 * AI Dashboard - Main Overview
 * 
 * Shows AI activity, performance, and controls.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  Users, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import type { AIAction, AIInsight } from '@/lib/ai/types';

interface AIDashboardProps {
  businessId: string;
}

interface DashboardStats {
  revenue?: {
    generated: number;
    roi: number;
  };
  actions?: {
    total: number;
    success_rate: number;
  };
  time_saved?: {
    total_minutes: number;
  };
  customers?: {
    reengaged: number;
  };
}

export function AIDashboard({ businessId }: AIDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActions, setRecentActions] = useState<AIAction[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [businessId]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [statsRes, actionsRes, insightsRes] = await Promise.all([
        fetch(`/api/ai/performance?businessId=${businessId}`),
        fetch(`/api/ai/actions?businessId=${businessId}&limit=10`),
        fetch(`/api/ai/insights?businessId=${businessId}&limit=5`)
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (actionsRes.ok) setRecentActions(await actionsRes.json());
      if (insightsRes.ok) setInsights(await insightsRes.json());
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  async function triggerAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId })
      });

      if (res.ok) {
        await loadDashboardData();
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Revenue Agent</h2>
          <p className="text-muted-foreground">
            Autonomous business growth powered by AI
          </p>
        </div>
        <Button 
          onClick={triggerAnalysis} 
          disabled={analyzing}
        >
          {analyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Activity className="mr-2 h-4 w-4" />
              Run Analysis
            </>
          )}
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Generated</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.revenue?.generated ? `${(stats.revenue.generated / 100).toFixed(2)} MAD` : '0 MAD'}
            </div>
            <p className="text-xs text-muted-foreground">
              +{stats?.revenue?.roi ? `${stats.revenue.roi}x` : '0x'} ROI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actions Taken</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.actions?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.actions?.success_rate ? `${(stats.actions.success_rate * 100).toFixed(0)}%` : '0%'} success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.time_saved?.total_minutes ? `${Math.round(stats.time_saved.total_minutes / 60)}h` : '0h'}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers Affected</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.customers?.reengaged || 0}</div>
            <p className="text-xs text-muted-foreground">
              Re-engaged this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Activity Feed</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Actions</CardTitle>
              <CardDescription>
                Latest actions taken by the AI agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No actions yet. Run an analysis to get started.
                </p>
              ) : (
                <div className="space-y-4">
                  {recentActions.map((action) => (
                    <ActionItem key={action.id} action={action} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>
                Opportunities and recommendations from AI analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No insights yet. Run an analysis to discover opportunities.
                </p>
              ) : (
                <div className="space-y-4">
                  {insights.map((insight) => (
                    <InsightItem key={insight.id} insight={insight} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActionItem({ action }: { action: AIAction }) {
  const statusIcons = {
    completed: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    executing: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    pending: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    approved: <CheckCircle className="h-4 w-4 text-blue-500" />,
    rolled_back: <XCircle className="h-4 w-4 text-orange-500" />
  };

  const riskColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  };

  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg">
      <div className="mt-1">{statusIcons[action.status]}</div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{formatActionType(action.type)}</p>
          <Badge className={riskColors[action.risk_level]}>
            {action.risk_level}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{action.reasoning}</p>
        {action.actual_outcome && (
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            {action.actual_outcome.revenue_impact && (
              <span>Revenue: +{(action.actual_outcome.revenue_impact / 100).toFixed(2)} MAD</span>
            )}
            {action.actual_outcome.time_saved && (
              <span>Time: {action.actual_outcome.time_saved}min</span>
            )}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {new Date(action.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

function InsightItem({ insight }: { insight: AIInsight }) {
  const impactColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  };

  return (
    <div className="p-4 border rounded-lg space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">{insight.title}</h4>
        </div>
        <Badge className={impactColors[insight.impact]}>
          {insight.impact}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{insight.description}</p>
      {insight.revenue_impact && (
        <p className="text-sm font-medium text-green-600">
          Potential: +{(insight.revenue_impact / 100).toFixed(2)} MAD
        </p>
      )}
      {insight.recommendations.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium mb-1">Recommendations:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {insight.recommendations.map((rec, i) => (
              <li key={i}>• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatActionType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
