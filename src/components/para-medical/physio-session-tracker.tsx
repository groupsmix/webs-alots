"use client";

import {
  CheckCircle, XCircle, TrendingDown, TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PhysioSession } from "@/lib/types/para-medical";

interface PhysioSessionTrackerProps {
  sessions: PhysioSession[];
}

export function PhysioSessionTracker({ sessions }: PhysioSessionTrackerProps) {
  const [filter, setFilter] = useState<"all" | "attended" | "missed">("all");

  const filtered = sessions.filter((s) => {
    if (filter === "attended") return s.attended;
    if (filter === "missed") return !s.attended;
    return true;
  });

  const attendanceRate = sessions.length
    ? Math.round((sessions.filter((s) => s.attended).length / sessions.length) * 100)
    : 0;

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
            <p className="text-xs text-muted-foreground">Attendance Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {sessions.filter((s) => s.attended).length}
            </p>
            <p className="text-xs text-muted-foreground">Attended</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "attended", "missed"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      {/* Session list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No sessions found.</p>
        )}
        {filtered.map((session) => (
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
                    <Badge variant={session.attended ? "success" : "destructive"} className="text-xs">
                      {session.attended ? "Attended" : "Missed"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {session.session_date} &middot; {session.duration_minutes} min
                  </p>

                  {/* Pain levels */}
                  {session.pain_level_before !== null && session.pain_level_after !== null && (
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span>Pain: {session.pain_level_before}/10</span>
                      {session.pain_level_after < session.pain_level_before ? (
                        <TrendingDown className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span>{session.pain_level_after}/10</span>
                    </div>
                  )}

                  {session.progress_notes && (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{session.progress_notes}</p>
                  )}

                  {session.exercises_completed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {session.exercises_completed.map((ex, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{ex}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Button({ variant = "default", size = "default", className = "", ...props }: {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors";
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  };
  const sizes: Record<string, string> = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-8 px-3 text-xs",
    lg: "h-11 px-8 text-base",
  };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
