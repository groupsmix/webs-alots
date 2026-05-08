"use client";

import {
  Brain, Lock, Shield, AlertTriangle, Calendar,
  ChevronDown, ChevronUp, Clock,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TherapySessionNote } from "@/lib/types/para-medical";

const RISK_COLORS: Record<string, string> = {
  none: "text-green-600",
  low: "text-blue-600",
  moderate: "text-orange-600",
  high: "text-red-600",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  couple: "Couple",
  family: "Family",
  group: "Group",
};

interface TherapySessionNotesProps {
  sessions: TherapySessionNote[];
}

export function TherapySessionNotes({ sessions }: TherapySessionNotesProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  );

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
            <p className="text-2xl font-bold text-purple-600">
              {sessions.filter((s) => s.mood_rating !== null).length > 0
                ? (sessions.filter((s) => s.mood_rating !== null).reduce((s, n) => s + (n.mood_rating ?? 0), 0) /
                  sessions.filter((s) => s.mood_rating !== null).length).toFixed(1)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Avg Mood Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {sessions.length > 0
                ? Math.round(sessions.reduce((s, n) => s + n.duration_minutes, 0) / sessions.length)
                : 0}
            </p>
            <p className="text-xs text-muted-foreground">Avg Duration (min)</p>
          </CardContent>
        </Card>
      </div>

      {/* Session list */}
      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No therapy sessions recorded.</p>
      )}
      {sorted.map((session) => {
        const isExpanded = expandedId === session.id;
        return (
          <Card key={session.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      Session #{session.session_number}
                      {session.is_confidential && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.patient_name} &middot; {session.session_date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {SESSION_TYPE_LABELS[session.session_type]}
                  </Badge>
                  {session.mood_rating !== null && (
                    <Badge variant="secondary" className="text-xs">
                      Mood: {session.mood_rating}/10
                    </Badge>
                  )}
                  {session.risk_assessment && session.risk_assessment !== "none" && (
                    <Badge variant="destructive" className="text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {session.risk_assessment}
                    </Badge>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {session.duration_minutes} min</span>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-3">
                {session.is_confidential && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs">
                    <Shield className="h-4 w-4" />
                    Confidential session notes — restricted access
                  </div>
                )}

                {session.presenting_issues && (
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs font-medium mb-1">Presenting Issues</p>
                    <p className="text-xs text-muted-foreground">{session.presenting_issues}</p>
                  </div>
                )}

                {session.interventions && (
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs font-medium mb-1">Interventions Used</p>
                    <p className="text-xs text-muted-foreground">{session.interventions}</p>
                  </div>
                )}

                {session.observations && (
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs font-medium mb-1">Clinical Observations</p>
                    <p className="text-xs text-muted-foreground">{session.observations}</p>
                  </div>
                )}

                {session.homework && (
                  <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                    <p className="text-xs font-medium mb-1">Homework / Between-Session Tasks</p>
                    <p className="text-xs text-muted-foreground">{session.homework}</p>
                  </div>
                )}

                {session.risk_assessment && (
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs font-medium mb-1">Risk Assessment</p>
                    <span className={`text-xs font-medium ${RISK_COLORS[session.risk_assessment]}`}>
                      {session.risk_assessment.charAt(0).toUpperCase() + session.risk_assessment.slice(1)} Risk
                    </span>
                  </div>
                )}

                {session.next_session_date && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Next session: {session.next_session_date}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
