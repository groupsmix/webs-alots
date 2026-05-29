/* eslint-disable i18next/no-literal-string -- patient experience UI strings */
"use client";

import { Clock, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase-client";

interface QueueEntry {
  id: string;
  position: number;
  estimated_wait_minutes: number;
  status: string;
  doctor_id: string;
  checked_in_at: string;
}

interface LiveQueueDisplayProps {
  clinicId: string;
  doctorId?: string;
}

export function LiveQueueDisplay({ clinicId, doctorId }: LiveQueueDisplayProps) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function fetchQueue() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("waiting_queue")
        .select("id, position, estimated_wait_minutes, status, doctor_id, checked_in_at")
        .eq("clinic_id", clinicId)
        .in("status", ["waiting", "called", "in_progress"])
        .order("position", { ascending: true });

      if (doctorId) {
        query = query.eq("doctor_id", doctorId);
      }

      const { data } = await query;
      if (!cancelled) {
        setQueue((data ?? []) as QueueEntry[]);
        setLoading(false);
      }
    }

    fetchQueue();

    const channel = supabase
      .channel(`live-queue-${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "waiting_queue",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          fetchQueue();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [clinicId, doctorId]);

  const waitingCount = queue.filter((e) => e.status === "waiting").length;
  const calledCount = queue.filter((e) => e.status === "called").length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading queue...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Live Queue
          <Badge variant="secondary" className="text-xs">
            {waitingCount} waiting
          </Badge>
          {calledCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {calledCount} called
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No patients in queue.</p>
        ) : (
          <div className="space-y-2">
            {queue.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold shrink-0">
                  {entry.position}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={entry.status === "called" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {entry.status === "waiting" && "Waiting"}
                      {entry.status === "called" && "Called"}
                      {entry.status === "in_progress" && "In Progress"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Est. wait: ~{entry.estimated_wait_minutes} min</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
