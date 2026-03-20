"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, X, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WaitingListEntry } from "@/lib/demo-data";

interface WaitingListStatusProps {
  patientId: string;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  waiting: "default",
  notified: "secondary",
  booked: "secondary",
  expired: "destructive",
};

/**
 * WaitingListStatus
 *
 * Shows the patient's current waiting list entries
 * and allows them to remove themselves.
 */
export function WaitingListStatus({ patientId }: WaitingListStatusProps) {
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/booking/waiting-list?patientId=${patientId}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleRemove = async (entryId: string) => {
    try {
      await fetch("/api/booking/waiting-list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch {
      // Silently handle errors
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Loading waiting list...</p>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Your Waiting List
          <Badge variant="outline">{entries.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between border rounded-lg p-3"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">{entry.doctorName}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{entry.preferredDate}</span>
                {entry.preferredTime && <span>at {entry.preferredTime}</span>}
                {entry.serviceName && <span>&middot; {entry.serviceName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {entry.status === "notified" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  Notified
                </Badge>
              )}
              <Badge variant={statusVariant[entry.status] ?? "default"}>
                {entry.status}
              </Badge>
              {entry.status === "waiting" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(entry.id)}
                  title="Remove from waiting list"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
