"use client";

import { useState } from "react";
import {
  CheckCircle, XCircle, Target, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SpeechSession } from "@/lib/types/para-medical";

interface SpeechSessionTrackerProps {
  sessions: SpeechSession[];
}

export function SpeechSessionTracker({ sessions }: SpeechSessionTrackerProps) {
  const [filter, setFilter] = useState<"all" | "attended" | "missed">("all");

  const filtered = sessions.filter((s) => {
    if (filter === "attended") return s.attended;
    if (filter === "missed") return !s.attended;
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  );

  const attendanceRate = sessions.length
    ? Math.round((sessions.filter((s) => s.attended).length / sessions.length) * 100)
    : 0;

  const avgAccuracy = sessions.filter((s) => s.accuracy_pct !== null).length > 0
    ? Math.round(sessions.filter((s) => s.accuracy_pct !== null).reduce((s, n) => s + (n.accuracy_pct ?? 0), 0) /
      sessions.filter((s) => s.accuracy_pct !== null).length)
    : null;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-muted-foreground">Total Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{attendanceRate}%</p>
            <p className="text-xs text-muted-foreground">Attendance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">{avgAccuracy ?? "—"}%</p>
            <p className="text-xs text-muted-foreground">Avg Accuracy</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "attended", "missed"] as const).map((f) => (
          <button
            key={f}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Sessions */}
      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No sessions found.</p>
      )}
      {sorted.map((session) => (
        <Card key={session.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {session.attended ? (
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{session.patient_name}</p>
                  <div className="flex items-center gap-2">
                    {session.accuracy_pct !== null && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Target className="h-3 w-3" /> {session.accuracy_pct}%
                      </Badge>
                    )}
                    <Badge variant={session.attended ? "success" : "destructive"} className="text-xs">
                      {session.attended ? "Attended" : "Missed"}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  {session.session_date}
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {session.duration_minutes} min</span>
                </p>

                {session.exercises_completed.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-muted-foreground mb-1">
                      Completed: {session.exercises_completed.length}/{session.exercises_assigned.length} exercises
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {session.exercises_completed.map((ex, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{ex}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {session.notes && (
                  <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{session.notes}</p>
                )}

                {session.home_practice && (
                  <div className="mt-2 p-2 rounded bg-blue-50/50 dark:bg-blue-950/20">
                    <p className="text-[10px] font-medium text-blue-800 dark:text-blue-200">Home Practice:</p>
                    <p className="text-[10px] text-muted-foreground">{session.home_practice}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
