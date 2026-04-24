"use client";

import { RefreshCw, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RebookingRequest {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: string;
  sent_at: string;
  reminded_at: string | null;
  rebooked_at: string | null;
  alternatives: Array<{
    option_index: number;
    date: string;
    time: string;
    label: string;
  }> | null;
}

interface RebookingStatusProps {
  clinicId: string;
  doctorId: string;
}

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock, label: "Awaiting Response" },
  rebooked: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2, label: "Rebooked" },
  expired: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle, label: "Expired" },
};

export function RebookingStatus({ clinicId, doctorId }: RebookingStatusProps) {
  const [requests, setRequests] = useState<RebookingRequest[]>([]);
  const [summary, setSummary] = useState({ total: 0, rebooked: 0, pending: 0, expired: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ clinicId, doctorId });
      const response = await fetch(`/api/doctor-unavailability?${params}`);
      const data = await response.json();

      if (data.ok) {
        setRequests(data.data.requests ?? []);
        setSummary(data.data.summary ?? { total: 0, rebooked: 0, pending: 0, expired: 0 });
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, doctorId]);

  if (loading) {
    return null;
  }

  if (summary.total === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Rebooking Status
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchStatus}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
            <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{summary.pending}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
            <p className="text-lg font-bold text-green-700 dark:text-green-300">{summary.rebooked}</p>
            <p className="text-[10px] text-muted-foreground">Rebooked</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
            <p className="text-lg font-bold text-red-700 dark:text-red-300">{summary.expired}</p>
            <p className="text-[10px] text-muted-foreground">Expired</p>
          </div>
        </div>

        {/* Progress bar */}
        {summary.total > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Rebooking progress</span>
              <span>
                {summary.rebooked}/{summary.total} patients rebooked
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(summary.rebooked / summary.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Request list */}
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {requests.slice(0, 10).map((req) => {
            const config = statusConfig[req.status] ?? statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <div
                key={req.id}
                className="flex items-center justify-between text-sm border rounded-lg p-2"
              >
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-3.5 w-3.5" />
                  <span className="text-xs">Appt: {req.appointment_id.slice(0, 8)}...</span>
                </div>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${config.color}`}
                >
                  {config.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
