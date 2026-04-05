'use client';

/**
 * AI Approval Queue
 * 
 * Dedicated interface for reviewing and approving pending AI actions.
 */

import { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/data/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  TrendingUp, 
  Clock,
  DollarSign,
  Users,
  Loader2
} from 'lucide-react';
import type { AIAction } from '@/lib/ai/types';

interface AIApprovalQueueProps {
  businessId: string;
}

export function AIApprovalQueue({ businessId }: AIApprovalQueueProps) {
  const [loading, setLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState<AIAction[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('system');

  useEffect(() => {
    loadCurrentUser();
    loadPendingActions();
  }, [businessId]);

  async function loadCurrentUser() {
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        setUserId(user.id);
      }
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  }

  async function loadPendingActions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/actions?businessId=${businessId}&status=pending`);
      if (res.ok) {
        const data = await res.json();
        setPendingActions(data);
      }
    } catch (error) {
      console.error('Failed to load pending actions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(actionId: string) {
    setProcessing(actionId);
    try {
      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          approve: true,
          userId,
        }),
      });

      if (res.ok) {
        setPendingActions(prev => prev.filter(a => a.id !== actionId));
      }
    } catch (error) {
      console.error('Failed to approve action:', error);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(actionId: string) {
    setProcessing(actionId);
    try {
      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          approve: false,
          userId,
        }),
      });

      if (res.ok) {
        setPendingActions(prev => prev.filter(a => a.id !== actionId));
      }
    } catch (error) {
      console.error('Failed to reject action:', error);
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const highRisk = pendingActions.filter(a => a.risk_level === 'high');
  const mediumRisk = pendingActions.filter(a => a.risk_level === 'medium');
  const lowRisk = pendingActions.filter(a => a.risk_level === 'low');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Approval Queue</h2>
          <p className="text-muted-foreground">
            {pendingActions.length} action{pendingActions.length !== 1 ? 's' : ''} awaiting approval
          </p>
        </div>
        {pendingActions.length > 0 && (
          <Button variant="outline" onClick={loadPendingActions}>
            Refresh
          </Button>
        )}
      </div>

      {pendingActions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground text-center">
              No actions require approval at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">
              All ({pendingActions.length})
            </TabsTrigger>
            <TabsTrigger value="high">
              High Risk ({highRisk.length})
            </TabsTrigger>
            <TabsTrigger value="medium">
              Medium Risk ({mediumRisk.length})
            </TabsTrigger>
            <TabsTrigger value="low">
              Low Risk ({lowRisk.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {pendingActions.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                onApprove={handleApprove}
                onReject={handleReject}
                processing={processing === action.id}
              />
            ))}
          </TabsContent>

          <TabsContent value="high" className="space-y-4">
            {highRisk.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                onApprove={handleApprove}
                onReject={handleReject}
                processing={processing === action.id}
              />
            ))}
          </TabsContent>

          <TabsContent value="medium" className="space-y-4">
            {mediumRisk.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                onApprove={handleApprove}
                onReject={handleReject}
                processing={processing === action.id}
              />
            ))}
          </TabsContent>

          <TabsContent value="low" className="space-y-4">
            {lowRisk.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                onApprove={handleApprove}
                onReject={handleReject}
                processing={processing === action.id}
              />
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ActionCard({
  action,
  onApprove,
  onReject,
  processing,
}: {
  action: AIAction;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  processing: boolean;
}) {
  const riskColors = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200',
  };

  const riskIcons = {
    low: <CheckCircle className="h-4 w-4" />,
    medium: <AlertCircle className="h-4 w-4" />,
    high: <XCircle className="h-4 w-4" />,
  };

  return (
    <Card className={`border-2 ${riskColors[action.risk_level]}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {formatActionType(action.type)}
              </CardTitle>
              <Badge className={riskColors[action.risk_level]}>
                {riskIcons[action.risk_level]}
                <span className="ml-1">{action.risk_level} risk</span>
              </Badge>
              <Badge variant="outline">
                {(action.confidence * 100).toFixed(0)}% confidence
              </Badge>
            </div>
            <CardDescription>{action.reasoning}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Expected Outcome */}
        <div className="grid grid-cols-3 gap-4">
          {action.expected_outcome.revenue_impact && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  +{(action.expected_outcome.revenue_impact / 100).toFixed(2)} MAD
                </p>
                <p className="text-xs text-muted-foreground">Expected Revenue</p>
              </div>
            </div>
          )}

          {action.expected_outcome.time_saved && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {action.expected_outcome.time_saved} min
                </p>
                <p className="text-xs text-muted-foreground">Time Saved</p>
              </div>
            </div>
          )}

          {action.expected_outcome.customer_satisfaction && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  +{(action.expected_outcome.customer_satisfaction * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">Satisfaction</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Details */}
        <div className="bg-muted/50 p-3 rounded-md">
          <p className="text-sm font-medium mb-2">Action Details:</p>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(action.action.params, null, 2)}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => onApprove(action.id)}
            disabled={processing}
            className="flex-1"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve & Execute
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => onReject(action.id)}
            disabled={processing}
            className="flex-1"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground text-center">
          Requested {new Date(action.created_at).toLocaleString()}
        </p>
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
